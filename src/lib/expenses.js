import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export { toDateString } from './dates'

/** ค่าใช้จ่ายคงที่ของร้าน — ค่าวัตถุดิบย้ายไปอยู่ใน purchases แล้ว (ดู lib/ingredients.js) */
export const EXPENSE_CATEGORY_LABELS = {
  utility_water: 'ค่าน้ำ',
  utility_electric: 'ค่าไฟ',
  rent: 'ค่าเช่า',
  labor: 'ค่าแรง',
  other: 'อื่นๆ',
}

export const EXPENSE_CATEGORY_COLORS = {
  utility_water: 'bg-blue-100 text-blue-700',
  utility_electric: 'bg-yellow-100 text-yellow-700',
  rent: 'bg-purple-100 text-purple-700',
  labor: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
  raw_material: 'bg-orange-100 text-orange-700',
}

export const EXPENSE_CATEGORY_ICONS = {
  utility_water: '💧',
  utility_electric: '⚡',
  rent: '🏠',
  labor: '👷',
  other: '📝',
  raw_material: '🥩',
}

/** ป้ายชื่อของหมวดใด ๆ รวมถึง raw_material เดิมที่ยังมีข้อมูลเก่าค้างอยู่ */
export function expenseCategoryLabel(category) {
  if (category === 'raw_material') return 'วัตถุดิบ (รายการเก่า)'
  return EXPENSE_CATEGORY_LABELS[category] ?? 'อื่นๆ'
}

export async function createExpense({ category, custom_label, amount, note, date }) {
  await addDoc(collection(db, 'expenses'), {
    category,
    custom_label: custom_label || null,
    amount,
    note: note || null,
    date,
    source: 'manual',
    created_at: serverTimestamp(),
  })
}

export function deleteExpense(expenseId) {
  return deleteDoc(doc(db, 'expenses', expenseId))
}
