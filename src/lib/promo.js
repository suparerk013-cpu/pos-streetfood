/**
 * โปรโมชั่น "ซื้อ N แถม M" ผูกกับตัวสินค้า ตั้งได้หลายชั้น
 *
 * เช่นตั้งไว้ทั้ง "ซื้อ 10 แถม 1" และ "ซื้อ 20 แถม 3" พร้อมกัน
 * ระบบจะเลือกชุดที่ลูกค้าได้ของแถมมากที่สุดให้เอง — ซื้อ 30 ได้แถม 4 (20 แถม 3 + 10 แถม 1)
 *
 * เลขที่คนขายกดคือ "จำนวนที่ลูกค้าขอ" ระบบคิดเงินให้เอง และลูกค้าได้ของแถมเต็มสิทธิ์เสมอ
 * กด 10 หรือกด 11 ได้ผลเหมือนกัน — เก็บ 100 บาท ส่งของ 11 ไม้ คนขายกดเลขไหนก็ไม่ผิด
 * ถ้าให้เลขที่กดเป็นจำนวนที่คิดเงินตรง ๆ กด 11 จะกลายเป็นเก็บ 110 แล้วแถมอีก 1 ไม้ฟรี
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
export function splitPaidAndFree(product, askedQty, { channel = 'store' } = {}) {
  const asked = Math.max(0, Math.floor(Number(askedQty) || 0))
  if (channel !== 'store' || !hasPromo(product) || asked <= 0) {
    return { paid: asked, free: 0, total: asked }
  }

  let low = 0
  let high = asked
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (mid + freeQtyFor(product, mid) >= asked) high = mid
    else low = mid + 1
  }

  // ของแถมให้เต็มสิทธิ์ของจำนวนที่คิดเงินเสมอ ไม่ตัดให้พอดีกับที่ลูกค้าขอ
  // ลูกค้าขอ 10 ไม้ จ่ายครบ 10 แล้วก็ต้องได้แถม 1 รวมเป็น 11 ไม้
  const free = freeQtyFor(product, low)
  return { paid: low, free, total: low + free }
}

/**
 * กดได้สูงสุดกี่ชิ้นจากสต็อกที่มี เมื่อคิดของแถมที่ต้องส่งมอบด้วย
 *
 * สต็อก 10 ไม้ กับโปร 10 แถม 1 กดได้แค่ 9 เพราะถ้ากด 10 ต้องส่งของ 11 ไม้
 * ซึ่งไม่มีในสต็อก ต้องเติมของก่อนถึงจะขายโปรได้
 */
export function maxKeyableQty(product, stockQty, { channel = 'store' } = {}) {
  if (!Number.isFinite(stockQty)) return Infinity
  const stock = Math.max(0, Math.floor(stockQty))
  if (channel !== 'store' || !hasPromo(product)) return stock

  let low = 0
  let high = stock
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (mid + freeQtyFor(product, mid) <= stock) low = mid
    else high = mid - 1
  }
  return low + freeQtyFor(product, low)
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

/** ข้อมูลของแถวเดียวในตะกร้า ใช้แสดงราคา ป้าย "แถม N" และจำนวนที่ต้องส่งมอบ */
export function lineBreakdown(item, product, { channel = 'store' } = {}) {
  const { paid, free, total } = splitPaidAndFree(product, item?.quantity, { channel })
  return { paid, free, total, lineTotal: paid * (item?.price ?? 0) }
}

/** จำนวนที่ต้องตัดสต็อกต่อสินค้า = ที่คิดเงิน + ที่แถม */
export function effectiveQtyByProduct(cart = [], productById, { channel = 'store' } = {}) {
  const map = new Map()
  cart.forEach((item) => {
    const product = productById?.get(item.productId)
    const { total } = splitPaidAndFree(product, item.quantity, { channel })
    map.set(item.productId, (map.get(item.productId) ?? 0) + total)
  })
  return map
}
