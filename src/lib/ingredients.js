import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

export {
  COMMON_UNITS,
  CONTENT_UNITS,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_BAR_COLORS,
  INGREDIENT_CATEGORY_ICONS,
} from './ingredientCategories'

export async function addIngredient({ name, unit, category, reorder_qty = null, reorder_unit = null }) {
  const ref = await addDoc(collection(db, 'ingredients'), {
    name: name.trim(),
    unit: unit || 'ชิ้น',
    category: category || 'other',
    is_active: true,
    last_price: null,
    stock_qty: 0,
    reorder_qty,
    reorder_unit,
    created_at: serverTimestamp(),
  })
  return ref.id
}

/**
 * ปรับสต็อกวัตถุดิบด้วยมือ — ใช้ตอนนับของจริงแล้วไม่ตรงกับที่ระบบจำไว้
 *
 * ตั้งเป็นตัวเลขตรง ๆ ไม่ใช่บวกลบ เพราะคนนับของถือของอยู่ในมือแล้วรู้ว่าเหลือเท่าไหร่
 * ให้มานั่งคิดว่าต้องบวกลบเท่าไหร่จะผิดง่ายกว่า
 */
export function setIngredientStock(ingredientId, qty) {
  return updateDoc(doc(db, 'ingredients', ingredientId), {
    stock_qty: Math.max(0, Number(qty) || 0),
  })
}

export function updateIngredient(ingredientId, updates) {
  return updateDoc(doc(db, 'ingredients', ingredientId), updates)
}

/** ซ่อนวัตถุดิบ ไม่ลบถาวร เพราะประวัติการซื้อยังอ้างถึงอยู่ */
export function archiveIngredient(ingredientId) {
  return updateDoc(doc(db, 'ingredients', ingredientId), { is_active: false })
}

/**
 * บันทึกการซื้อ 1 ครั้ง และอัปเดตราคาล่าสุดของวัตถุดิบไปพร้อมกัน
 * เก็บ ingredient_name ซ้ำไว้ในเอกสารด้วย เผื่อวัตถุดิบถูกซ่อนหรือเปลี่ยนชื่อทีหลัง
 */
export async function recordPurchase({
  ingredientId,
  ingredientName,
  category,
  unit,
  qty,
  totalAmount,
  date,
  vendor,
  note,
}) {
  const unitPrice = qty > 0 ? totalAmount / qty : 0
  const batch = writeBatch(db)

  batch.set(doc(collection(db, 'purchases')), {
    ingredient_id: ingredientId,
    ingredient_name: ingredientName,
    category,
    unit,
    qty,
    unit_price: unitPrice,
    total_amount: totalAmount,
    date,
    vendor: vendor?.trim() || null,
    note: note?.trim() || null,
    created_at: serverTimestamp(),
  })

  // เพิ่มสต็อกด้วย increment ไม่ใช่อ่านมาบวกแล้วเขียนกลับ เพราะถ้าเปิดสองเครื่อง
  // บันทึกซื้อพร้อมกัน การอ่าน-บวก-เขียนจะทับกันแล้วของหายไปหนึ่งรอบ
  batch.update(doc(db, 'ingredients', ingredientId), {
    last_price: unitPrice,
    last_purchased_at: date,
    stock_qty: increment(Number(qty) || 0),
  })

  await batch.commit()
}

/**
 * บันทึกของที่ซื้อมาทั้งตะกร้าในครั้งเดียว — ใช้ตอนกลับจากตลาด
 *
 * เขียนทุกอย่างในชุดเดียว ทั้งรายการซื้อ ราคาล่าสุด และสต็อกที่เพิ่ม
 * ถ้าแยกบันทึกทีละตัวแล้วเน็ตหลุดกลางทาง จะได้ของครึ่งตะกร้าเข้าคลัง
 * อีกครึ่งหาย แล้วต้องมานั่งไล่ว่าตัวไหนเข้าไปแล้วบ้าง
 *
 * ของที่ยังไม่มีในทะเบียน (เจอของใหม่ในตลาด) สร้างให้ก่อนแล้วค่อยบันทึกซื้อ
 */
export async function recordPurchases(items = [], { date }) {
  const rows = []
  for (const item of items) {
    let ingredientId = item.ingredientId
    if (!ingredientId) {
      ingredientId = await addIngredient({
        name: item.ingredientName,
        unit: item.unit,
        category: item.category,
      })
    }
    rows.push({ ...item, ingredientId })
  }

  const batch = writeBatch(db)
  rows.forEach((row) => {
    const qty = Number(row.qty) || 0
    const totalAmount = Number(row.totalAmount) || 0
    const unitPrice = qty > 0 ? totalAmount / qty : 0

    batch.set(doc(collection(db, 'purchases')), {
      ingredient_id: row.ingredientId,
      ingredient_name: row.ingredientName,
      category: row.category ?? 'other',
      unit: row.unit ?? 'ชิ้น',
      qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      date,
      vendor: row.vendor?.trim() || null,
      note: row.note?.trim() || null,
      created_at: serverTimestamp(),
    })

    batch.update(doc(db, 'ingredients', row.ingredientId), {
      last_price: unitPrice,
      last_purchased_at: date,
      stock_qty: increment(qty),
    })
  })

  await batch.commit()
  return rows.length
}

export function updatePurchase(purchaseId, updates) {
  return updateDoc(doc(db, 'purchases', purchaseId), updates)
}

export function deletePurchase(purchaseId) {
  return deleteDoc(doc(db, 'purchases', purchaseId))
}

/** วัตถุดิบตั้งต้นสำหรับร้านหมึกย่าง/หอยแมลงภู่ — แก้ไขหรือลบได้ทีหลัง */
const STARTER_INGREDIENTS = [
  { name: 'ปลาหมึกสด', unit: 'กก.', category: 'fresh' },
  { name: 'หอยแมลงภู่', unit: 'กก.', category: 'fresh' },
  { name: 'ผักชี', unit: 'กำ', category: 'vegetable' },
  { name: 'ต้นหอม', unit: 'กำ', category: 'vegetable' },
  { name: 'พริกขี้หนู', unit: 'ขีด', category: 'vegetable' },
  { name: 'กระเทียม', unit: 'กก.', category: 'vegetable' },
  { name: 'ตะไคร้', unit: 'กำ', category: 'vegetable' },
  { name: 'ใบมะกรูด', unit: 'ขีด', category: 'vegetable' },
  { name: 'มะนาว', unit: 'กก.', category: 'vegetable' },
  { name: 'มะขามเปียก', unit: 'กก.', category: 'seasoning' },
  { name: 'น้ำปลา', unit: 'ขวด', category: 'seasoning' },
  { name: 'น้ำตาลปี๊บ', unit: 'กก.', category: 'seasoning' },
  { name: 'ซอสพริก', unit: 'ขวด', category: 'seasoning' },
  { name: 'เกลือ', unit: 'ถุง', category: 'seasoning' },
  { name: 'ถุงพลาสติก', unit: 'แพ็ค', category: 'packaging' },
  { name: 'กล่องโฟม', unit: 'แพ็ค', category: 'packaging' },
  { name: 'ไม้เสียบ', unit: 'ห่อ', category: 'packaging' },
  { name: 'ถ่าน', unit: 'กระสอบ', category: 'fuel' },
  { name: 'แก๊ส', unit: 'ถัง', category: 'fuel' },
]

export async function seedStarterIngredients() {
  const batch = writeBatch(db)
  STARTER_INGREDIENTS.forEach((item) => {
    batch.set(doc(collection(db, 'ingredients')), {
      ...item,
      is_active: true,
      last_price: null,
      stock_qty: 0,
      created_at: serverTimestamp(),
    })
  })
  await batch.commit()
}
