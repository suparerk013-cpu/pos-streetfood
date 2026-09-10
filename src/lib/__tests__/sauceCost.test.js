import { describe, expect, it } from 'vitest'
import {
  batchTotals,
  cleanRecipe,
  lineAmount,
  linesMissingPrice,
  sauceCostFor,
  saucePerServe,
} from '../sauceCost'

const ingredients = new Map([
  ['chili', { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150 }],
  ['garlic', { id: 'garlic', name: 'กระเทียม', unit: 'กก.', last_price: 150 }],
  ['sugar', { id: 'sugar', name: 'น้ำตาล', unit: 'กก.', last_price: 28 }],
  ['fish', { id: 'fish', name: 'น้ำปลา', unit: 'ขวด', last_price: 35 }],
  ['cori', { id: 'cori', name: 'ผักชี', unit: 'มัด', last_price: 10 }],
  ['nopay', { id: 'nopay', name: 'ของที่ยังไม่เคยซื้อ', unit: 'กก.', last_price: null }],
])

describe('lineAmount', () => {
  it('คิดตรง ๆ จากราคาที่ซื้อมาคูณปริมาณที่ใส่', () => {
    expect(lineAmount({ ingredient_id: 'chili', qty: 0.2 }, ingredients)).toBeCloseTo(30)
  })

  it('ของขวดที่ใช้ได้หลายหม้อ หารด้วยจำนวนหม้อก่อน', () => {
    expect(lineAmount({ ingredient_id: 'fish', qty: 1, per_batch: 10 }, ingredients)).toBeCloseTo(3.5)
  })

  it('ยังไม่เคยบันทึกราคาซื้อ คิดเป็น 0 แทนที่จะพัง', () => {
    expect(lineAmount({ ingredient_id: 'nopay', qty: 5 }, ingredients)).toBe(0)
    expect(lineAmount({ ingredient_id: 'ไม่มีตัวนี้', qty: 5 }, ingredients)).toBe(0)
  })

  it('ปริมาณติดลบหรือว่างไม่ทำให้ต้นทุนติดลบ', () => {
    expect(lineAmount({ ingredient_id: 'chili', qty: -3 }, ingredients)).toBe(0)
    expect(lineAmount({ ingredient_id: 'chili', qty: '' }, ingredients)).toBe(0)
  })
})

describe('batchTotals', () => {
  const lines = [
    { ingredient_id: 'chili', qty: 0.2 },
    { ingredient_id: 'garlic', qty: 0.15 },
    { ingredient_id: 'sugar', qty: 0.3 },
    { ingredient_id: 'fish', qty: 1, per_batch: 10 },
  ]

  it('รวมทุกบรรทัดแล้วหารเป็นต้นทุนต่อกิโลและต่อชิ้น', () => {
    const totals = batchTotals(lines, { yieldQty: 2, serves: 300, ingredientById: ingredients })
    // พริก 30 + กระเทียม 22.50 + น้ำตาล 8.40 + น้ำปลา 3.50
    expect(totals.totalCost).toBeCloseTo(64.4)
    expect(totals.costPerYield).toBeCloseTo(32.2)
    expect(totals.costPerServe).toBeCloseTo(64.4 / 300, 4)
  })

  it('ต้นทุนต่อชิ้นเก็บทศนิยม 4 ตำแหน่ง ไม่ปัดจนกลายเป็นศูนย์', () => {
    const totals = batchTotals([{ ingredient_id: 'cori', qty: 1 }], {
      yieldQty: 1,
      serves: 5000,
      ingredientById: ingredients,
    })
    expect(totals.costPerServe).toBeGreaterThan(0)
  })

  it('ยังไม่กรอกว่าได้กี่กิโลหรือใช้ได้กี่ชิ้น ไม่หารด้วยศูนย์', () => {
    const totals = batchTotals(lines, { ingredientById: ingredients })
    expect(totals.costPerYield).toBe(0)
    expect(totals.costPerServe).toBe(0)
  })

  it('ทิ้งบรรทัดที่ยังไม่ได้เลือกวัตถุดิบหรือยังไม่ใส่จำนวน', () => {
    const totals = batchTotals(
      [...lines, { ingredient_id: '', qty: 5 }, { ingredient_id: 'chili', qty: 0 }],
      { yieldQty: 2, serves: 300, ingredientById: ingredients },
    )
    expect(totals.lines).toHaveLength(4)
  })

  it('เก็บชื่อและหน่วยไว้ในบรรทัด เผื่อวัตถุดิบถูกลบหรือเปลี่ยนชื่อทีหลัง', () => {
    const totals = batchTotals([{ ingredient_id: 'chili', qty: 0.2 }], {
      yieldQty: 1,
      serves: 100,
      ingredientById: ingredients,
    })
    expect(totals.lines[0]).toMatchObject({ ingredient_name: 'พริก', unit: 'กก.', unit_price: 150 })
  })
})

describe('linesMissingPrice', () => {
  it('บอกเฉพาะวัตถุดิบที่ใส่แล้วแต่ยังไม่มีราคาซื้อ', () => {
    const missing = linesMissingPrice(
      [
        { ingredient_id: 'chili', qty: 1 },
        { ingredient_id: 'nopay', ingredient_name: 'ของที่ยังไม่เคยซื้อ', qty: 2 },
        { ingredient_id: 'nopay', qty: 0 },
        { ingredient_id: '', qty: 5 },
      ],
      ingredients,
    )
    expect(missing).toHaveLength(1)
    expect(missing[0].ingredient_name).toBe('ของที่ยังไม่เคยซื้อ')
  })
})

describe('sauceCostFor', () => {
  const sauces = new Map([
    ['s1', { id: 's1', name: 'น้ำจิ้มหมึกย่าง', last_batch: { cost_per_serve: 0.24 } }],
    ['s2', { id: 's2', name: 'ยังไม่เคยทำ', last_batch: null }],
  ])

  it('คิดจากหม้อล่าสุดของสูตรที่สินค้าผูกไว้', () => {
    expect(sauceCostFor({ sauce_id: 's1' }, sauces)).toBe(0.24)
  })

  it('สูตรที่ยังไม่เคยทำหม้อ ต้นทุนเป็น 0', () => {
    expect(sauceCostFor({ sauce_id: 's2' }, sauces)).toBe(0)
    expect(saucePerServe(null)).toBe(0)
  })

  it('ปิดระบบน้ำจิ้ม (ไม่ส่ง sauceById) ต้นทุนน้ำจิ้มหายไปทั้งก้อน', () => {
    expect(sauceCostFor({ sauce_id: 's1' }, null)).toBe(0)
  })

  it('สินค้าที่ไม่ได้ผูกสูตร ไม่โดนคิดต้นทุนน้ำจิ้ม', () => {
    expect(sauceCostFor({}, sauces)).toBe(0)
    expect(sauceCostFor({ sauce_id: 'สูตรที่ถูกลบไปแล้ว' }, sauces)).toBe(0)
  })
})

describe('cleanRecipe', () => {
  it('เก็บเฉพาะบรรทัดที่ครบ และแปลง per_batch ว่างเป็น null', () => {
    const cleaned = cleanRecipe([
      { ingredient_id: 'chili', ingredient_name: 'พริก', unit: 'กก.', qty: '0.2', per_batch: '' },
      { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', unit: 'ขวด', qty: 1, per_batch: '10' },
      { ingredient_id: '', qty: 3 },
      { ingredient_id: 'chili', qty: 0 },
    ])
    expect(cleaned).toEqual([
      { ingredient_id: 'chili', ingredient_name: 'พริก', unit: 'กก.', qty: 0.2, per_batch: null },
      { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', unit: 'ขวด', qty: 1, per_batch: 10 },
    ])
  })
})
