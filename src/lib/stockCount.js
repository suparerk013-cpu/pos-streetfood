/**
 * นับของเหลือตอนปิดกะ
 *
 * หลักการเดียวกับนับเงินในลิ้นชัก — ระบบบอกว่า "ควรเหลือเท่าไหร่" คนนับบอกว่า
 * "เหลือจริงเท่าไหร่" แล้วดูส่วนต่าง ถ้าหายไปโดยไม่มีบิลแปลว่ามีอะไรผิดพลาด
 *
 * ของเหลือของสินค้าสต็อกรายวันถือว่าทิ้ง
 *
 * คิดมูลค่าของที่หายหรือทิ้งตามราคาขาย ไม่ใช่ต้นทุน เพราะร้านเลิกคิดต้นทุนต่อชิ้นแล้ว
 * (ตัวเลขไม่ตรงของจริง) และราคาขายตอบคำถามที่คนในร้านสนใจตรงกว่า —
 * "ของหาย 5 ไม้ คือเงินขายที่ไม่ได้เข้า 50 บาท"
 */

/** สินค้าที่ต้องนับ — เซ็ตไม่ต้องนับเพราะไม่มีสต็อกของตัวเอง ตัดที่ส่วนประกอบ */
export function countableProducts(products = []) {
  return products.filter((p) => p?.is_active !== false && !p?.is_bundle)
}

/** แถวนับของเหลือ 1 สินค้า */
export function countRow(product, rawInput) {
  const expected = Math.max(0, Math.floor(product?.stock_qty ?? 0))
  const text = String(rawInput ?? '').trim()
  const filled = text !== '' && Number.isFinite(Number(text))
  const counted = filled ? Math.max(0, Math.floor(Number(text))) : null
  const isDaily = product?.stock_type === 'daily'
  const price = Number(product?.price) || 0

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
    price,
    diff,
    missingQty,
    extraQty,
    wasteQty,
    missingValue: missingQty * price,
    wasteValue: wasteQty * price,
  }
}

export function buildCountRows(products, counts = {}) {
  return countableProducts(products).map((p) => countRow(p, counts[p.id]))
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
    missingValue: sum('missingValue'),
    extraQty: sum('extraQty'),
    wasteQty: sum('wasteQty'),
    wasteValue: sum('wasteValue'),
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
      // ชื่อฟิลด์ใหม่ เพราะความหมายเปลี่ยนจากต้นทุนเป็นราคาขาย
      // กะเก่าที่เก็บ waste_cost ไว้ยังอ่านได้ตามความหมายเดิม ไม่ปนกัน
      waste_value: Number(r.wasteValue.toFixed(2)),
      missing_value: Number(r.missingValue.toFixed(2)),
    }))
}
