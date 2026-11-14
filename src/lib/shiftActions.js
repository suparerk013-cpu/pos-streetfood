import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { resetDailyStock } from './stock'

/**
 * เปิดกะ / ปิดกะ — ใช้ที่เดียวทั้งหน้ากะและหน้าต่างที่เด้งในหน้าขาย
 *
 * เดิมสองที่เขียนแยกกัน หน้ากะล้างสต็อกสินค้ารายวันให้ แต่หน้าต่างในหน้าขายไม่ล้าง
 * เปิดกะจากหน้าขายแล้วของเมื่อวานยังค้างอยู่ในระบบ
 *
 * กันเปิดกะซ้อนด้วยเอกสารล็อก counters/open_shift ในทรานแซกชันเดียวกับที่สร้างกะ
 * สองเครื่องกดพร้อมกัน เครื่องที่สองจะเจอว่ามีกะเปิดอยู่แล้ว ไม่ได้กะที่สองมาแบ่งบิลกัน
 */
const lockRef = () => doc(db, 'counters', 'open_shift')

export class ShiftAlreadyOpenError extends Error {
  constructor() {
    super('มีกะเปิดอยู่แล้ว (อาจเปิดจากอีกเครื่อง) ใช้กะนั้นต่อได้เลย')
    this.name = 'ShiftAlreadyOpenError'
  }
}

export class ShiftAlreadyClosedError extends Error {
  constructor() {
    super('กะนี้ถูกปิดไปแล้ว (อาจปิดจากอีกเครื่อง)')
    this.name = 'ShiftAlreadyClosedError'
  }
}

/** สินค้าที่ต้องล้างสต็อกตอนเปิดกะ — สต็อกรายวันที่ยังมีของค้าง ไม่รวมเซ็ต */
export function dailyProductsToReset(products = []) {
  return products.filter((p) => !p.is_bundle && p.stock_type === 'daily' && (p.stock_qty ?? 0) !== 0)
}

export async function openShift({ openingFloat, products = [], resetDaily = true }) {
  const shiftRef = doc(collection(db, 'shifts'))
  await runTransaction(db, async (transaction) => {
    const lock = await transaction.get(lockRef())
    const lockedId = lock.exists() ? lock.data().shift_id : null
    if (lockedId) {
      const locked = await transaction.get(doc(db, 'shifts', lockedId))
      if (locked.exists() && locked.data().status === 'open') throw new ShiftAlreadyOpenError()
    }
    transaction.set(shiftRef, {
      status: 'open',
      opened_at: serverTimestamp(),
      closed_at: null,
      opening_float: Number(openingFloat) || 0,
      cash_counted: null,
      summary: null,
    })
    transaction.set(lockRef(), { shift_id: shiftRef.id, updated_at: serverTimestamp() })
  })
  // สินค้าสต็อกรายวันเริ่มนับใหม่ทุกกะ ไม่งั้นยอดค้างจากเมื่อวาน
  if (resetDaily) {
    await Promise.all(dailyProductsToReset(products).map((p) => resetDailyStock(p.id)))
  }
  return shiftRef.id
}

/** ปิดกะ — ถ้าอีกเครื่องปิดไปก่อนแล้วจะไม่เขียนทับยอดสรุปของเครื่องนั้น */
export async function closeShift(shiftId, fields) {
  const shiftRef = doc(db, 'shifts', shiftId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(shiftRef)
    const lock = await transaction.get(lockRef())
    if (!snap.exists() || snap.data().status !== 'open') throw new ShiftAlreadyClosedError()
    transaction.update(shiftRef, { ...fields, status: 'closed', closed_at: serverTimestamp() })
    if (lock.exists() && lock.data().shift_id === shiftId) {
      transaction.set(lockRef(), { shift_id: null, updated_at: serverTimestamp() })
    }
  })
}

/** ข้อความผิดพลาดที่คนหน้าร้านอ่านรู้เรื่อง */
export function shiftErrorMessage(error, action = 'บันทึก') {
  if (error instanceof ShiftAlreadyOpenError || error instanceof ShiftAlreadyClosedError) return error.message
  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
    return `${action}ไม่สำเร็จ เน็ตหลุด ตรวจสัญญาณแล้วกดใหม่`
  }
  return `${action}ไม่สำเร็จ ลองกดใหม่อีกครั้ง`
}
