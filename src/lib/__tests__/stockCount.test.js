import { describe, expect, it } from 'vitest'
import { buildCountRows, countRow, countRowsForSave, countableProducts, summarizeCount } from '../stockCount'

// หมึกสด 60 ฿/กก. เสียบได้ 20 ไม้ → ต้นทุนวัตถุดิบ 3 ฿/ไม้
const ingredientById = new Map([['ing1', { id: 'ing1', last_price: 60 }]])

const squid = {
  id: 'p1', name: 'ปลาหมึกย่าง', unit: 'ไม้', stock_qty: 8, is_active: true,
  stock_type: 'batch', ingredient_id: 'ing1', yield_per_unit: 20,
}
const mussel = {
  id: 'p2', name: 'หอยแมลงภู่นึ่ง', unit: 'ถุง', stock_qty: 3, is_active: true,
  stock_type: 'daily', cost_override: 30,
}
const bundle = { id: 's1', name: 'เซ็ต 8 ไม้', is_bundle: true, is_active: true, components: [{ product_id: 'p1', qty: 8 }] }
const archived = { id: 'p9', name: 'เลิกขาย', is_active: false }

const opts = { ingredientById }

describe('countableProducts', () => {
  it('เซ็ตไม่ต้องนับ เพราะไม่มีสต็อกของตัวเอง ตัดที่ส่วนประกอบ', () => {
    expect(countableProducts([squid, bundle, archived]).map((p) => p.id)).toEqual(['p1'])
  })
})

describe('countRow', () => {
  it('ยังไม่กรอก ถือว่ายังไม่นับ ไม่ใช่นับได้ 0', () => {
    const row = countRow(squid, '', opts)
    expect(row.filled).toBe(false)
    expect(row.counted).toBeNull()
    expect(row.diff).toBe(0)
    expect(row.wasteQty).toBe(0)
  })

  it('กรอก 0 ต่างจากเว้นว่าง — 0 คือขายหมดจริง', () => {
    const row = countRow(squid, '0', opts)
    expect(row.filled).toBe(true)
    expect(row.counted).toBe(0)
    expect(row.missingQty).toBe(8)
  })

  it('นับได้น้อยกว่าที่ควรเหลือ = ของหายไม่มีบิล คิดต้นทุนวัตถุดิบล้วน', () => {
    const row = countRow(squid, '5', opts)
    expect(row.diff).toBe(-3)
    expect(row.missingQty).toBe(3)
    expect(row.cost).toBe(3)
    expect(row.missingCost).toBe(9)
  })

  it('นับได้มากกว่าที่ควรเหลือ ไม่นับเป็นของหาย', () => {
    const row = countRow(squid, '10', opts)
    expect(row.extraQty).toBe(2)
    expect(row.missingQty).toBe(0)
    expect(row.missingCost).toBe(0)
  })

  it('สินค้ารายวัน ของที่เหลือถือว่าทิ้ง คิดเป็นต้นทุนที่เสียไป', () => {
    const row = countRow(mussel, '2', opts)
    expect(row.isDaily).toBe(true)
    expect(row.wasteQty).toBe(2)
    expect(row.wasteCost).toBe(60)
    expect(row.missingQty).toBe(1)
  })

  it('สินค้ายกยอด ของที่เหลือไม่ใช่ของทิ้ง', () => {
    expect(countRow(squid, '8', opts).wasteQty).toBe(0)
  })

  it('พิมพ์อะไรที่ไม่ใช่ตัวเลข ถือว่ายังไม่นับ ไม่ใช่ 0', () => {
    expect(countRow(squid, 'abc', opts).filled).toBe(false)
  })
})

describe('summarizeCount', () => {
  const rows = () => buildCountRows([squid, mussel, bundle], { p1: '5', p2: '2' }, opts)

  it('รวมของหายและของทิ้งแยกกัน คนละเรื่องกัน', () => {
    const s = summarizeCount(rows())
    expect(s.missingQty).toBe(4)          // หมึกหาย 3 + หอยหาย 1
    expect(s.missingCost).toBe(9 + 30)
    expect(s.wasteQty).toBe(2)            // เฉพาะหอยที่เหลือแล้วทิ้ง
    expect(s.wasteCost).toBe(60)
    expect(s.hasIssue).toBe(true)
  })

  it('นับครบทุกตัวถึงจะถือว่า complete', () => {
    expect(summarizeCount(rows()).complete).toBe(true)
    expect(summarizeCount(buildCountRows([squid, mussel], { p1: '8' }, opts)).complete).toBe(false)
  })

  it('ของครบพอดีไม่มีปัญหา', () => {
    const s = summarizeCount(buildCountRows([squid], { p1: '8' }, opts))
    expect(s.hasIssue).toBe(false)
    expect(s.missingQty).toBe(0)
  })

  it('ยังไม่กรอกอะไรเลย ไม่มีอะไรถูกนับ', () => {
    const s = summarizeCount(buildCountRows([squid, mussel], {}, opts))
    expect(s.filledCount).toBe(0)
    expect(s.wasteQty).toBe(0)
    expect(s.missingQty).toBe(0)
  })
})

describe('countRowsForSave', () => {
  it('เก็บเฉพาะแถวที่กรอกจริง จะได้ไม่บวมด้วยค่าว่าง', () => {
    const saved = countRowsForSave(buildCountRows([squid, mussel], { p1: '5' }, opts))
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ product_id: 'p1', expected: 8, counted: 5, diff: -3, missing_cost: 9 })
  })
})
