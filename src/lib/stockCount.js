/**
 * นับของเหลือตอนปิดกะ
 *
 * หลักการเดียวกับนับเงินในลิ้นชัก — ระบบบอกว่า "ควรเหลือเท่าไหร่" คนนับบอกว่า
 * "เหลือจริงเท่าไหร่" แล้วดูส่วนต่าง ถ้าหายไปโดยไม่มีบิลแปลว่ามีอะไรผิดพลาด
 *
 * ของเหลือของสินค้าสต็อกรายวันถือว่าทิ้ง ต้องบันทึกเป็นต้นทุนที่เสียไป
 * ไม่งั้นกำไรในรายงานจะสูงกว่าความจริงทุกวันโดยไม่มีใครรู้
 */
import { unitCost } from './pricing'

/** สินค้าที่ต้องนับ — เซ็ตไม่ต้องนับเพราะไม่มีสต็อกของตัวเอง ตัดที่ส่วนประกอบ */
export function countableProducts(products = []) {
  return products.filter((p) => p?.is_active !== false && !p?.is_bundle)
}

/**
 * แถวนับของเหลือ 1 สินค้า
 *
 * ต้นทุนใช้ราคาวัตถุดิบล้วน ไม่บวกของประกอบ เพราะของที่ขายไม่ออกยังไม่ได้ใช้
 * ถุง น้ำจิ้ม หรือไม้เสียบเพิ่ม การบวกเข้าไปจะทำให้ของเสียดูแพงกว่าที่เสียจริง
 */
export function countRow(product, rawInput, { ingredientById } = {}) {
  const expected = Math.max(0, Math.floor(product?.stock_qty ?? 0))
  const text = String(rawInput ?? '').trim()
  const filled = text !== '' && Number.isFinite(Number(text))
  const counted = filled ? Math.max(0, Math.floor(Number(text))) : null
  const isDaily = product?.stock_type === 'daily'
  const cost = unitCost(product, { ingredientById, consumableCost: 0 })

  const diff = filled ? counted - expected : 0
  const missingQty = diff < 0 ? -diff : 0
  const extraQty = diff > 0 ? diff : 0
  const wasteQty = filled && isDaily ? counted : 0

  return {
    productId: product?.id,
    name: product?.name ?? '',
    unit: product?.unit ?? 'ชิ้น',
    expected,
    counted,
    filled,
    isDaily,
    cost,
    diff,
    missingQty,
    extraQty,
    wasteQty,
    missingCost: missingQty * cost,
    wasteCost: wasteQty * cost,
  }
}

export function buildCountRows(products, counts = {}, options = {}) {
  return countableProducts(products).map((p) => countRow(p, counts[p.id], options))
}

/** สรุปทั้งกะ — ใช้ทั้งบนหน้าจอและเก็บลงสรุปกะ */
export function summarizeCount(rows = []) {
  const filled = rows.filter((r) => r.filled)
  const sum = (key) => filled.reduce((total, r) => total + r[key], 0)

  const missingQty = sum('missingQty')
  return {
    filledCount: filled.length,
    totalCount: rows.length,
    complete: rows.length > 0 && filled.length === rows.length,
    missingQty,
    missingCost: sum('missingCost'),
    extraQty: sum('extraQty'),
    wasteQty: sum('wasteQty'),
    wasteCost: sum('wasteCost'),
    hasIssue: missingQty > 0,
  }
}

/** เก็บลงเอกสารกะ — เก็บเฉพาะแถวที่กรอกจริง จะได้ไม่บวมด้วยค่าว่าง */
export function countRowsForSave(rows = []) {
  return rows
    .filter((r) => r.filled)
    .map((r) => ({
      product_id: r.productId,
      name: r.name,
      unit: r.unit,
      expected: r.expected,
      counted: r.counted,
      diff: r.diff,
      waste_qty: r.wasteQty,
      waste_cost: Number(r.wasteCost.toFixed(2)),
      missing_cost: Number(r.missingCost.toFixed(2)),
    }))
}
