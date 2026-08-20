import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export const EXPENSE_CATEGORY_LABELS = {
  utility_water: 'ค่าน้ำ',
  utility_electric: 'ค่าไฟ',
  rent: 'ค่าเช่า',
  raw_material: 'ค่าวัตถุดิบ',
  labor: 'ค่าแรง',
  other: 'อื่นๆ',
}

export function toDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function createExpense({ category, amount, note, date }) {
  await addDoc(collection(db, 'expenses'), {
    category,
    amount,
    note: note || null,
    date,
    source: 'manual',
    related_stock_log_id: null,
    created_at: serverTimestamp(),
  })
}
