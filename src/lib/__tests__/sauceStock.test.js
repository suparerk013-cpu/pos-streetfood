import { describe, expect, it } from 'vitest'
import {
  allSauceStock,
  needPerPot,
  roundUpBuy,
  sauceAlertCount,
  sauceStock,
  shoppingSuggestions,
} from '../sauceStock'

// พริกเหลือพอ 1 หม้อ น้ำตาลพอ 2 หม้อ กระเทียมเหลือเฟือ น้ำปลายังไม่เคยนับ
const ingredients = new Map([
  ['chili', { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150, stock_qty: 0.3 }],
  ['sugar', { id: 'sugar', name: 'น้ำตาล', unit: 'กก.', last_price: 28, stock_qty: 0.6 }],
  ['garlic', { id: 'garlic', name: 'กระเทียม', unit: 'กก.', last_price: 150, stock_qty: 1.2 }],
  ['fish', { id: 'fish', name: 'น้ำปลา', unit: 'ขวด', last_price: 35, content_qty: 700, content_unit: 'มล.' }],
])

const squidSauce = {
  id: 's1',
  name: 'น้ำจิ้มหมึกย่าง',
  recipe: [
    { ingredient_id: 'chili', qty: 0.2, entry_unit: 'กก.' },
    { ingredient_id: 'sugar', qty: 0.3, entry_unit: 'กก.' },
    { ingredient_id: 'garlic', qty: 0.15, entry_unit: 'กก.' },
    { ingredient_id: 'fish', qty: 70, entry_unit: 'มล.', content_qty: 700 },
  ],
}

describe('needPerPot', () => {
  it('แปลงหน่วยที่ตวงกลับเป็นหน่วยที่ซื้อมา', () => {
    const need = needPerPot(squidSauce, ingredients)
    expect(need.get('chili')).toBeCloseTo(0.2)
    expect(need.get('fish')).toBeCloseTo(0.1) // 70 มล. จากขวด 700 มล.
  })

  it('ใส่วัตถุดิบตัวเดียวกันสองบรรทัด ต้องรวมกัน ไม่ใช่ทับกัน', () => {
    const need = needPerPot(
      { recipe: [{ ingredient_id: 'chili', qty: 0.2 }, { ingredient_id: 'chili', qty: 0.1 }] },
      ingredients,
    )
    expect(need.get('chili')).toBeCloseTo(0.3)
  })
})

describe('sauceStock', () => {
  const stock = sauceStock(squidSauce, ingredients)

  it('ทำได้อีกกี่หม้อคิดจากตัวที่หมดก่อน', () => {
    expect(stock.pots).toBe(1) // พริก 0.3 / 0.2 = 1
  })

  it('บอกทีละตัวว่าใครเหลือเท่าไหร่ เรียงตัวที่จะหมดก่อนไว้บนสุด', () => {
    expect(stock.lines[0].name).toBe('พริก')
    expect(stock.lines.find((l) => l.name === 'น้ำตาล').pots).toBe(2)
    expect(stock.lines.find((l) => l.name === 'กระเทียม').pots).toBe(8)
  })

  it('ตัวที่ยังไม่เคยนับสต็อกแยกเป็น "ยังไม่รู้" ไม่ใช่ "ของหมด"', () => {
    const fish = stock.lines.find((l) => l.name === 'น้ำปลา')
    expect(fish.level).toBe('unknown')
    expect(stock.unknown).toHaveLength(1)
    expect(stock.blocking).toHaveLength(0)
  })

  it('ของที่เหลือน้อยแต่ยังทำได้ ถือว่าใกล้หมด ไม่ใช่หมด', () => {
    expect(stock.level).toBe('low')
  })

  it('ของไม่พอทำหม้อถัดไป ขึ้นเป็นของหมดพร้อมบอกชื่อ', () => {
    const empty = new Map(ingredients)
    empty.set('chili', { ...ingredients.get('chili'), stock_qty: 0.1 })
    const s = sauceStock(squidSauce, empty)
    expect(s.level).toBe('out')
    expect(s.blocking.map((l) => l.name)).toEqual(['พริก'])
    expect(s.pots).toBe(0)
  })

  it('สูตรที่ยังไม่เคยบันทึก ไม่มีอะไรให้คำนวณ', () => {
    const s = sauceStock({ id: 'x', name: 'ยังไม่มีสูตร', recipe: [] }, ingredients)
    expect(s.hasRecipe).toBe(false)
    expect(s.pots).toBe(null)
    expect(s.level).toBe('unknown')
  })

  it('ยังไม่ได้นับสต็อกสักตัว ไม่บอกจำนวนหม้อมั่ว ๆ', () => {
    const untracked = new Map([['fish', ingredients.get('fish')]])
    const s = sauceStock({ recipe: [{ ingredient_id: 'fish', qty: 70, entry_unit: 'มล.', content_qty: 700 }] }, untracked)
    expect(s.pots).toBe(null)
  })
})

describe('sauceAlertCount', () => {
  it('นับเฉพาะสูตรที่ทำหม้อถัดไปไม่ได้', () => {
    const empty = new Map(ingredients)
    empty.set('chili', { ...ingredients.get('chili'), stock_qty: 0 })
    expect(sauceAlertCount([squidSauce], empty)).toBe(1)
    expect(sauceAlertCount([squidSauce], ingredients)).toBe(0)
  })

  it('สูตรที่ยังไม่มีอะไรไม่ถูกนับ', () => {
    expect(allSauceStock([{ id: 'x', recipe: [] }], ingredients)).toHaveLength(0)
  })
})

describe('shoppingSuggestions', () => {
  const seaSauce = {
    id: 's2',
    name: 'น้ำจิ้มซีฟู้ด',
    // สูตรนี้ใช้พริกหนักกว่า — ต้องคิดจากสูตรที่กินเยอะสุด ซื้อเผื่อดีกว่าซื้อขาด
    recipe: [{ ingredient_id: 'chili', qty: 0.3, entry_unit: 'กก.' }],
  }

  it('รวมทุกสูตร ตัดตัวซ้ำ และคิดจากสูตรที่กินเยอะสุด', () => {
    const rows = shoppingSuggestions([squidSauce, seaSauce], ingredients)
    const chili = rows.find((r) => r.name === 'พริก')
    expect(chili.need).toBeCloseTo(0.3)
    expect(chili.usedBy).toHaveLength(2)
    expect(rows.filter((r) => r.name === 'พริก')).toHaveLength(1)
  })

  it('เรียงตัวที่จะหมดก่อนไว้บนสุด ตัวที่ยังไม่ได้นับไปท้ายสุด', () => {
    const rows = shoppingSuggestions([squidSauce, seaSauce], ingredients)
    expect(rows[0].name).toBe('พริก') // 0.3/0.3 = 1 หม้อ
    expect(rows[rows.length - 1].level).toBe('unknown')
  })

  it('แนะนำซื้อเท่าที่ทำให้ของพอทำอีก 5 หม้อ', () => {
    const rows = shoppingSuggestions([squidSauce], ingredients, { targetPots: 5 })
    // พริกต้องมี 5 × 0.2 = 1 กก. เหลือ 0.3 → ขาด 0.7
    expect(rows.find((r) => r.name === 'พริก').suggestQty).toBeCloseTo(0.75)
  })

  it('ของที่เหลือเกินเป้าอยู่แล้ว ไม่ต้องซื้อเพิ่ม', () => {
    const rows = shoppingSuggestions([squidSauce], ingredients, { targetPots: 5 })
    expect(rows.find((r) => r.name === 'กระเทียม').suggestQty).toBe(0)
  })

  it('วัตถุดิบที่ถูกลบไปแล้วไม่โผล่ในรายการซื้อ', () => {
    const rows = shoppingSuggestions(
      [{ recipe: [{ ingredient_id: 'ไม่มีแล้ว', qty: 1 }] }],
      ingredients,
    )
    expect(rows).toHaveLength(0)
  })
})

describe('roundUpBuy', () => {
  it('ของชั่งปัดขึ้นทีละ 0.25 — ซื้อ 2.5 ขีดได้จริงในตลาด', () => {
    expect(roundUpBuy(0.7, { unit: 'กก.' })).toBe(0.75)
  })

  it('ของนับเป็นชิ้นปัดเต็มหน่วย — ซื้อ 0.25 ขวดไม่มีความหมาย', () => {
    expect(roundUpBuy(0.2, { unit: 'ขวด' })).toBe(1)
    expect(roundUpBuy(1.1, { unit: 'ถุง' })).toBe(2)
  })

  it('ของที่ตั้งขนาดบรรจุไว้ถือเป็นของนับเป็นชิ้น', () => {
    expect(roundUpBuy(0.3, { unit: 'แกลลอน', content_qty: 5000 })).toBe(1)
  })

  it('ไม่ขาดก็ไม่ต้องซื้อ', () => {
    expect(roundUpBuy(0, { unit: 'กก.' })).toBe(0)
    expect(roundUpBuy(-2, { unit: 'กก.' })).toBe(0)
  })
})
