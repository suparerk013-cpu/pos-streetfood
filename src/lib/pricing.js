import { DEFAULT_GP_RATE, DEFAULT_PACKAGING_COST, TARGET_MARGIN } from './constants'

/**
 * ต้นทุนต่อหน่วยของสินค้า 1 ชิ้น
 *
 * ถ้าสินค้าผูกกับวัตถุดิบไว้ (ingredient_id + yield_per_unit) จะคิดจากราคาวัตถุดิบล่าสุด
 * เช่น หมึกสด 60 ฿/กก. เสียบได้ 20 ไม้ → 3 ฿/ไม้ แล้วบวกของประกอบ (ไม้เสียบ น้ำจิ้ม ถ่าน)
 * ราคาวัตถุดิบขึ้นลงเมื่อไหร่ ต้นทุนก็ขยับตามเอง ไม่ต้องมาแก้มือ
 */
export function unitCost(product, { ingredientById, consumableCost = 0 } = {}) {
  if (!product) return 0
  if (product.cost_override != null) return product.cost_override

  const yieldPerUnit = product.yield_per_unit
  const ingredient = product.ingredient_id ? ingredientById?.get(product.ingredient_id) : null
  const rawPrice = ingredient?.last_price
  const materialCost =
    yieldPerUnit > 0 && rawPrice > 0 ? rawPrice / yieldPerUnit : 0

  return materialCost + consumableCost
}

/** ต้นทุนของเซ็ต = ผลรวมต้นทุนส่วนประกอบ + ค่าบรรจุภัณฑ์ 1 ชุด */
export function bundleCost(bundle, { productById, ingredientById, consumableCost = 0, packagingCost = DEFAULT_PACKAGING_COST } = {}) {
  const components = bundle?.components ?? []
  const parts = components.reduce((sum, c) => {
    const product = productById?.get(c.product_id)
    return sum + unitCost(product, { ingredientById, consumableCost }) * (c.qty ?? 0)
  }, 0)
  return parts + packagingCost
}

/** จำนวนเซ็ตที่ทำได้จากสต็อกส่วนประกอบที่เหลืออยู่ — ตัวที่น้อยที่สุดเป็นตัวจำกัด */
export function bundleStock(bundle, productById) {
  const components = (bundle?.components ?? []).filter((c) => (c.qty ?? 0) > 0)
  if (components.length === 0) return 0
  return components.reduce((min, c) => {
    const stock = productById?.get(c.product_id)?.stock_qty ?? 0
    return Math.min(min, Math.floor(stock / c.qty))
  }, Infinity)
}

/** เงินที่เข้าจริงหลังแพลตฟอร์มหัก GP + ภาษี */
export function netAfterGp(grossAmount, gpRate = DEFAULT_GP_RATE) {
  return grossAmount * (1 - gpRate)
}

/**
 * ราคาเดลิเวอรีที่ควรตั้ง = ต้นทุน ÷ (1 − GP − กำไรเป้าหมาย)
 * ปัดขึ้นเป็นเลขลงท้าย 0 หรือ 5 ให้อ่านง่ายบนเมนู
 */
export function suggestDeliveryPrice(cost, gpRate = DEFAULT_GP_RATE, targetMargin = TARGET_MARGIN) {
  const divisor = 1 - gpRate - targetMargin
  if (divisor <= 0 || cost <= 0) return 0
  return roundUpToFive(cost / divisor)
}

export function roundUpToFive(value) {
  return Math.ceil(value / 5) * 5
}

/** กำไรจริงของการขาย 1 ชุด หลังหัก GP และต้นทุน */
export function profitOf({ price, cost, gpRate = 0 }) {
  const net = netAfterGp(price, gpRate)
  const profit = net - cost
  return {
    net,
    profit,
    margin: price > 0 ? profit / price : 0,
  }
}

/** ราคาต่ำสุดที่ยังไม่ขาดทุน (กำไร = 0) */
export function breakEvenPrice(cost, gpRate = DEFAULT_GP_RATE) {
  const divisor = 1 - gpRate
  if (divisor <= 0) return Infinity
  return cost / divisor
}
