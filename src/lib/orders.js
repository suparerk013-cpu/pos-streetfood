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

    const next = nextQueueNo(counterSnap.exists() ? counterSnap.data() : null, { shiftId, today: todayKey() })

    transaction.set(counterRef, { current_value: next.value, day: next.day, shift_id: next.shiftId }, { merge: true })
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
 * เลขคิวเริ่มนับ 1 ใหม่ทุกกะ
 *
 * เดิมเริ่มใหม่ตามวันที่ในปฏิทิน ร้านขาย 4 โมงเย็นถึงตีหนึ่ง พอเลยเที่ยงคืนเลขคิว
 * กลับไปเป็น 1 กลางกะ ลูกค้าหัวค่ำกับลูกค้าหลังเที่ยงคืนถือคิวเลขเดียวกัน
 *
 * - มีกะ: กะเดียวกันนับต่อ กะใหม่เริ่ม 1
 * - ตัวนับเก่าที่ยังไม่เคยจำกะ (ก่อนอัปเดต) แต่เป็นวันเดียวกัน นับต่อไปก่อน
 *   ไม่งั้นกะที่เปิดค้างอยู่ตอนอัปเดตจะได้คิว 1 ซ้ำกับตอนหัวค่ำ
 * - ขายตอนไม่ได้เปิดกะ: ใช้วันที่แบบเดิม
 */
export function nextQueueNo(data, { shiftId = null, today }) {
  const current = data?.current_value ?? 0
  if (shiftId) {
    const sameShift = data?.shift_id === shiftId
    const legacySameDay = data && data.shift_id === undefined && data.day === today
    return { value: sameShift || legacySameDay ? current + 1 : 1, day: today, shiftId }
  }
  if (!data || data.day !== today) return { value: 1, day: today, shiftId: null }
  return { value: current + 1, day: today, shiftId: null }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export class ClosedShiftError extends Error {
  constructor() {
    super('กะของบิลนี้ปิดไปแล้ว ยกเลิกไม่ได้ เพราะยอดปิดกะบันทึกไปแล้ว')
    this.name = 'ClosedShiftError'
  }
}

/**
 * ยกเลิกบิล — เฉพาะบิลของกะที่ยังเปิดอยู่ (หรือบิลนอกกะ)
 *
 * กะที่ปิดแล้วเก็บยอดสรุปไว้ ถ้ายอมให้ยกเลิกบิลย้อนหลัง บิลหายแต่ยอดปิดกะยังเท่าเดิม
 * แดชบอร์ดกับประวัติกะจะเห็นตัวเลขไม่ตรงกัน เช็คในทรานแซกชันด้วย
 * ไม่ใช่แค่ซ่อนปุ่ม เพราะอีกเครื่องอาจปิดกะไปแล้วตอนที่หน้านี้ยังเปิดค้าง
 */
export async function voidOrder(orderId, items) {
  const orderRef = doc(db, 'orders', orderId)
  // เซ็ตต้องคืนสต็อกให้ส่วนประกอบ ไม่ใช่ให้ตัวเซ็ตซึ่งไม่มีสต็อกของตัวเอง
  const qtyByProduct = stockUnitsFromItems(items ?? [])
  const productIds = [...qtyByProduct.keys()]
  const productRefs = productIds.map((id) => doc(db, 'products', id))

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists() || orderSnap.data().is_voided) throw new Error('ไม่พบบิล หรือยกเลิกแล้ว')
    const shiftId = orderSnap.data().shift_id
    if (shiftId) {
      const shiftSnap = await transaction.get(doc(db, 'shifts', shiftId))
      if (shiftSnap.exists() && shiftSnap.data().status === 'closed') throw new ClosedShiftError()
    }
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
