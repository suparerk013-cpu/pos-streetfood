/**
 * คณิตศาสตร์ของน้ำจิ้มที่ทำเอง — ไม่แตะฐานข้อมูล
 *
 * แยกออกจาก sauces.js เพราะ pricing.js ต้องใช้ตัวคิดต้นทุน แต่ pricing.js ถูก
 * เรียกจากทุกหน้าและจากเทสต์ที่ไม่ได้ต่อ Firebase ถ้าลากไฟล์ที่ import firebase
 * เข้ามาด้วย เทสต์ต้นทุนจะพังทั้งที่ไม่ได้ยุ่งกับฐานข้อมูลเลย
 */

export const SAUCE_ICONS = ['🍲', '🦑', '🌶️', '🥣', '🧄', '🍋', '🥄', '🫙']

/**
 * ปริมาณของบรรทัดนี้ แปลงกลับเป็นหน่วยที่ซื้อมา
 *
 * ตอนทำอาหารคนตวงเป็นหน่วยย่อย — น้ำปลาซื้อเป็นขวดแต่ตวงเป็นมิลลิลิตร
 * ถ้าบังคับให้กรอกเป็น "0.1 ขวด" คนทำต้องมานั่งคิดเลขเองทุกครั้งแล้วก็กรอกผิด
 * ระบบจึงให้กรอกด้วยหน่วยที่ตวงจริง แล้วหารด้วยปริมาณต่อขวดกลับมาเป็นเศษขวดให้เอง
 *
 * ทั้งราคาและสต็อกคิดจากตัวเลขนี้ตัวเดียว จะได้ไม่มีทางที่สองอย่างนี้ไม่ตรงกัน
 */
export function lineBaseQty(line, ingredientById) {
  const qty = Math.max(0, Number(line?.qty) || 0)
  if (qty <= 0) return 0

  // ข้อมูลเก่าที่เคยกรอกแบบ "1 ขวดใช้ได้กี่หม้อ" ก่อนจะมีปริมาณต่อขวด
  const perBatch = Math.max(0, Math.floor(Number(line?.per_batch) || 0))
  if (perBatch > 0) return qty / perBatch

  const ingredient = ingredientById?.get(line?.ingredient_id)
  const entryUnit = line?.entry_unit
  if (!entryUnit || entryUnit === (ingredient?.unit ?? '')) return qty

  // ใช้ปริมาณที่บันทึกติดมากับบรรทัดก่อน เพราะหม้อเก่าต้องคงต้นทุนเดิมไว้
  // ถึงจะไปเปลี่ยนขนาดขวดในทะเบียนวัตถุดิบทีหลัง ประวัติก็ต้องไม่ขยับตาม
  const divisor = Number(line?.content_qty) || Number(ingredient?.content_qty) || 0
  return divisor > 0 ? qty / divisor : qty
}

/**
 * ราคาของวัตถุดิบ 1 บรรทัดในสูตร
 *
 * ราคาที่ซื้อมาเป็นราคาต่อหน่วยที่ซื้อ (฿ ต่อขวด) จึงต้องคูณกับปริมาณในหน่วยเดียวกัน
 */
export function lineAmount(line, ingredientById) {
  const price = Number(ingredientById?.get(line?.ingredient_id)?.last_price) || 0
  if (price <= 0) return 0
  return lineBaseQty(line, ingredientById) * price
}

/** หน่วยที่กรอกได้ของวัตถุดิบตัวหนึ่ง — หน่วยที่ซื้อมาเสมอ บวกหน่วยย่อยถ้าตั้งปริมาณไว้ */
export function entryUnitsFor(ingredient) {
  const buy = ingredient?.unit ?? 'ชิ้น'
  const content = ingredient?.content_unit
  const qty = Number(ingredient?.content_qty) || 0
  return content && qty > 0 && content !== buy ? [buy, content] : [buy]
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
      const entryUnit = line.entry_unit ?? ingredient?.unit ?? 'ชิ้น'
      const isContentUnit = entryUnit !== (ingredient?.unit ?? '')
      return {
        ingredient_id: line.ingredient_id,
        ingredient_name: line.ingredient_name ?? ingredient?.name ?? '',
        unit: ingredient?.unit ?? 'ชิ้น',
        qty: Number(line.qty) || 0,
        entry_unit: entryUnit,
        // ติดขนาดบรรจุไว้กับบรรทัด ประวัติหม้อเก่าจะได้ไม่ขยับตามตอนเปลี่ยนขนาดขวดทีหลัง
        content_qty: isContentUnit
          ? Number(line.content_qty) || Number(ingredient?.content_qty) || null
          : null,
        per_batch: Math.max(0, Math.floor(Number(line.per_batch) || 0)) || null,
        base_qty: round4(lineBaseQty(line, ingredientById)),
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

/**
 * ปริมาณที่ถูกตัดออกจากสต็อกของบรรทัดนี้ นับเป็นหน่วยที่ซื้อมา
 *
 * เป็นตัวเลขเดียวกับที่ใช้คิดราคา — ตวงน้ำปลา 70 มล. จากขวด 700 มล.
 * ก็จ่ายค่าของ 0.1 ขวด และสต็อกหายไป 0.1 ขวด เท่ากันเสมอ
 */
export function lineStockUse(line, ingredientById) {
  return lineBaseQty(line, ingredientById)
}

/**
 * วัตถุดิบที่สูตรนี้ใช้เกินกว่าที่มีในสต็อก
 *
 * ไม่ได้เอาไว้ห้ามบันทึก เพราะกว่าจะมากรอกคือกวนหม้อเสร็จไปแล้ว ห้ามไปก็ไม่ช่วยอะไร
 * แต่เอาไว้เตือนว่าสต็อกที่จำไว้ไม่ตรงกับของจริง ควรไปนับใหม่
 */
export function linesOverStock(lines = [], ingredientById) {
  return lines
    .filter((line) => line?.ingredient_id && Number(line?.qty) > 0)
    .map((line) => {
      const ingredient = ingredientById?.get(line.ingredient_id)
      const have = Number(ingredient?.stock_qty) || 0
      return {
        ingredient_id: line.ingredient_id,
        ingredient_name: line.ingredient_name ?? ingredient?.name ?? '',
        unit: ingredient?.unit ?? 'ชิ้น',
        need: lineStockUse(line, ingredientById),
        have,
      }
    })
    .filter((row) => row.need > row.have + 1e-9)
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
      entry_unit: line.entry_unit ?? line.unit ?? 'ชิ้น',
      content_qty: Number(line.content_qty) || null,
      per_batch: Math.max(0, Math.floor(Number(line.per_batch) || 0)) || null,
    }))
}
