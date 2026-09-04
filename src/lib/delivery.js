import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * ยอดรวมรายวันจากแอปเดลิเวอรี เก็บแยกจาก orders
 *
 * เดิมยอดนี้ถูกเขียนเป็นบิลปลอมใน orders (items ว่าง กินเลขคิวไป 1 เลข)
 * ทำให้ "บิลทั้งหมด" และ "เฉลี่ย/บิล" ในแดชบอร์ดเพี้ยน และโผล่ในหน้าเอกสาร
 * เป็นบิลที่กดเข้าไปแล้วไม่มีรายการสินค้า
 */
export async function importDeliveryTotal({ platform, amount, date, shiftId = null }) {
  await addDoc(collection(db, 'delivery_imports'), {
    platform,
    amount,
    date,
    shift_id: shiftId,
    created_at: serverTimestamp(),
  })
}

export function deleteDeliveryImport(importId) {
  return deleteDoc(doc(db, 'delivery_imports', importId))
}
