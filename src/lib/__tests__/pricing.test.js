import { describe, expect, it } from 'vitest'
import {
  breakEvenPrice,
  bundleCost,
  bundleStock,
  netAfterGp,
  profitOf,
  roundUpToFive,
  suggestDeliveryPrice,
  unitCost,
} from '../pricing'

// ตัวเลขจริงของร้าน: หมึกสด 60 ฿/กก. เสียบได้ 20 ไม้ → 3 ฿/ไม้
const ingredientById = new Map([
  ['i-squid', { id: 'i-squid', name: 'ปลาหมึกสด', unit: 'กก.', last_price: 60 }],
  ['i-ball', { id: 'i-ball', name: 'ลูกชิ้น', unit: 'ถุง', last_price: 50 }],
])

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, stock_qty: 32, ingredient_id: 'i-squid', yield_per_unit: 20 }
const ball = { id: 'p2', name: 'ลูกชิ้นปิ้ง', price: 5, stock_qty: 40, ingredient_id: 'i-ball', yield_per_unit: 20 }
const productById = new Map([[squid.id, squid], [ball.id, ball]])

const opts = { ingredientById, consumableCost: 1.5, packagingCost: 5, productById }

describe('unitCost', () => {
  it('คิดต้นทุนต่อไม้จากราคาวัตถุดิบหารด้วยจำนวนที่ได้', () => {
    expect(unitCost(squid, { ingredientById, consumableCost: 0 })).toBe(3)
  })

  it('บวกของประกอบ (ไม้เสียบ น้ำจิ้ม ถ่าน) เข้าไปด้วย', () => {
    expect(unitCost(squid, { ingredientById, consumableCost: 1.5 })).toBe(4.5)
  })

  it('ยังไม่ได้ผูกวัตถุดิบ คิดเฉพาะของประกอบ', () => {
    expect(unitCost({ name: 'x' }, { ingredientById, consumableCost: 1.5 })).toBe(1.5)
  })

  it('ถ้ากรอกต้นทุนเองไว้ ใช้ค่านั้นเลย', () => {
    expect(unitCost({ ...squid, cost_override: 7 }, opts)).toBe(7)
  })
})

describe('bundleCost', () => {
  it('เซ็ต 8 ไม้ = ต้นทุนหมึก 8 ไม้ + ค่าบรรจุภัณฑ์ 1 ชุด', () => {
    const bundle = { is_bundle: true, components: [{ product_id: 'p1', qty: 8 }] }
    expect(bundleCost(bundle, opts)).toBe(41) // 8 × 4.5 + 5
  })

  it('เซ็ตรวมหลายสินค้าแชร์ค่าบรรจุภัณฑ์ชุดเดียว', () => {
    const bundle = {
      is_bundle: true,
      components: [{ product_id: 'p1', qty: 8 }, { product_id: 'p2', qty: 5 }],
    }
    // หมึก 36 + ลูกชิ้น (50/20 + 1.5 = 4) × 5 = 20 + แพ็ค 5
    expect(bundleCost(bundle, opts)).toBe(61)
  })

  it('เซ็ตว่างเหลือแค่ค่าบรรจุภัณฑ์', () => {
    expect(bundleCost({ components: [] }, opts)).toBe(5)
  })
})

describe('bundleStock', () => {
  it('ทำได้กี่ชุดคิดจากส่วนประกอบที่จำกัดที่สุด', () => {
    const bundle = { components: [{ product_id: 'p1', qty: 8 }] }
    expect(bundleStock(bundle, productById)).toBe(4) // 32 ÷ 8
  })

  it('ส่วนประกอบที่เหลือน้อยสุดเป็นตัวกำหนด', () => {
    const bundle = { components: [{ product_id: 'p1', qty: 8 }, { product_id: 'p2', qty: 20 }] }
    expect(bundleStock(bundle, productById)).toBe(2) // หมึกทำได้ 4 แต่ลูกชิ้นทำได้ 2
  })

  it('ส่วนประกอบหมด ทำไม่ได้เลย', () => {
    const empty = new Map([['p1', { ...squid, stock_qty: 0 }]])
    expect(bundleStock({ components: [{ product_id: 'p1', qty: 8 }] }, empty)).toBe(0)
  })

  it('เซ็ตที่ไม่มีส่วนประกอบคืน 0 ไม่ใช่ Infinity', () => {
    expect(bundleStock({ components: [] }, productById)).toBe(0)
  })
})

describe('netAfterGp', () => {
  it('ขาย 120 หัก GP 30% เหลือ 84', () => {
    expect(netAfterGp(120, 0.3)).toBeCloseTo(84, 5)
  })

  it('ไม่มี GP ได้เต็ม', () => {
    expect(netAfterGp(100, 0)).toBe(100)
  })
})

describe('suggestDeliveryPrice', () => {
  it('เซ็ต 8 ไม้ ต้นทุน 41 → แนะนำ 120', () => {
    expect(suggestDeliveryPrice(41, 0.3, 0.35)).toBe(120)
  })

  it('เซ็ต 3 ไม้ ต้นทุน 18.5 → แนะนำ 55', () => {
    expect(suggestDeliveryPrice(18.5, 0.3, 0.35)).toBe(55)
  })

  it('ปัดขึ้นเป็นเลขลงท้าย 0 หรือ 5 เสมอ', () => {
    expect(roundUpToFive(117.1)).toBe(120)
    expect(roundUpToFive(52.9)).toBe(55)
    expect(roundUpToFive(55)).toBe(55)
  })

  it('ต้นทุน 0 ไม่แนะนำราคา', () => {
    expect(suggestDeliveryPrice(0)).toBe(0)
  })
})

describe('profitOf', () => {
  it('เซ็ต 8 ไม้ ขาย 120 ต้นทุน 41 GP 30% → กำไร 43 (36%)', () => {
    const r = profitOf({ price: 120, cost: 41, gpRate: 0.3 })
    expect(r.net).toBeCloseTo(84, 5)
    expect(r.profit).toBeCloseTo(43, 5)
    expect(r.margin).toBeCloseTo(0.3583, 3)
  })

  it('ราคาเดิม 100 บาท ยังได้กำไร 29 แต่มาร์จิ้นบางกว่า', () => {
    const r = profitOf({ price: 100, cost: 41, gpRate: 0.3 })
    expect(r.profit).toBeCloseTo(29, 5)
    expect(r.margin).toBeCloseTo(0.29, 3)
  })

  it('ขายหน้าร้านไม่มี GP — หมึกไม้ละ 10 ทุน 4.5 กำไร 5.5', () => {
    const r = profitOf({ price: 10, cost: 4.5, gpRate: 0 })
    expect(r.profit).toBeCloseTo(5.5, 5)
  })

  it('ตั้งราคาต่ำเกินไปได้กำไรติดลบ', () => {
    expect(profitOf({ price: 50, cost: 41, gpRate: 0.3 }).profit).toBeCloseTo(-6, 5)
  })
})

describe('breakEvenPrice', () => {
  it('ต้นทุน 41 GP 30% ต้องขายอย่างน้อย ~58.6 ถึงไม่ขาดทุน', () => {
    expect(breakEvenPrice(41, 0.3)).toBeCloseTo(58.571, 2)
  })

  it('ขายไม้เดี่ยวบนเดลิเวอรีต้องตั้ง 13.6 ขึ้นไป (ทุน 9.5 รวมแพ็ค)', () => {
    expect(breakEvenPrice(9.5, 0.3)).toBeCloseTo(13.571, 2)
  })
})
