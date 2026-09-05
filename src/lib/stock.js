import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

async function applyStockChange(productId, qtyChange, type, note) {
  const productRef = doc(db, 'products', productId)
  const logRef = doc(collection(db, 'stock_logs'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
    const nextQty = currentQty + qtyChange

    transaction.update(productRef, { stock_qty: nextQty })
    transaction.set(logRef, {
      product_id: productId,
      type,
      qty_change: qtyChange,
      note: note || null,
      order_id: null,
      created_at: serverTimestamp(),
    })
  })
}

export async function restockProduct({ productId, qty, note }) {
  const productRef = doc(db, 'products', productId)
  const logRef = doc(collection(db, 'stock_logs'))
  const qtyChange = Math.abs(qty)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
    const nextQty = currentQty + qtyChange

    transaction.update(productRef, { stock_qty: nextQty })
    transaction.set(logRef, {
      product_id: productId,
      type: 'restock',
      qty_change: qtyChange,
      note: note || null,
      order_id: null,
      created_at: serverTimestamp(),
    })
  })
}

export function adjustStock(productId, qtyChange, note) {
  return applyStockChange(productId, qtyChange, 'adjustment', note)
}

export function reportDamage({ productId, qty, reason }) {
  return applyStockChange(productId, -Math.abs(qty), 'damage', reason)
}

export async function resetDailyStock(productId) {
  const productRef = doc(db, 'products', productId)
  const logRef = doc(collection(db, 'stock_logs'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0

    transaction.update(productRef, { stock_qty: 0 })
    transaction.set(logRef, {
      product_id: productId,
      type: 'adjustment',
      qty_change: -currentQty,
      note: 'เปิดกะใหม่',
      order_id: null,
      created_at: serverTimestamp(),
    })
  })
}

/**
 * ปรับสต็อกตามที่นับได้ตอนปิดกะ
 *
 * แยกบันทึกเป็นสองเหตุผลในธุรกรรมเดียว เพราะสองอย่างนี้คนละเรื่องกัน
 * - ส่วนต่างจากที่ระบบคิดไว้ = ของหายโดยไม่มีบิล ต้องตามหาสาเหตุ
 * - ของเหลือของสินค้ารายวัน = ทิ้ง เป็นต้นทุนที่จ่ายไปแล้วขายไม่ได้
 * ถ้ารวมเป็นก้อนเดียวจะแยกไม่ออกว่าวันไหนสั่งของเกิน วันไหนมีของหาย
 */
export async function applyClosingCount({ productId, countedQty, discardLeftover, note }) {
  const productRef = doc(db, 'products', productId)
  const diffLogRef = doc(collection(db, 'stock_logs'))
  const wasteLogRef = doc(collection(db, 'stock_logs'))
  const counted = Math.max(0, Math.floor(countedQty))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
    const diff = counted - currentQty

    transaction.update(productRef, { stock_qty: discardLeftover ? 0 : counted })

    if (diff !== 0) {
      transaction.set(diffLogRef, {
        product_id: productId,
        type: 'shift_count',
        qty_change: diff,
        note: note || 'นับของเหลือตอนปิดกะ',
        order_id: null,
        created_at: serverTimestamp(),
      })
    }

    if (discardLeftover && counted > 0) {
      transaction.set(wasteLogRef, {
        product_id: productId,
        type: 'waste',
        qty_change: -counted,
        note: 'ของเหลือทิ้งตอนปิดกะ',
        order_id: null,
        created_at: serverTimestamp(),
      })
    }
  })
}
