/**
 * โปรโมชั่น "ซื้อ N แถม M" ผูกกับตัวสินค้า ตั้งได้หลายชั้น
 *
 * เช่นตั้งไว้ทั้ง "ซื้อ 10 แถม 1" และ "ซื้อ 20 แถม 3" พร้อมกัน
 * ระบบจะเลือกชุดที่ลูกค้าได้ของแถมมากที่สุดให้เอง — ซื้อ 30 ได้แถม 4 (20 แถม 3 + 10 แถม 1)
 *
 * จำนวนในตะกร้าคือ "ของที่ลูกค้ารับไปทั้งหมด" ไม่ใช่จำนวนที่คิดเงิน
 * คนขายกด 11 ไม้ตามที่ลูกค้าขอ ระบบแยกเองว่าคิดเงิน 10 แถม 1 = 100 บาท
 * ถ้าให้เลขที่กดเป็นจำนวนที่คิดเงิน คนขายจะกด 11 แล้วกลายเป็นเก็บ 110 แถมของอีก 1 ไม้ฟรี
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
 * แยกจำนวนที่ลูกค้ารับไป ออกเป็นจำนวนที่คิดเงินกับจำนวนที่แถม
 *
 * หาจำนวนที่คิดเงินน้อยที่สุดที่ "คิดเงิน + แถมที่ได้" ยังครอบคลุมของที่ลูกค้ารับไปครบ
 * ลูกค้าเอา 11 ไม้ กับโปร 10 แถม 1 → คิดเงิน 10 แถม 1
 * ลูกค้าเอา 20 ไม้ → คิดเงิน 19 แถม 1 เพราะซื้อ 19 ก็ได้แถม 1 ครบ 20 พอดีแล้ว
 *
 * แบ่งครึ่งหาได้เพราะ "คิดเงิน + แถม" ไม่มีทางลดลงเมื่อคิดเงินเพิ่ม
 */
export function splitPaidAndFree(product, totalQty, { channel = 'store' } = {}) {
  const total = Math.max(0, Math.floor(Number(totalQty) || 0))
  if (channel !== 'store' || !hasPromo(product) || total <= 0) return { paid: total, free: 0 }

  let low = 0
  let high = total
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (mid + freeQtyFor(product, mid) >= total) high = mid
    else low = mid + 1
  }
  return { paid: low, free: total - low }
}

/**
 * แตกตะกร้าเป็นบรรทัดที่คิดเงินกับบรรทัดของแถม สำหรับออกบิล
 *
 * คิดทีละบรรทัดได้เพราะสินค้าหนึ่งตัวมีได้บรรทัดเดียวในตะกร้า
 * (คีย์ของบรรทัดคือ product id ตั้งแต่เลิกใช้ตัวเลือกความเผ็ด/น้ำจิ้ม)
 */
export function splitCart(cart = [], productById, { channel = 'store' } = {}) {
  const paidLines = []
  const freeLines = []

  cart.forEach((item) => {
    const product = productById?.get(item.productId)
    const { paid, free } = splitPaidAndFree(product, item.quantity, { channel })
    if (paid > 0) paidLines.push({ ...item, quantity: paid })
    if (free > 0) {
      freeLines.push({
        key: `free|${item.key}`,
        productId: item.productId,
        name: item.name,
        unit: item.unit ?? 'ชิ้น',
        price: 0,
        quantity: free,
        modifiers: {},
        isFree: true,
      })
    }
  })

  return { paidLines, freeLines }
}

/** ยอดที่ต้องเก็บจริงจากตะกร้า — หักของแถมออกแล้ว */
export function cartSubtotal(cart = [], productById, { channel = 'store' } = {}) {
  return splitCart(cart, productById, { channel }).paidLines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  )
}

/** ข้อมูลของแถวเดียวในตะกร้า ใช้แสดงราคาและป้าย "แถม N" */
export function lineBreakdown(item, product, { channel = 'store' } = {}) {
  const { paid, free } = splitPaidAndFree(product, item?.quantity, { channel })
  return { paid, free, lineTotal: paid * (item?.price ?? 0) }
}

/** จำนวนที่ต้องตัดสต็อกต่อสินค้า = จำนวนในตะกร้า เพราะนับรวมของแถมอยู่แล้ว */
export function effectiveQtyByProduct(cart = []) {
  const map = new Map()
  cart.forEach((item) => map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity))
  return map
}
