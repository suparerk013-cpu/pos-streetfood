import { describe, expect, it } from 'vitest'
import { summarizePurchases } from '../excelExport'

const purchases = [
  { ingredient_id: 'i1', ingredient_name: 'ผักชี', category: 'vegetable', unit: 'กำ', qty: 10, unit_price: 5, total_amount: 50, date: '2026-09-01' },
  { ingredient_id: 'i1', ingredient_name: 'ผักชี', category: 'vegetable', unit: 'กำ', qty: 8, unit_price: 4, total_amount: 32, date: '2026-09-02' },
  { ingredient_id: 'i2', ingredient_name: 'ปลาหมึกสด', category: 'fresh', unit: 'กก.', qty: 2, unit_price: 200, total_amount: 400, date: '2026-09-01' },
]

describe('summarizePurchases', () => {
  it('รวมการซื้อวัตถุดิบเดียวกันหลายครั้งให้เหลือบรรทัดเดียว', () => {
    const rows = summarizePurchases(purchases)
    expect(rows).toHaveLength(2)
    const parsley = rows.find((r) => r.name === 'ผักชี')
    expect(parsley).toMatchObject({ times: 2, qty: 18, total: 82, minPrice: 4, maxPrice: 5 })
  })

  it('เรียงจากยอดใช้เงินมากไปน้อย', () => {
    expect(summarizePurchases(purchases)[0].name).toBe('ปลาหมึกสด')
  })

  it('ราคาเฉลี่ยคิดจากยอดรวมหารปริมาณรวม ไม่ใช่เฉลี่ยของราคาต่อครั้ง', () => {
    const parsley = summarizePurchases(purchases).find((r) => r.name === 'ผักชี')
    expect(parsley.avgPrice).toBeCloseTo(82 / 18, 5)
  })

  it('ไม่มีรายการซื้อคืนลิสต์ว่าง', () => {
    expect(summarizePurchases([])).toEqual([])
  })

  it('รายการที่ไม่มีราคาต่อหน่วยไม่ทำให้ minPrice ค้างเป็น Infinity', () => {
    const rows = summarizePurchases([
      { ingredient_id: 'i3', ingredient_name: 'ของแถม', qty: 1, unit_price: 0, total_amount: 0 },
    ])
    expect(rows[0].minPrice).toBe(0)
  })
})
