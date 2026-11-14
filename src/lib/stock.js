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

export class DamageExceedsStockError extends Error {
  constructor(available) {
    super(`มีของอยู่แค่ ${available} แจ้งเสียเกินนี้ไม่ได้`)
    this.name = 'DamageExceedsStockError'
  }
}

/** แจ้งของเสีย — เช็คในทรานแซกชันด้วย เผื่อเพิ่งขายไปจากอีกเครื่องจนของเหลือน้อยกว่าที่เห็นบนจอ */
export async function reportDamage({ productId, qty, reason }) {
  const productRef = doc(db, 'products', productId)
  const logRef = doc(collection(db, 'stock_logs'))
  const amount = Math.abs(qty)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
    if (amount > currentQty) throw new DamageExceedsStockError(currentQty)
    transaction.update(productRef, { stock_qty: currentQty - amount })
    transaction.set(logRef, {
      product_id: productId,
      type: 'damage',
      qty_change: -amount,
      note: reason || null,
      order_id: null,
      created_at: serverTimestamp(),
    })
  })
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
 * - ของเหลือของสินค้ารายวัน = ทิ้ง ขายไม่ได้
 * ถ้ารวมเป็นก้อนเดียวจะแยกไม่ออกว่าวันไหนสั่งของเกิน วันไหนมีของหาย
 *
 * กดปิดกะซ้ำได้ไม่เพี้ยน: ประวัติใช้รหัสตายตัวต่อกะต่อสินค้า ถ้าเคยบันทึกไปแล้ว
 * (เน็ตหลุดหลังปรับสต็อกบางตัว แล้วกดปิดกะใหม่) ตัวนั้นข้ามไปเลย ไม่บันทึกของทิ้งซ้ำ
 */
export function closingLogIds(shiftId, productId) {
  return { diff: `count_${shiftId}_${productId}`, waste: `waste_${shiftId}_${productId}` }
}

export async function applyClosingCount({ shiftId = null, productId, countedQty, discardLeftover, note }) {
  const productRef = doc(db, 'products', productId)
  const ids = shiftId ? closingLogIds(shiftId, productId) : null
  const diffLogRef = ids ? doc(db, 'stock_logs', ids.diff) : doc(collection(db, 'stock_logs'))
  const wasteLogRef = ids ? doc(db, 'stock_logs', ids.waste) : doc(collection(db, 'stock_logs'))
  const counted = Math.max(0, Math.floor(countedQty))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef)
    if (ids) {
      const [diffDone, wasteDone] = await Promise.all([transaction.get(diffLogRef), transaction.get(wasteLogRef)])
      if (diffDone.exists() || wasteDone.exists()) return
    }
    const currentQty = snap.exists() ? (snap.data().stock_qty ?? 0) : 0
    const diff = counted - currentQty

    transaction.update(productRef, { stock_qty: discardLeftover ? 0 : counted })

    if (diff !== 0) {
      transaction.set(diffLogRef, {
        product_id: productId,
        shift_id: shiftId,
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
        shift_id: shiftId,
        type: 'waste',
        qty_change: -counted,
        note: 'ของเหลือทิ้งตอนปิดกะ',
        order_id: null,
        created_at: serverTimestamp(),
      })
    }
  })
}
