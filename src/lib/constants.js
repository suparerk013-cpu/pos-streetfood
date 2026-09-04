/** ค่าคงที่ที่ใช้ร่วมกันทั้งแอป — อย่าประกาศซ้ำในหน้าอื่น */

/** จำนวนที่ถือว่า "สต็อกต่ำ" (ใช้ <= ทุกที่) */
export const LOW_STOCK_THRESHOLD = 10
/** จำนวนที่ถือว่า "ใกล้หมด" — เตือนแรงกว่าสต็อกต่ำ */
export const CRITICAL_STOCK_THRESHOLD = 5

export const DELIVERY_PLATFORMS = ['GrabFood', 'LINE MAN', 'Shopee Food', 'Robinhood']

export const PLATFORM_ICONS = {
  GrabFood: '🟢',
  'LINE MAN': '🟡',
  'Shopee Food': '🟠',
  Robinhood: '🟣',
}

export const PLATFORM_BUTTON_BG = {
  GrabFood: 'bg-green-500',
  'LINE MAN': 'bg-lime-500',
  'Shopee Food': 'bg-orange-500',
  Robinhood: 'bg-purple-500',
}

export const PLATFORM_CARD_COLORS = {
  GrabFood: 'border-green-200 bg-green-50 focus:border-green-400 focus:ring-green-100',
  'LINE MAN': 'border-yellow-200 bg-yellow-50 focus:border-yellow-400 focus:ring-yellow-100',
  'Shopee Food': 'border-orange-200 bg-orange-50 focus:border-orange-400 focus:ring-orange-100',
  Robinhood: 'border-purple-200 bg-purple-50 focus:border-purple-400 focus:ring-purple-100',
}

/** ป้ายชื่อวิธีชำระเงินที่ใช้ทั้งบิล รายงาน และไฟล์ส่งออก */
export const METHOD_LABELS = {
  cash: 'เงินสด',
  promptpay: 'โมบายแบงค์กิ้ง',
  delivery: 'เดลิเวอรี่',
}

export const METHOD_SHORT = { cash: 'เงินสด', promptpay: 'โมบาย', delivery: 'เดลิ' }
export const METHOD_ICONS = { cash: '💵', promptpay: '📱', delivery: '🛵' }

/** ชื่อช่องทางที่อ่านออก ใช้ได้กับทั้ง payment ปกติและเดลิเวอรี */
export function paymentLabel(payment) {
  return payment.platform ?? METHOD_LABELS[payment.method] ?? payment.method
}

/** จำนวนบิลสูงสุดที่ดึงมาแสดงต่อครั้ง — กันค่า Firestore reads บานปลาย */
export const ORDER_PAGE_SIZE = 500

/**
 * หมวดสินค้าเก็บเป็นข้อความอิสระที่ผู้ใช้พิมพ์เอง แต่ข้อมูลชุดแรกถูก seed มาเป็น
 * สแลงอังกฤษ (squid / mussel) แล้วโผล่บนหน้าขายตรง ๆ — แปลงให้เป็นไทยตอนแสดงผล
 * โดยไม่ต้องแก้ข้อมูลเดิม ส่วนหมวดที่พิมพ์เป็นไทยอยู่แล้วจะผ่านไปตามเดิม
 */
const LEGACY_CATEGORY_LABELS = {
  squid: 'ปลาหมึก',
  mussel: 'หอยแมลงภู่',
  shrimp: 'กุ้ง',
  fish: 'ปลา',
  drink: 'เครื่องดื่ม',
  food: 'อาหาร',
  snack: 'ของทานเล่น',
  other: 'อื่นๆ',
}

export function productCategoryLabel(category) {
  if (!category) return 'อื่นๆ'
  return LEGACY_CATEGORY_LABELS[String(category).toLowerCase()] ?? category
}
