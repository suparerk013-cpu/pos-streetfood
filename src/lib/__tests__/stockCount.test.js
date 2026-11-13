import { describe, expect, it } from 'vitest'
import { buildCountRows, countRow, countRowsForSave, countableProducts, summarizeCount } from '../stockCount'

// ของหายหรือทิ้งคิดตามราคาขาย — หมึกไม้ละ 10 บาท หอยถุงละ 50 บาท
const squid = {
  id: 'p1', name: 'ปลาหมึกย่าง', unit: 'ไม้', price: 10, stock_qty: 8, is_active: true,
  stock_type: 'batch',
}
const mussel = {
  id: 'p2', name: 'หอยแมลงภู่นึ่ง', unit: 'ถุง', price: 50, stock_qty: 3, is_active: true,
  stock_type: 'daily',
}
const bundle = { id: 's1', name: 'เซ็ต 8 ไม้', is_bundle: true, is_active: true, components: [{ product_id: 'p1', qty: 8 }] }
const archived = { id: 'p9', name: 'เลิกขาย', is_active: false }

describe('countableProducts', () => {
  it('เซ็ตไม่ต้องนับ เพราะไม่มีสต็อกของตัวเอง ตัดที่ส่วนประกอบ', () => {
    expect(countableProducts([squid, bundle, archived]).map((p) => p.id)).toEqual(['p1'])
  })
})

describe('countRow', () => {
  it('ยังไม่กรอก ถือว่ายังไม่นับ ไม่ใช่นับได้ 0', () => {
    const row = countRow(squid, '')
    expect(row.filled).toBe(false)
    expect(row.counted).toBeNull()
    expect(row.diff).toBe(0)
    expect(row.wasteQty).toBe(0)
  })

  it('กรอก 0 ต่างจากเว้นว่าง — 0 คือขายหมดจริง', () => {
    const row = countRow(squid, '0')
    expect(row.filled).toBe(true)
    expect(row.counted).toBe(0)
    expect(row.missingQty).toBe(8)
  })

  it('นับได้น้อยกว่าที่ควรเหลือ = ของหายไม่มีบิล คิดเป็นเงินขายที่ไม่ได้เข้า', () => {
    const row = countRow(squid, '5')
    expect(row.diff).toBe(-3)
    expect(row.missingQty).toBe(3)
    expect(row.price).toBe(10)
    expect(row.missingValue).toBe(30)
  })

  it('นับได้มากกว่าที่ควรเหลือ ไม่นับเป็นของหาย', () => {
    const row = countRow(squid, '10')
    expect(row.extraQty).toBe(2)
    expect(row.missingQty).toBe(0)
    expect(row.missingValue).toBe(0)
  })

  it('สินค้ารายวัน ของที่เหลือถือว่าทิ้ง คิดตามราคาขาย', () => {
    const row = countRow(mussel, '2')
    expect(row.isDaily).toBe(true)
    expect(row.wasteQty).toBe(2)
    expect(row.wasteValue).toBe(100)
    expect(row.missingQty).toBe(1)
  })

  it('สินค้ายกยอด ของที่เหลือไม่ใช่ของทิ้ง', () => {
    expect(countRow(squid, '8').wasteQty).toBe(0)
  })

  it('พิมพ์อะไรที่ไม่ใช่ตัวเลข ถือว่ายังไม่นับ ไม่ใช่ 0', () => {
    expect(countRow(squid, 'abc').filled).toBe(false)
  })
})

describe('summarizeCount', () => {
  const rows = () => buildCountRows([squid, mussel, bundle], { p1: '5', p2: '2' })

  it('รวมของหายและของทิ้งแยกกัน คนละเรื่องกัน', () => {
    const s = summarizeCount(rows())
    expect(s.missingQty).toBe(4)          // หมึกหาย 3 + หอยหาย 1
    expect(s.missingValue).toBe(30 + 50)
    expect(s.wasteQty).toBe(2)            // เฉพาะหอยที่เหลือแล้วทิ้ง
    expect(s.wasteValue).toBe(100)
    expect(s.hasIssue).toBe(true)
  })

  it('นับครบทุกตัวถึงจะถือว่า complete', () => {
    expect(summarizeCount(rows()).complete).toBe(true)
    expect(summarizeCount(buildCountRows([squid, mussel], { p1: '8' })).complete).toBe(false)
  })

  it('ของครบพอดีไม่มีปัญหา', () => {
    const s = summarizeCount(buildCountRows([squid], { p1: '8' }))
    expect(s.hasIssue).toBe(false)
    expect(s.missingQty).toBe(0)
  })

  it('ยังไม่กรอกอะไรเลย ไม่มีอะไรถูกนับ', () => {
    const s = summarizeCount(buildCountRows([squid, mussel], {}))
    expect(s.filledCount).toBe(0)
    expect(s.wasteQty).toBe(0)
    expect(s.missingQty).toBe(0)
  })
})

describe('countRowsForSave', () => {
  it('เก็บเฉพาะแถวที่กรอกจริง จะได้ไม่บวมด้วยค่าว่าง', () => {
    const saved = countRowsForSave(buildCountRows([squid, mussel], { p1: '5' }))
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ product_id: 'p1', expected: 8, counted: 5, diff: -3, missing_value: 30 })
  })

  it('เก็บด้วยชื่อฟิลด์ใหม่ ไม่ปนกับกะเก่าที่เก็บเป็นต้นทุน', () => {
    const [saved] = countRowsForSave(buildCountRows([squid], { p1: '5' }))
    expect(saved).not.toHaveProperty('missing_cost')
    expect(saved).not.toHaveProperty('waste_cost')
  })
})
