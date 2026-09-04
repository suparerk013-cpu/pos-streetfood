/** สินค้าแบบเซ็ต — ประกอบจากสินค้าที่ขายอยู่แล้ว ตัดสต็อกที่ส่วนประกอบ ไม่ใช่ที่ตัวเซ็ต */

export function isBundle(product) {
  return Boolean(product?.is_bundle && (product?.components?.length ?? 0) > 0)
}

/**
 * สินค้าที่ขายได้ในช่องทางที่ระบุ
 *
 * เดลิเวอรีขายเฉพาะสินค้าจัดเซ็ตเท่านั้น — ขายไม้เดี่ยวที่ราคาหน้าร้านแล้วโดนหัก GP
 * กับภาษีจะเหลือกำไรไม่พอ เซ็ตถูกตั้งราคาเผื่อ GP ไว้แล้วตั้งแต่ตอนสร้าง
 */
export function sellableIn(products, channel) {
  return products.filter((p) => {
    if (p.is_active === false) return false
    // สินค้าเดี่ยวเป็นของหน้าร้านเสมอ ไม่ว่าจะเคยตั้ง channel ไว้อย่างไร
    // ถ้าอ่าน channel ของสินค้าเดี่ยวต่อไป ตัวที่เคยตั้งเป็น 'delivery' จะหายจากทั้งสองหน้า
    if (!isBundle(p)) return channel === 'store'
    const c = p.channel ?? 'both'
    return c === 'both' || c === channel
  })
}

/** ราคาที่ใช้ในช่องทางนั้น — เดลิเวอรีใช้ delivery_price ถ้าตั้งไว้ */
export function priceFor(product, channel) {
  if (channel === 'delivery') {
    const dp = product.delivery_price ?? product.delivery_prices?.[Object.keys(product.delivery_prices ?? {})[0]]
    if (dp > 0) return dp
  }
  return product.price ?? 0
}

/** สินค้าที่ตั้งราคาเดลิเวอรีไว้หรือยัง — ใช้เตือนก่อนขายราคาหน้าร้านโดยไม่ตั้งใจ */
export function missingDeliveryPrice(product) {
  return !(product.delivery_price > 0)
}

/**
 * กระจายรายการในตะกร้าให้เป็นจำนวนสินค้าจริงที่ต้องตัดสต็อก
 * เซ็ต 8 ไม้ 2 ชุด → ปลาหมึกย่าง 16 ไม้
 */
export function expandToStockUnits(lines, productById) {
  const map = new Map()
  const add = (id, qty) => map.set(id, (map.get(id) ?? 0) + qty)

  lines.forEach((line) => {
    const product = productById?.get(line.productId)
    if (isBundle(product)) {
      product.components.forEach((c) => add(c.product_id, (c.qty ?? 0) * line.quantity))
    } else {
      add(line.productId, line.quantity)
    }
  })
  return map
}
