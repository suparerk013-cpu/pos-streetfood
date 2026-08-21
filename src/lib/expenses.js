import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export const EXPENSE_CATEGORY_LABELS = {
  raw_material: 'วัตถุดิบ',
  utility_water: 'ค่าน้ำ',
  utility_electric: 'ค่าไฟ',
  rent: 'ค่าเช่า',
  labor: 'ค่าแรง',
  other: 'อื่นๆ',
}

export const EXPENSE_CATEGORY_COLORS = {
  raw_material: 'bg-orange-100 text-orange-700',
  utility_water: 'bg-blue-100 text-blue-700',
  utility_electric: 'bg-yellow-100 text-yellow-700',
  rent: 'bg-purple-100 text-purple-700',
  labor: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
}

export function toDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function createExpense({ category, custom_label, amount, note, date }) {
  await addDoc(collection(db, 'expenses'), {
    category,
    custom_label: custom_label || null,
    amount,
    note: note || null,
    date,
    source: 'manual',
    related_stock_log_id: null,
    created_at: serverTimestamp(),
  })
}
