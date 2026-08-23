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
