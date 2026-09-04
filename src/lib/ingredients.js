import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

export {
  COMMON_UNITS,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_BAR_COLORS,
  INGREDIENT_CATEGORY_ICONS,
} from './ingredientCategories'

export async function addIngredient({ name, unit, category }) {
  const ref = await addDoc(collection(db, 'ingredients'), {
    name: name.trim(),
    unit: unit || 'ชิ้น',
    category: category || 'other',
    is_active: true,
    last_price: null,
    created_at: serverTimestamp(),
  })
  return ref.id
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

  batch.update(doc(db, 'ingredients', ingredientId), {
    last_price: unitPrice,
    last_purchased_at: date,
  })

  await batch.commit()
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
      created_at: serverTimestamp(),
    })
  })
  await batch.commit()
}
