/**
 * คณิตศาสตร์ของน้ำจิ้มที่ทำเอง — ไม่แตะฐานข้อมูล
 *
 * แยกออกจาก sauces.js เพราะ pricing.js ต้องใช้ตัวคิดต้นทุน แต่ pricing.js ถูก
 * เรียกจากทุกหน้าและจากเทสต์ที่ไม่ได้ต่อ Firebase ถ้าลากไฟล์ที่ import firebase
 * เข้ามาด้วย เทสต์ต้นทุนจะพังทั้งที่ไม่ได้ยุ่งกับฐานข้อมูลเลย
 */

export const SAUCE_ICONS = ['🍲', '🦑', '🌶️', '🥣', '🧄', '🍋', '🥄', '🫙']

/**
 * ราคาของวัตถุดิบ 1 บรรทัดในสูตร
 *
 * ปกติคิดตรง ๆ จากราคาที่ซื้อมาล่าสุด × ปริมาณที่ใส่
 * แต่ของอย่างน้ำปลาหรือน้ำมะขามเปียก 1 ขวดใช้ได้หลายหม้อ ถ้าคิดทั้งขวด
 * ต้นทุนหม้อเดียวจะพองขึ้นมาเกินจริง จึงหารด้วยจำนวนหม้อที่ขวดนั้นใช้ได้ก่อน
 */
export function lineAmount(line, ingredientById) {
  const price = Number(ingredientById?.get(line?.ingredient_id)?.last_price) || 0
  const qty = Number(line?.qty) || 0
  const perBatch = Math.max(0, Math.floor(Number(line?.per_batch) || 0))
  if (price <= 0 || qty <= 0) return 0
  return perBatch > 0 ? (price / perBatch) * qty : price * qty
}

/** วัตถุดิบที่ยังไม่เคยบันทึกราคาซื้อ คิดต้นทุนไม่ได้ ต้องเตือนให้ไปบันทึกซื้อก่อน */
export function linesMissingPrice(lines = [], ingredientById) {
  return lines.filter((line) => {
    if (!line?.ingredient_id || !(Number(line?.qty) > 0)) return false
    return !(Number(ingredientById?.get(line.ingredient_id)?.last_price) > 0)
  })
}

/**
 * สรุปต้นทุน 1 หม้อ
 *
 * costPerServe คือตัวเลขที่เอาไปบวกในต้นทุนสินค้า ส่วน costPerYield ไว้ดูเทียบกัน
 * ว่าหม้อนี้แพงกว่าหม้อก่อนไหม เพราะจำนวนกิโลที่ได้แต่ละครั้งไม่เท่ากัน
 */
export function batchTotals(lines = [], { yieldQty, serves, ingredientById } = {}) {
  const resolved = lines
    .filter((line) => line?.ingredient_id && Number(line?.qty) > 0)
    .map((line) => {
      const ingredient = ingredientById?.get(line.ingredient_id)
      return {
        ingredient_id: line.ingredient_id,
        ingredient_name: line.ingredient_name ?? ingredient?.name ?? '',
        unit: line.unit ?? ingredient?.unit ?? 'ชิ้น',
        qty: Number(line.qty) || 0,
        per_batch: Math.max(0, Math.floor(Number(line.per_batch) || 0)) || null,
        unit_price: Number(ingredient?.last_price) || 0,
        amount: round2(lineAmount(line, ingredientById)),
      }
    })

  const totalCost = round2(resolved.reduce((sum, line) => sum + line.amount, 0))
  const yieldNum = Number(yieldQty) || 0
  const servesNum = Math.floor(Number(serves) || 0)

  return {
    lines: resolved,
    totalCost,
    yieldQty: yieldNum,
    serves: servesNum,
    costPerYield: yieldNum > 0 ? round2(totalCost / yieldNum) : 0,
    costPerServe: servesNum > 0 ? round4(totalCost / servesNum) : 0,
  }
}

/** ต้นทุนน้ำจิ้มต่อชิ้นของสูตรหนึ่ง — 0 ถ้ายังไม่เคยบันทึกหม้อ */
export function saucePerServe(sauce) {
  return Number(sauce?.last_batch?.cost_per_serve) || 0
}

/**
 * ต้นทุนน้ำจิ้มของสินค้า 1 ชิ้น
 *
 * แยกออกมาเป็นฟังก์ชันเพราะ pricing.js เรียกใช้ และหน้าจอต่าง ๆ ก็ต้องโชว์
 * ให้เห็นว่าต้นทุนก้อนนี้มาจากไหน ถ้าปิดระบบน้ำจิ้มไว้จะไม่ส่ง sauceById เข้ามา
 * ค่าที่ได้จึงเป็น 0 และต้นทุนกลับไปเท่ากับก่อนติดตั้งระบบนี้พอดี
 */
export function sauceCostFor(product, sauceById) {
  if (!product?.sauce_id || !sauceById) return 0
  return saucePerServe(sauceById.get(product.sauce_id))
}

function round2(value) {
  return Math.round(value * 100) / 100
}

/** ต้นทุนต่อชิ้นมักเป็นหลักสตางค์ ปัดแค่ 2 ตำแหน่งจะกลายเป็น 0 ทั้งที่ของจริงไม่ใช่ */
function round4(value) {
  return Math.round(value * 10000) / 10000
}

/** เก็บเฉพาะบรรทัดที่เลือกวัตถุดิบและใส่จำนวนแล้ว จะได้ไม่มีแถวว่างค้างในเอกสาร */
export function cleanRecipe(recipe = []) {
  return recipe
    .filter((line) => line?.ingredient_id && Number(line?.qty) > 0)
    .map((line) => ({
      ingredient_id: line.ingredient_id,
      ingredient_name: line.ingredient_name ?? '',
      unit: line.unit ?? 'ชิ้น',
      qty: Number(line.qty),
      per_batch: Math.max(0, Math.floor(Number(line.per_batch) || 0)) || null,
    }))
}
