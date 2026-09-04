import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function addProduct({
  name,
  price,
  category,
  stockType,
  stockQty,
  unit,
  modifiers,
  sortOrder,
  imageBase64,
  deliveryPrices,
}) {
  await addDoc(collection(db, 'products'), {
    name,
    category,
    price,
    is_active: true,
    stock_type: stockType,
    stock_qty: stockQty ?? 0,
    unit: unit || 'ชิ้น',
    modifiers,
    sort_order: sortOrder,
    image_base64: imageBase64 ?? null,
    delivery_prices: deliveryPrices ?? {},
  })
}

export async function updateProduct(productId, updates) {
  await updateDoc(doc(db, 'products', productId), updates)
}

/**
 * ซ่อนสินค้าแทนการลบถาวร
 *
 * ถ้าลบเอกสารจริง บิลเก่าที่อ้าง product_id นี้จะหาชื่อสินค้าไม่เจอ รายงานย้อนหลัง
 * จะขึ้นว่า "สินค้าที่ถูกลบแล้ว" และประวัติสต็อกกลายเป็นเอกสารกำพร้า
 * หน้าขายกรอง is_active อยู่แล้ว สินค้าจึงหายจากหน้าขายทันทีเหมือนเดิม
 */
export async function deleteProduct(productId) {
  await updateDoc(doc(db, 'products', productId), {
    is_active: false,
    archived_at: new Date(),
  })
}
