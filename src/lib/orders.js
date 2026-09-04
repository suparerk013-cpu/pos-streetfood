import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { METHOD_LABELS, paymentLabel } from './constants'
import { db } from './firebase'

export { METHOD_LABELS, paymentLabel }

export function summarizePayments(payments) {
  const line = payments.map((p) => `${paymentLabel(p)} ${p.amount.toLocaleString()}`).join(' + ')
  const changeTotal = payments.reduce((sum, p) => sum + (p.change || 0), 0)
  return { line, changeTotal }
}

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

function buildOrderItems(cart) {
  return cart.map((item) => ({
    product_id: item.productId,
    name: item.name,
    qty: item.quantity,
    unit_price: item.price,
    line_total: item.price * item.quantity,
    modifiers: item.modifiers ?? {},
  }))
}

function aggregateQtyByProduct(cart) {
  const map = new Map()
  cart.forEach((item) => {
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity)
  })
  return map
}

export async function createOrder({ cart, payments, total, discount = 0, subtotal, shiftId = null }) {
  const counterRef = doc(db, 'counters', 'queue_counter')
  const orderRef = doc(collection(db, 'orders'))

  const qtyByProduct = aggregateQtyByProduct(cart)
  const productIds = [...qtyByProduct.keys()]
  const productRefs = productIds.map((id) => doc(db, 'products', id))
  const nameByProduct = new Map(cart.map((item) => [item.productId, item.name]))

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
    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages)
    }

    const next = nextQueueNo(counterSnap)

    transaction.set(counterRef, { current_value: next.value, day: next.day }, { merge: true })
    transaction.set(orderRef, {
      queue_no: next.value,
      shift_id: shiftId,
      items: buildOrderItems(cart),
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
      const nextQty = currentQtyByProduct.get(id) - soldQty
      transaction.update(productRefs[index], { stock_qty: nextQty })

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

  return { orderId: orderRef.id, queueNo, payments, total }
}

/**
 * เลขคิวเริ่มนับ 1 ใหม่ทุกวัน — เดิมนับสะสมไปเรื่อย ๆ จนกลายเป็น "คิว 8,432"
 * เก็บวันที่ไว้ในตัวนับเพื่อรู้ว่าต้องรีเซ็ตเมื่อไร
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
  const productRefs = items.map((item) => doc(db, 'products', item.product_id))

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists() || orderSnap.data().is_voided) throw new Error('ไม่พบบิล หรือยกเลิกแล้ว')
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)))

    transaction.update(orderRef, { is_voided: true, voided_at: serverTimestamp() })

    items.forEach((item, index) => {
      const snap = productSnaps[index]
      if (!snap.exists()) return
      const currentQty = snap.data().stock_qty ?? 0
      transaction.update(productRefs[index], { stock_qty: currentQty + item.qty })
      const logRef = doc(collection(db, 'stock_logs'))
      transaction.set(logRef, {
        product_id: item.product_id,
        type: 'void',
        qty_change: item.qty,
        note: `ยกเลิกบิล #${orderSnap.data().queue_no}`,
        order_id: orderId,
        created_at: serverTimestamp(),
      })
    })
  })
}
