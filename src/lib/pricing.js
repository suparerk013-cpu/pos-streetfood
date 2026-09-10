import { DEFAULT_GP_RATE, DEFAULT_PACKAGING_COST, TARGET_MARGIN } from './constants'
import { sauceCostFor } from './sauceCost'

/**
 * ต้นทุนต่อหน่วยของสินค้า 1 ชิ้น
 *
 * ประกอบด้วยสามก้อน — วัตถุดิบหลัก น้ำจิ้มที่ทำเอง และของประกอบ
 *
 * วัตถุดิบหลักคิดจากราคาที่ซื้อมาล่าสุดหารด้วยจำนวนที่ทำได้ต่อหน่วย
 * เช่น หมึกสด 60 ฿/กก. เสียบได้ 20 ไม้ → 3 ฿/ไม้ ราคาหมึกขึ้นลงเมื่อไหร่ต้นทุนขยับตามเอง
 *
 * น้ำจิ้มคิดจากหม้อล่าสุดที่บันทึกไว้ในแท็บน้ำจิ้ม จะถูกบวกก็ต่อเมื่อส่ง sauceById เข้ามา
 * ถ้าปิดระบบน้ำจิ้มในหน้าตั้งค่า จะไม่มีใครส่งเข้ามา ต้นทุนกลับไปเท่าเดิมทุกบาท
 *
 * ของประกอบเป็นเลขเหมาที่ตั้งเองในหน้าตั้งค่า สำหรับไม้เสียบ ถ่าน ถุง
 */
export function unitCost(product, { ingredientById, consumableCost = 0, sauceById = null } = {}) {
  if (!product) return 0
  if (product.cost_override != null) return product.cost_override

  const yieldPerUnit = product.yield_per_unit
  const ingredient = product.ingredient_id ? ingredientById?.get(product.ingredient_id) : null
  const rawPrice = ingredient?.last_price
  const materialCost =
    yieldPerUnit > 0 && rawPrice > 0 ? rawPrice / yieldPerUnit : 0

  return materialCost + sauceCostFor(product, sauceById) + consumableCost
}

/** แยกต้นทุนออกเป็นก้อน ๆ ให้เห็นว่าเงินหายไปกับอะไร ใช้ตอนตั้งราคาสินค้า */
export function costBreakdown(product, { ingredientById, consumableCost = 0, sauceById = null } = {}) {
  if (product?.cost_override != null) {
    return { material: 0, sauce: 0, consumable: 0, override: product.cost_override, total: product.cost_override }
  }

  const ingredient = product?.ingredient_id ? ingredientById?.get(product.ingredient_id) : null
  const rawPrice = Number(ingredient?.last_price) || 0
  const yieldPerUnit = Number(product?.yield_per_unit) || 0
  const material = yieldPerUnit > 0 && rawPrice > 0 ? rawPrice / yieldPerUnit : 0
  const sauce = sauceCostFor(product, sauceById)

  return {
    material,
    sauce,
    consumable: consumableCost,
    override: null,
    total: material + sauce + consumableCost,
    ingredientName: ingredient?.name ?? null,
    ingredientUnit: ingredient?.unit ?? null,
    ingredientPrice: rawPrice,
  }
}

/** ต้นทุนของเซ็ต = ผลรวมต้นทุนส่วนประกอบ + ค่าบรรจุภัณฑ์ 1 ชุด */
export function bundleCost(bundle, { productById, ingredientById, consumableCost = 0, sauceById = null, packagingCost = DEFAULT_PACKAGING_COST } = {}) {
  const components = bundle?.components ?? []
  const parts = components.reduce((sum, c) => {
    const product = productById?.get(c.product_id)
    return sum + unitCost(product, { ingredientById, consumableCost, sauceById }) * (c.qty ?? 0)
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
