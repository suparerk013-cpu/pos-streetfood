import { describe, expect, it } from 'vitest'
import {
  batchTotals,
  cleanRecipe,
  entryUnitsFor,
  lineAmount,
  lineBaseQty,
  lineStockUse,
  linesMissingPrice,
  linesOverStock,
  sauceCostFor,
  saucePerServe,
} from '../sauceCost'

const ingredients = new Map([
  ['chili', { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150 }],
  ['garlic', { id: 'garlic', name: 'กระเทียม', unit: 'กก.', last_price: 150 }],
  ['sugar', { id: 'sugar', name: 'น้ำตาล', unit: 'กก.', last_price: 28 }],
  ['fish', { id: 'fish', name: 'น้ำปลา', unit: 'ขวด', last_price: 35, content_qty: 700, content_unit: 'มล.' }],
  ['cori', { id: 'cori', name: 'ผักชี', unit: 'มัด', last_price: 10 }],
  ['nopay', { id: 'nopay', name: 'ของที่ยังไม่เคยซื้อ', unit: 'กก.', last_price: null }],
])

describe('lineAmount', () => {
  it('คิดตรง ๆ จากราคาที่ซื้อมาคูณปริมาณที่ใส่', () => {
    expect(lineAmount({ ingredient_id: 'chili', qty: 0.2 }, ingredients)).toBeCloseTo(30)
  })

  it('ตวงเป็นหน่วยย่อย คิดเงินตามเศษของขวด — 70 มล. จากขวด 700 มล. ราคา 35 คือ 3.50', () => {
    expect(lineAmount({ ingredient_id: 'fish', qty: 70, entry_unit: 'มล.' }, ingredients)).toBeCloseTo(3.5)
  })

  it('กรอกเป็นหน่วยที่ซื้อมา คิดเต็มหน่วย ไม่ไปหารกับขนาดบรรจุ', () => {
    expect(lineAmount({ ingredient_id: 'fish', qty: 1, entry_unit: 'ขวด' }, ingredients)).toBeCloseTo(35)
  })

  it('ข้อมูลเก่าแบบ "1 ขวดใช้ได้กี่หม้อ" ยังคิดได้เหมือนเดิม', () => {
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
    { ingredient_id: 'fish', qty: 70, entry_unit: 'มล.' },
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
      { ingredient_id: 'chili', ingredient_name: 'พริก', unit: 'กก.', qty: '0.2', entry_unit: 'กก.', per_batch: '' },
      { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', unit: 'ขวด', qty: 70, entry_unit: 'มล.', content_qty: 700 },
      { ingredient_id: '', qty: 3 },
      { ingredient_id: 'chili', qty: 0 },
    ])
    expect(cleaned).toEqual([
      { ingredient_id: 'chili', ingredient_name: 'พริก', unit: 'กก.', qty: 0.2, entry_unit: 'กก.', content_qty: null, per_batch: null },
      { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', unit: 'ขวด', qty: 70, entry_unit: 'มล.', content_qty: 700, per_batch: null },
    ])
  })
})

describe('lineStockUse', () => {
  it('ของธรรมดาตัดสต็อกเท่าที่ใส่', () => {
    expect(lineStockUse({ ingredient_id: 'chili', qty: 0.2 })).toBeCloseTo(0.2)
  })

  it('ตวง 70 มล. จากขวด 700 มล. ตัดสต็อก 0.1 ขวด ไม่ใช่ทั้งขวด', () => {
    expect(lineStockUse({ ingredient_id: 'fish', qty: 70, entry_unit: 'มล.' }, ingredients)).toBeCloseTo(0.1)
  })

  it('สต็อกที่ตัดเท่ากับปริมาณที่คิดเงินเสมอ', () => {
    const line = { ingredient_id: 'fish', qty: 350, entry_unit: 'มล.' }
    expect(lineStockUse(line, ingredients)).toBeCloseTo(lineAmount(line, ingredients) / 35)
  })

  it('จำนวนติดลบไม่ทำให้สต็อกงอกขึ้นมา', () => {
    expect(lineStockUse({ ingredient_id: 'chili', qty: -5 }, ingredients)).toBe(0)
  })
})

describe('lineBaseQty', () => {
  it('ขนาดบรรจุที่ติดมากับบรรทัดชนะค่าปัจจุบันของวัตถุดิบ ประวัติหม้อเก่าจึงไม่ขยับ', () => {
    // ตอนทำหม้อนั้นขวดยังเป็น 500 มล. ถึงตอนนี้ทะเบียนจะเปลี่ยนเป็น 700 แล้วก็ตาม
    expect(lineBaseQty({ ingredient_id: 'fish', qty: 50, entry_unit: 'มล.', content_qty: 500 }, ingredients))
      .toBeCloseTo(0.1)
  })

  it('เลือกหน่วยย่อยไว้แต่วัตถุดิบยังไม่ได้ตั้งขนาดบรรจุ ใช้ตัวเลขตรง ๆ แทนที่จะหารด้วยศูนย์', () => {
    expect(lineBaseQty({ ingredient_id: 'chili', qty: 3, entry_unit: 'กรัม' }, ingredients)).toBe(3)
  })
})

describe('entryUnitsFor', () => {
  it('ตั้งขนาดบรรจุไว้ เลือกได้ทั้งหน่วยที่ซื้อและหน่วยย่อย', () => {
    expect(entryUnitsFor(ingredients.get('fish'))).toEqual(['ขวด', 'มล.'])
  })

  it('ไม่ได้ตั้งขนาดบรรจุ มีแค่หน่วยที่ซื้อมา', () => {
    expect(entryUnitsFor(ingredients.get('chili'))).toEqual(['กก.'])
  })
})

describe('linesOverStock', () => {
  const stocked = new Map([
    ['chili', { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150, stock_qty: 0.1 }],
    ['fish', { id: 'fish', name: 'น้ำปลา', unit: 'ขวด', last_price: 35, stock_qty: 2, content_qty: 700, content_unit: 'มล.' }],
    ['none', { id: 'none', name: 'ของที่ยังไม่ได้นับ', unit: 'กก.', last_price: 20 }],
  ])

  it('บอกเฉพาะตัวที่ใช้เกินกว่าที่มี', () => {
    const over = linesOverStock(
      [
        { ingredient_id: 'chili', ingredient_name: 'พริก', qty: 0.2 },
        { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', qty: 70, entry_unit: 'มล.' },
      ],
      stocked,
    )
    expect(over).toHaveLength(1)
    expect(over[0]).toMatchObject({ ingredient_name: 'พริก', need: 0.2, have: 0.1, unit: 'กก.' })
  })

  it('ใช้พอดีกับที่มี ไม่นับว่าเกิน', () => {
    expect(linesOverStock([{ ingredient_id: 'chili', qty: 0.1 }], stocked)).toHaveLength(0)
  })

  it('วัตถุดิบที่ยังไม่เคยตั้งสต็อก ถือว่ามี 0 จึงเตือน', () => {
    const over = linesOverStock([{ ingredient_id: 'none', ingredient_name: 'ของที่ยังไม่ได้นับ', qty: 1 }], stocked)
    expect(over[0].have).toBe(0)
  })
})
