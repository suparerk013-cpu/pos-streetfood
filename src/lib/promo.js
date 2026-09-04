/**
 * โปรโมชั่น "ซื้อ N แถม M" ผูกกับตัวสินค้า
 *
 * ตั้งคู่เดียวแล้วทวีคูณเอง — ตั้ง 10 แถม 1 ไว้ พอลูกค้าซื้อ 20 จะได้ฟรี 2 อัตโนมัติ
 * ใช้เฉพาะช่องทางหน้าร้าน เพราะบนเดลิเวอรีโดนหัก GP อยู่แล้ว แถมอีกจะเหลือกำไรน้อยเกินไป
 */

export function hasPromo(product) {
  return Boolean(product?.promo_buy_qty > 0 && product?.promo_free_qty > 0)
}

/** ของแถมที่ได้จากจำนวนที่ซื้อจริง */
export function freeQtyFor(product, paidQty) {
  if (!hasPromo(product) || paidQty <= 0) return 0
  return Math.floor(paidQty / product.promo_buy_qty) * product.promo_free_qty
}

/** จำนวนที่ต้องซื้อเพิ่มอีกกี่ชิ้นถึงจะได้ของแถมชิ้นถัดไป (ใช้บอกลูกค้าหน้าร้าน) */
export function qtyToNextFree(product, paidQty) {
  if (!hasPromo(product)) return null
  const remainder = paidQty % product.promo_buy_qty
  if (remainder === 0 && paidQty > 0) return 0
  return product.promo_buy_qty - remainder
}

/**
 * แถวของแถมที่จะเพิ่มลงบิล — ราคา 0 แต่ยังตัดสต็อกเต็มจำนวน
 * คิดจากยอดรวมต่อสินค้า ไม่ใช่ต่อแถวในตะกร้า เพราะสินค้าเดียวกันอาจแยกแถวตามตัวเลือก
 */
export function buildFreeLines(cart, productById, { channel = 'store' } = {}) {
  if (channel !== 'store') return []

  const paidByProduct = new Map()
  cart.forEach((item) => {
    if (item.isFree) return
    paidByProduct.set(item.productId, (paidByProduct.get(item.productId) ?? 0) + item.quantity)
  })

  const lines = []
  paidByProduct.forEach((paidQty, productId) => {
    const product = productById?.get(productId)
    const qty = freeQtyFor(product, paidQty)
    if (qty <= 0) return
    lines.push({
      key: `free|${productId}`,
      productId,
      name: product.name,
      unit: product.unit ?? 'ชิ้น',
      price: 0,
      quantity: qty,
      modifiers: {},
      isFree: true,
    })
  })
  return lines
}

/** จำนวนที่ต้องตัดสต็อกจริงต่อสินค้า = ที่ขาย + ที่แถม */
export function effectiveQtyByProduct(cart, productById, { channel = 'store' } = {}) {
  const map = new Map()
  const add = (id, qty) => map.set(id, (map.get(id) ?? 0) + qty)
  cart.forEach((item) => add(item.productId, item.quantity))
  buildFreeLines(cart, productById, { channel }).forEach((line) => add(line.productId, line.quantity))
  return map
}

/**
 * ซื้อได้สูงสุดกี่ชิ้นจากสต็อกที่มี เมื่อคิดของแถมเข้าไปด้วย
 * สต็อก 11 กับโปร 10 แถม 1 → ซื้อได้ 10 เพราะชิ้นที่ 11 ต้องกันไว้แถม
 */
export function maxPaidQty(product, stockQty, { channel = 'store' } = {}) {
  if (!Number.isFinite(stockQty)) return Infinity
  if (channel !== 'store' || !hasPromo(product)) return stockQty
  const { promo_buy_qty: buy, promo_free_qty: free } = product
  const perGroup = buy + free
  const groups = Math.floor(stockQty / perGroup)
  const leftover = stockQty - groups * perGroup
  return groups * buy + Math.min(leftover, buy)
}
