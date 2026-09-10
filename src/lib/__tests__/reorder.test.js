import { describe, expect, it } from 'vitest'
import { fromReorderValue, toReorderPayload } from '../reorder'
import { stockLevelOf, reorderPoint, shoppingSuggestions } from '../sauceStock'

const fish = { unit: 'ขวด', content_qty: 700, content_unit: 'มล.' }
const cori = { unit: 'กำ' }

describe('แปลงจุดสั่งซื้อระหว่างหน่วย', () => {
  it('ตั้งเป็นมิลลิลิตรทั้งที่ซื้อเป็นขวด เก็บเป็นเศษขวด', () => {
    expect(toReorderPayload(fish, '200', 'มล.')).toEqual({ reorder_qty: 200 / 700, reorder_unit: 'มล.' })
  })

  it('ตั้งด้วยหน่วยที่ซื้อมา เก็บตรง ๆ ไม่หาร', () => {
    expect(toReorderPayload(cori, '1', 'กำ')).toEqual({ reorder_qty: 1, reorder_unit: 'กำ' })
  })

  it('ไม่ใส่หรือใส่ศูนย์ ถือว่าไม่ตั้ง', () => {
    expect(toReorderPayload(cori, '', 'กำ')).toEqual({ reorder_qty: null, reorder_unit: null })
    expect(toReorderPayload(cori, '0', 'กำ')).toEqual({ reorder_qty: null, reorder_unit: null })
  })

  it('เปิดกลับมาเห็นเลขเดิมที่พิมพ์ ไม่ใช่เศษทศนิยม', () => {
    const saved = { ...fish, reorder_qty: 200 / 700, reorder_unit: 'มล.' }
    expect(fromReorderValue(saved)).toEqual({ qty: '200', unit: 'มล.' })
  })

  it('ยังไม่เคยตั้ง คืนค่าว่างพร้อมหน่วยที่ซื้อมา', () => {
    expect(fromReorderValue(cori)).toEqual({ qty: '', unit: 'กำ' })
  })

  it('ข้อมูลเก่าที่ไม่มี reorder_unit ถือว่าเป็นหน่วยที่ซื้อมา', () => {
    expect(fromReorderValue({ unit: 'กำ', reorder_qty: 2 })).toEqual({ qty: '2', unit: 'กำ' })
  })
})

describe('reorderPoint', () => {
  it('อ่านค่าที่ตั้งไว้ ถ้าไม่ได้ตั้งคืน null', () => {
    expect(reorderPoint({ reorder_qty: 1.5 })).toBe(1.5)
    expect(reorderPoint({})).toBe(null)
    expect(reorderPoint({ reorder_qty: 0 })).toBe(null)
  })
})

describe('stockLevelOf — จุดที่ตั้งเองกับสูตรทำงานทั้งคู่', () => {
  it('ต่ำกว่าจุดที่ตั้งเอง เตือนถึงจะทำน้ำจิ้มได้อีกหลายหม้อ', () => {
    const r = stockLevelOf({ have: 0.8, tracked: true, needPerPot: 0.05, reorder: 1 })
    expect(r.level).toBe('out')
    expect(r.reason).toBe('reorder')
  })

  it('ไม่พอทำหม้อถัดไป เตือนถึงจะยังไม่ต่ำกว่าจุดที่ตั้งเอง', () => {
    // ตั้งเตือนที่ 1 กำ แต่สูตรใช้ 2 กำ/หม้อ เหลือ 1.5 กำ ทำไม่ได้แล้ว
    const r = stockLevelOf({ have: 1.5, tracked: true, needPerPot: 2, reorder: 1 })
    expect(r.level).toBe('out')
    expect(r.reason).toBe('recipe')
  })

  it('ผ่านทั้งสองเงื่อนไข ไม่เตือน', () => {
    expect(stockLevelOf({ have: 5, tracked: true, needPerPot: 0.2, reorder: 1 }).level).toBe('ok')
  })

  it('ยังไม่ได้นับสต็อก ไม่ตัดสินว่าหมด', () => {
    expect(stockLevelOf({ have: 0, tracked: false, reorder: 1 }).level).toBe('unknown')
  })

  it('ตั้งจุดเตือนอย่างเดียวโดยไม่มีสูตร ก็ยังเตือนได้', () => {
    const r = stockLevelOf({ have: 0.5, tracked: true, needPerPot: 0, reorder: 2 })
    expect(r.level).toBe('out')
    expect(r.pots).toBe(null)
  })
})

describe('ของนอกสูตรที่ตั้งจุดเตือนไว้', () => {
  const ingredients = new Map([
    ['charcoal', { id: 'charcoal', name: 'ถ่าน', unit: 'กระสอบ', last_price: 300, stock_qty: 0.5, reorder_qty: 1, reorder_unit: 'กระสอบ' }],
    ['bag', { id: 'bag', name: 'ถุงพลาสติก', unit: 'แพ็ค', last_price: 50, stock_qty: 10 }],
  ])

  it('โผล่ในรายการซื้อของถึงจะไม่ได้อยู่ในสูตรน้ำจิ้มเลย', () => {
    const rows = shoppingSuggestions([], ingredients)
    expect(rows.map((r) => r.name)).toEqual(['ถ่าน'])
    expect(rows[0].reason).toBe('reorder')
    expect(rows[0].inRecipe).toBe(false)
  })

  it('ของที่ไม่ได้ตั้งจุดเตือนและไม่อยู่ในสูตร ไม่รก', () => {
    expect(shoppingSuggestions([], ingredients).some((r) => r.name === 'ถุงพลาสติก')).toBe(false)
  })

  it('แนะนำซื้อให้เหลือเป็นเท่าตัวของจุดที่ตั้ง ไม่ใช่พอดีเป๊ะแล้วเตือนอีกทันที', () => {
    // ตั้งเตือนที่ 1 เหลือ 0.5 → ซื้อให้ถึง 3 เท่า = 3 ขาด 2.5 ปัดขึ้นเป็น 3 กระสอบ
    expect(shoppingSuggestions([], ingredients)[0].suggestQty).toBe(3)
  })

  it('ตั้งจุดสั่งซื้อเองแล้ว จำนวนที่แนะนำคุมด้วยเลขนั้น ไม่ใช่เป้าจำนวนหม้อ', () => {
    // ผักชีสูตรใช้ 2 กำ/หม้อ ถ้าคิดจากเป้า 5 หม้อจะแนะนำ 10 กำ ซึ่งเหี่ยวก่อนใช้หมด
    // ตั้งเตือนไว้ 1 กำ จึงควรแนะนำแค่ 3 กำ ตามที่เจ้าของร้านตั้งใจ
    const cori = new Map([
      ['cori', { id: 'cori', name: 'ผักชี', unit: 'กำ', last_price: 10, stock_qty: 0.8, reorder_qty: 1 }],
    ])
    const sauce = { name: 'น้ำจิ้ม', recipe: [{ ingredient_id: 'cori', qty: 2 }] }
    expect(shoppingSuggestions([sauce], cori)[0].suggestQty).toBe(3)
  })

  it('ไม่ได้ตั้งจุดสั่งซื้อ ยังคิดจากเป้าจำนวนหม้อเหมือนเดิม', () => {
    const chili = new Map([
      ['chili', { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150, stock_qty: 0.3 }],
    ])
    const sauce = { name: 'น้ำจิ้ม', recipe: [{ ingredient_id: 'chili', qty: 0.2 }] }
    expect(shoppingSuggestions([sauce], chili)[0].suggestQty).toBe(0.75)
  })

  it('วัตถุดิบที่ถูกซ่อนไว้ไม่โผล่มา', () => {
    const hidden = new Map([['x', { id: 'x', name: 'ของเก่า', unit: 'กก.', reorder_qty: 5, is_active: false }]])
    expect(shoppingSuggestions([], hidden)).toHaveLength(0)
  })
})
