import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { DEFAULT_GP_RATE, METHOD_LABELS, paymentLabel } from './constants'
import { db } from './firebase'
import { buildOrderItems, stockUnitsFromItems } from './orderLines'
import { netAfterGp } from './pricing'

export { METHOD_LABELS, paymentLabel }
export { buildOrderItems, stockUnitsFromItems, summarizePayments } from './orderLines'

export class InsufficientStockError extends Error {
  constructor(shortages) {
    const detail = shortages
      .map((s) => `${s.name} (เหลือ ${s.available}, ต้องการ ${s.requested})`)
      .join(', ')
    super(`สต็อกไม่พอ: ${detail}`)
    this.name = 'InsufficientStockError'
    this.shortages = shortages
  }
}

/**
 * ออกบิล ตัดสต็อก และออกเลขคิว ในทรานแซกชันเดียว
 *
 * lines = รายการที่ขาย + ของแถม (ราคา 0 แต่ตัดสต็อกเต็ม)
 * เซ็ตจะถูกกระจายเป็นส่วนประกอบก่อนตัดสต็อก ตัวเซ็ตเองไม่มี stock_qty ของตัวเอง
 */
export async function createOrder({
  cart,
  payments,
  total,
  discount = 0,
  subtotal,
  shiftId = null,
  productById,
  channel = 'store',
  platform = null,
  gpRate = null,
  platformOrderNo = null,
}) {
  const counterRef = doc(db, 'counters', 'queue_counter')
  const orderRef = doc(collection(db, 'orders'))

  const items = buildOrderItems(cart, productById)
  const qtyByProduct = stockUnitsFromItems(items)
  const productIds = [...qtyByProduct.keys()]
  const productRefs = productIds.map((id) => doc(db, 'products', id))
  const nameByProduct = new Map(
    productIds.map((id) => [id, productById?.get(id)?.name ?? id]),
  )

  const effectiveGp = channel === 'delivery' ? (gpRate ?? DEFAULT_GP_RATE) : 0

  const queueNo = await runTransaction(db, async (transaction) => {
    // Firestore requires all reads before any writes in a transaction.
    const counterSnap = await transaction.get(counterRef)
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)))

    const currentQtyByProduct = new Map()
    const shortages = []
    productIds.forEach((id, index) => {
      const snap = productSnaps[index]
      const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
      currentQtyByProduct.set(id, currentQty)
      const requested = qtyByProduct.get(id)
      if (currentQty < requested) {
        shortages.push({ name: nameByProduct.get(id) ?? id, available: currentQty, requested })
      }
    })
    if (shortages.length > 0) throw new InsufficientStockError(shortages)

    const next = nextQueueNo(counterSnap)

    transaction.set(counterRef, { current_value: next.value, day: next.day }, { merge: true })
    transaction.set(orderRef, {
      queue_no: next.value,
      shift_id: shiftId,
      channel,
      platform,
      gp_rate: effectiveGp,
      net_amount: netAfterGp(total, effectiveGp),
      platform_order_no: platformOrderNo || null,
      items,
      subtotal: subtotal ?? total,
      discount: discount > 0 ? discount : null,
      total_amount: total,
      payments,
      status: 'completed',
      created_at: serverTimestamp(),
      is_voided: false,
    })

    productIds.forEach((id, index) => {
      const soldQty = qtyByProduct.get(id)
      transaction.update(productRefs[index], {
        stock_qty: currentQtyByProduct.get(id) - soldQty,
      })

      const logRef = doc(collection(db, 'stock_logs'))
      transaction.set(logRef, {
        product_id: id,
        type: 'sale',
        qty_change: -soldQty,
        note: null,
        order_id: orderRef.id,
        created_at: serverTimestamp(),
      })
    })

    return next.value
  })

  return { orderId: orderRef.id, queueNo, payments, total, channel, platform }
}

/**
 * เลขคิวเริ่มนับ 1 ใหม่ทุกวัน — เดิมนับสะสมไปเรื่อย ๆ จนกลายเป็น "คิว 8,432"
 */
function nextQueueNo(counterSnap) {
  const today = todayKey()
  const data = counterSnap.exists() ? counterSnap.data() : null
  if (!data || data.day !== today) return { value: 1, day: today }
  return { value: (data.current_value ?? 0) + 1, day: today }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function voidOrder(orderId, items) {
  const orderRef = doc(db, 'orders', orderId)
  // เซ็ตต้องคืนสต็อกให้ส่วนประกอบ ไม่ใช่ให้ตัวเซ็ตซึ่งไม่มีสต็อกของตัวเอง
  const qtyByProduct = stockUnitsFromItems(items ?? [])
  const productIds = [...qtyByProduct.keys()]
  const productRefs = productIds.map((id) => doc(db, 'products', id))

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists() || orderSnap.data().is_voided) throw new Error('ไม่พบบิล หรือยกเลิกแล้ว')
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)))

    transaction.update(orderRef, { is_voided: true, voided_at: serverTimestamp() })

    productIds.forEach((id, index) => {
      const snap = productSnaps[index]
      if (!snap.exists()) return
      const qty = qtyByProduct.get(id)
      transaction.update(productRefs[index], { stock_qty: (snap.data().stock_qty ?? 0) + qty })
      const logRef = doc(collection(db, 'stock_logs'))
      transaction.set(logRef, {
        product_id: id,
        type: 'void',
        qty_change: qty,
        note: `ยกเลิกบิล #${orderSnap.data().queue_no}`,
        order_id: orderId,
        created_at: serverTimestamp(),
      })
    })
  })
}
