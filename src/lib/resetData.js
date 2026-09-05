import { collection, getDocs, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

/**
 * ล้างข้อมูลทดสอบก่อนเริ่มขายจริง
 *
 * ลบทุกอย่างที่เกิดจากการลองใช้งาน แต่ "ไม่แตะการตั้งค่าร้าน" — ชื่อร้าน โลโก้
 * เบอร์โทร ค่า GP ค่าแพ็ค ค่าของประกอบ เป็นค่าที่ตั้งไว้ใช้จริง ไม่ใช่ข้อมูลทดสอบ
 * ต้องตั้งใหม่ทั้งหมดถ้าโดนล้างไปด้วย
 */

/** เรียงให้บิลถูกลบก่อนสินค้า ระหว่างลบจะได้ไม่มีบิลที่อ้างสินค้าที่หายไปแล้ว */
export const RESET_COLLECTIONS = [
  { name: 'orders', label: 'บิลขาย' },
  { name: 'stock_logs', label: 'ประวัติสต็อก' },
  { name: 'delivery_imports', label: 'ยอดเดลิเวอรีที่บันทึกไว้' },
  { name: 'payouts', label: 'รอบจ่ายเงินจากแอป' },
  { name: 'shifts', label: 'กะที่เปิด–ปิด' },
  { name: 'expenses', label: 'ค่าใช้จ่าย' },
  { name: 'purchases', label: 'การซื้อวัตถุดิบ' },
  { name: 'ingredients', label: 'วัตถุดิบ' },
  { name: 'products', label: 'สินค้าและเซ็ต' },
  { name: 'counters', label: 'เลขคิว' },
]

/** Firestore รับได้ 500 คำสั่งต่อชุด เผื่อไว้ให้ต่ำกว่านั้น */
const BATCH_LIMIT = 400

/** ลบทุกเอกสารใน collection เดียว คืนจำนวนที่ลบไป */
export async function clearCollection(name) {
  const snap = await getDocs(collection(db, name))
  const docs = snap.docs

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return docs.length
}

/**
 * ล้างทุก collection ตามลำดับ
 * onProgress ถูกเรียกหลังลบเสร็จทีละอัน เพื่อให้หน้าจอบอกได้ว่าทำถึงไหนแล้ว
 */
export async function resetAllData(onProgress) {
  const removed = []
  for (const { name, label } of RESET_COLLECTIONS) {
    const count = await clearCollection(name)
    removed.push({ name, label, count })
    onProgress?.({ name, label, count, done: removed.length, total: RESET_COLLECTIONS.length })
  }
  return removed
}
