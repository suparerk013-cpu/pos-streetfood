/**
 * โปรโมชั่น "ซื้อ N แถม M" ผูกกับตัวสินค้า ตั้งได้หลายชั้น
 *
 * เช่นตั้งไว้ทั้ง "ซื้อ 10 แถม 1" และ "ซื้อ 20 แถม 3" พร้อมกัน
 * ระบบจะเลือกชุดที่ลูกค้าได้ของแถมมากที่สุดให้เอง — ซื้อ 30 ได้แถม 4 (20 แถม 3 + 10 แถม 1)
 *
 * ใช้เฉพาะช่องทางหน้าร้าน เพราะบนเดลิเวอรีโดนหัก GP อยู่แล้ว แถมอีกจะเหลือกำไรน้อยเกินไป
 */

/** กันไม่ให้จองอาร์เรย์ยักษ์ถ้าจำนวนเพี้ยน — ของจริงไม่มีทางขายทีเดียวเกินนี้ */
const MAX_QTY = 10000

/**
 * อ่านโปรทั้งหมดของสินค้า เรียงชั้นใหญ่ก่อน
 *
 * รองรับข้อมูลเก่าที่เก็บเป็น promo_buy_qty / promo_free_qty คู่เดียว
 * สินค้าที่ตั้งโปรไว้ก่อนหน้านี้จึงยังทำงานเหมือนเดิมโดยไม่ต้องแก้ในฐานข้อมูล
 */
export function promoTiers(product) {
  const raw = Array.isArray(product?.promos)
    ? product.promos
    : [{ buy: product?.promo_buy_qty, free: product?.promo_free_qty }]

  return raw
    .map((tier) => ({
      buy: Math.floor(Number(tier?.buy) || 0),
      free: Math.floor(Number(tier?.free) || 0),
    }))
    .filter((tier) => tier.buy > 0 && tier.free > 0)
    .sort((a, b) => b.buy - a.buy)
}

export function hasPromo(product) {
  return promoTiers(product).length > 0
}

/**
 * ของแถมที่ได้จากจำนวนที่ซื้อจริง
 *
 * ไล่หาคำตอบที่ดีที่สุดทีละจำนวน แทนที่จะหักชั้นใหญ่ก่อนแบบตรงไปตรงมา
 * เพราะถ้าตั้งโปรที่ชั้นเล็กคุ้มกว่าชั้นใหญ่ (เช่น ซื้อ 3 แถม 2 คู่กับ ซื้อ 5 แถม 1)
 * การหักชั้นใหญ่ก่อนจะทำให้ซื้อ 5 ชิ้นได้ของแถมน้อยกว่าซื้อ 4 ชิ้น ซึ่งลูกค้ารับไม่ได้
 */
export function freeQtyFor(product, paidQty) {
  const tiers = promoTiers(product)
  const qty = Math.floor(Number(paidQty) || 0)
  if (qty <= 0 || qty > MAX_QTY || tiers.length === 0) return 0

  // best[q] = ของแถมมากที่สุดที่เป็นไปได้เมื่อซื้อ q ชิ้น
  const best = new Array(qty + 1).fill(0)
  for (let q = 1; q <= qty; q += 1) {
    let value = best[q - 1] // ซื้อเพิ่มแต่ยังไม่ครบชุดถัดไป ของแถมเท่าเดิม
    for (const { buy, free } of tiers) {
      if (q >= buy) value = Math.max(value, best[q - buy] + free)
    }
    best[q] = value
  }
  return best[qty]
}

/** ต้องซื้อเพิ่มอีกกี่ชิ้นถึงจะได้ของแถมเพิ่ม (ใช้บอกลูกค้าหน้าร้าน) */
export function qtyToNextFree(product, paidQty) {
  const tiers = promoTiers(product)
  if (tiers.length === 0) return null

  const current = freeQtyFor(product, paidQty)
  const largestBuy = tiers[0].buy
  for (let step = 1; step <= largestBuy; step += 1) {
    if (freeQtyFor(product, paidQty + step) > current) return step
  }
  return null
}

/**
 * แถวของแถมที่จะเพิ่มลงบิล — ราคา 0 แต่ยังตัดสต็อกเต็มจำนวน
 * คิดจากยอดรวมต่อสินค้า ไม่ใช่ต่อแถวในตะกร้า เพราะสินค้าเดียวกันอาจแยกแถวได้
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
 *
 * หาด้วยการแบ่งครึ่งได้ เพราะ "ซื้อ + แถม" ไม่มีทางลดลงเมื่อซื้อเพิ่มขึ้น
 */
export function maxPaidQty(product, stockQty, { channel = 'store' } = {}) {
  if (!Number.isFinite(stockQty)) return Infinity
  if (channel !== 'store' || !hasPromo(product)) return stockQty

  let low = 0
  let high = Math.max(0, Math.floor(stockQty))
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (mid + freeQtyFor(product, mid) <= stockQty) low = mid
    else high = mid - 1
  }
  return low
}
