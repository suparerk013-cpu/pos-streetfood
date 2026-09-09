/**
 * ค้นหาสินค้าในหน้าขาย
 *
 * ค้นจากชื่อ หมวดหมู่ และหน่วยนับ — พิมพ์ "ปลาหมึก" ก็เจอทั้งหมวด
 * พิมพ์หลายคำคั่นช่องว่างต้องเจอครบทุกคำ แต่ไม่ต้องเรียงติดกัน
 * เพราะคนขายพิมพ์เร็ว ๆ ตอนลูกค้ายืนรอ มักพิมพ์คำโดด ๆ ที่จำได้ก่อน
 */

/** ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ และไม่สนตัวพิมพ์ใหญ่เล็ก */
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesQuery(product, query) {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return true

  const haystack = normalize(
    [product?.name, product?.category, product?.unit].filter(Boolean).join(' '),
  )
  return words.every((word) => haystack.includes(word))
}

export function searchProducts(products = [], query) {
  if (normalize(query) === '') return products
  return products.filter((product) => matchesQuery(product, query))
}
