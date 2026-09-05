import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function addProduct({
  name,
  price,
  category,
  stockType,
  stockQty,
  unit,
  sortOrder,
  imageBase64,
  channel,
  deliveryPrice,
}) {
  await addDoc(collection(db, 'products'), {
    name,
    category,
    price,
    is_active: true,
    stock_type: stockType,
    stock_qty: stockQty ?? 0,
    unit: unit || 'ชิ้น',
    sort_order: sortOrder,
    image_base64: imageBase64 ?? null,
    channel: channel ?? 'both',
    delivery_price: deliveryPrice ?? null,
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

/** สร้างเซ็ตใหม่ — เซ็ตไม่มี stock_qty ของตัวเอง สต็อกคำนวณจากส่วนประกอบตอนแสดงผล */
export async function addBundle({ name, channel, components, price, delivery_price, sortOrder }) {
  await addDoc(collection(db, 'products'), {
    name,
    category: 'เซ็ต',
    price,
    delivery_price: delivery_price ?? null,
    is_active: true,
    is_bundle: true,
    channel,
    components,
    stock_type: 'batch',
    unit: 'ชุด',
    modifiers: {},
    sort_order: sortOrder,
    image_base64: null,
  })
}
