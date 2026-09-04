/** หมวดและหน่วยของวัตถุดิบ — แยกจาก ingredients.js เพื่อให้ import ได้โดยไม่ดึง Firebase มาด้วย */

export const INGREDIENT_CATEGORIES = {
  fresh: 'ของสด',
  vegetable: 'ผัก/สมุนไพร',
  seasoning: 'เครื่องปรุง',
  packaging: 'บรรจุภัณฑ์',
  fuel: 'แก๊ส/ถ่าน',
  other: 'อื่นๆ',
}

export const INGREDIENT_CATEGORY_ICONS = {
  fresh: '🦑',
  vegetable: '🌿',
  seasoning: '🥄',
  packaging: '📦',
  fuel: '🔥',
  other: '📝',
}

export const INGREDIENT_CATEGORY_BAR_COLORS = {
  fresh: 'bg-blue-400',
  vegetable: 'bg-green-400',
  seasoning: 'bg-amber-400',
  packaging: 'bg-purple-400',
  fuel: 'bg-orange-400',
  other: 'bg-gray-300',
}

/** หน่วยนับที่ใช้บ่อยในตลาดสด */
export const COMMON_UNITS = ['กก.', 'ขีด', 'กำ', 'ถุง', 'ขวด', 'แพ็ค', 'ห่อ', 'กระสอบ', 'ถัง', 'ลูก', 'ชิ้น']
