import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const INITIAL_PRODUCTS = [
  {
    id: 'prod_squid_01',
    name: 'ปลาหมึกย่าง (เนื้อล้วน)',
    category: 'ปลาหมึก',
    price: 40,
    is_active: true,
    stock_type: 'batch',
    stock_qty: 0,
    modifiers: {
      spice_level: ['เผ็ดมาก', 'ปานกลาง', 'น้อย', 'ไม่เผ็ด'],
      sauce: ['ซีฟู้ด', 'หวาน', 'ผสม'],
    },
    sort_order: 1,
  },
  {
    id: 'prod_mussel_01',
    name: 'หอยแมลงภู่นึ่ง',
    category: 'หอยแมลงภู่',
    price: 60,
    is_active: true,
    stock_type: 'daily',
    stock_qty: 0,
    modifiers: {
      sauce: ['ซีฟู้ด', 'หวาน', 'ผสม'],
    },
    sort_order: 2,
  },
]

export async function seedInitialProducts() {
  await Promise.all(
    INITIAL_PRODUCTS.map(({ id, ...data }) => setDoc(doc(db, 'products', id), data)),
  )
}
