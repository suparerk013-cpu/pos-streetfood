import { describe, expect, it } from 'vitest'
import {
  buildFreeLines,
  effectiveQtyByProduct,
  freeQtyFor,
  hasPromo,
  maxPaidQty,
  promoTiers,
  qtyToNextFree,
} from '../promo'

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', unit: 'ไม้', promo_buy_qty: 10, promo_free_qty: 1 }
const mussel = { id: 'p2', name: 'หอยแมลงภู่', unit: 'ถุง' }
const productById = new Map([['p1', squid], ['p2', mussel]])

const line = (productId, quantity, extra = {}) => ({
  key: `${productId}|${extra.tag ?? ''}`, productId, quantity, price: 10, ...extra,
})

describe('hasPromo', () => {
  it('ต้องตั้งทั้งซื้อและแถมถึงจะนับว่ามีโปร', () => {
    expect(hasPromo(squid)).toBe(true)
    expect(hasPromo(mussel)).toBe(false)
    expect(hasPromo({ promo_buy_qty: 10, promo_free_qty: 0 })).toBe(false)
  })
})

describe('freeQtyFor', () => {
  it('ซื้อ 10 แถม 1', () => {
    expect(freeQtyFor(squid, 10)).toBe(1)
  })

  it('ซื้อ 20 แถม 2 อัตโนมัติโดยไม่ต้องตั้งเพิ่ม', () => {
    expect(freeQtyFor(squid, 20)).toBe(2)
  })

  it('ซื้อ 19 ยังได้แค่ 1', () => {
    expect(freeQtyFor(squid, 19)).toBe(1)
  })

  it('ซื้อไม่ถึงเกณฑ์ไม่ได้ของแถม', () => {
    expect(freeQtyFor(squid, 9)).toBe(0)
    expect(freeQtyFor(squid, 0)).toBe(0)
  })

  it('สินค้าที่ไม่มีโปรไม่มีของแถม', () => {
    expect(freeQtyFor(mussel, 100)).toBe(0)
  })
})

describe('qtyToNextFree', () => {
  it('ซื้อ 7 อีก 3 ไม้ได้ของแถม', () => {
    expect(qtyToNextFree(squid, 7)).toBe(3)
  })

  // ซื้อครบ 10 แล้วได้แถม 1 ไปแล้ว ชิ้นแถมถัดไปต้องซื้อเพิ่มอีก 10
  it('ครบพอดีแล้วนับต่อไปยังของแถมชิ้นถัดไป', () => {
    expect(qtyToNextFree(squid, 10)).toBe(10)
  })

  it('สินค้าไม่มีโปรคืน null', () => {
    expect(qtyToNextFree(mussel, 5)).toBeNull()
  })
})

describe('buildFreeLines', () => {
  it('สร้างแถวของแถมราคา 0', () => {
    const lines = buildFreeLines([line('p1', 10)], productById)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ productId: 'p1', quantity: 1, price: 0, isFree: true })
  })

  it('รวมจำนวนข้ามแถวของสินค้าเดียวกัน — แยกแถวเพราะตัวเลือกต่างกันก็ยังนับรวม', () => {
    const lines = buildFreeLines(
      [line('p1', 6, { tag: 'เผ็ด' }), line('p1', 4, { tag: 'ไม่เผ็ด' })],
      productById,
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(1)
  })

  it('ไม่แถมบนช่องทางเดลิเวอรี', () => {
    expect(buildFreeLines([line('p1', 20)], productById, { channel: 'delivery' })).toEqual([])
  })

  it('ของแถมไม่ทบไปสร้างของแถมซ้อน', () => {
    const cart = [line('p1', 10), { ...line('p1', 1), isFree: true, price: 0 }]
    expect(buildFreeLines(cart, productById)[0].quantity).toBe(1)
  })

  it('ตะกร้าไม่มีสินค้าที่มีโปรก็ไม่มีของแถม', () => {
    expect(buildFreeLines([line('p2', 50)], productById)).toEqual([])
  })
})

describe('effectiveQtyByProduct', () => {
  it('สต็อกต้องตัดทั้งที่ขายและที่แถม', () => {
    const map = effectiveQtyByProduct([line('p1', 10)], productById)
    expect(map.get('p1')).toBe(11)
  })

  it('ซื้อ 20 ตัดสต็อก 22', () => {
    expect(effectiveQtyByProduct([line('p1', 20)], productById).get('p1')).toBe(22)
  })

  it('บนเดลิเวอรีตัดเท่าที่ขายจริง', () => {
    const map = effectiveQtyByProduct([line('p1', 10)], productById, { channel: 'delivery' })
    expect(map.get('p1')).toBe(10)
  })
})

describe('maxPaidQty', () => {
  it('สต็อก 11 โปร 10 แถม 1 → ซื้อได้ 10 เพราะชิ้นที่ 11 กันไว้แถม', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(squid, 11)).toBe(10)
  })

  it('สต็อก 22 ซื้อได้ 20 แถม 2', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(squid, 22)).toBe(20)
  })

  it('สต็อกไม่ถึงเกณฑ์แถม ซื้อได้เท่าสต็อก', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(squid, 7)).toBe(7)
  })

  it('สต็อก 15 → ซื้อ 10 แถม 1 แล้วเหลือ 4 ซื้อต่อได้ รวม 14', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(squid, 15)).toBe(14)
  })

  it('สินค้าที่ไม่มีโปรซื้อได้เท่าสต็อก', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(mussel, 30)).toBe(30)
  })

  it('บนเดลิเวอรีไม่มีของแถม ซื้อได้เต็มสต็อก', async () => {
    const { maxPaidQty } = await import('../promo')
    expect(maxPaidQty(squid, 11, { channel: 'delivery' })).toBe(11)
  })
})

describe('โปรหลายชั้น', () => {
  // ซื้อ 10 แถม 1 กับ ซื้อ 20 แถม 3 ตั้งไว้พร้อมกัน
  const tiered = {
    id: 'p9', name: 'ปลาหมึกย่าง', unit: 'ไม้',
    promos: [{ buy: 10, free: 1 }, { buy: 20, free: 3 }],
  }

  it('อ่านโปรได้ครบและเรียงชั้นใหญ่ก่อน', () => {
    expect(promoTiers(tiered).map((t) => t.buy)).toEqual([20, 10])
    expect(hasPromo(tiered)).toBe(true)
  })

  it('ยังไม่ถึงชั้นใหญ่ ใช้ชั้นเล็ก', () => {
    expect(freeQtyFor(tiered, 10)).toBe(1)
    expect(freeQtyFor(tiered, 19)).toBe(1)
  })

  it('ถึงชั้นใหญ่แล้วได้ตามชั้นใหญ่ ไม่ใช่ชั้นเล็กสองรอบ', () => {
    expect(freeQtyFor(tiered, 20)).toBe(3)
  })

  it('เกินชั้นใหญ่แล้วเศษที่เหลือยังใช้ชั้นเล็กต่อได้', () => {
    expect(freeQtyFor(tiered, 30)).toBe(4)
    expect(freeQtyFor(tiered, 40)).toBe(6)
  })

  it('ซื้อเพิ่มแล้วของแถมต้องไม่ลดลง แม้ตั้งโปรชั้นเล็กคุ้มกว่าชั้นใหญ่', () => {
    const odd = { id: 'p8', promos: [{ buy: 3, free: 2 }, { buy: 5, free: 1 }] }
    let previous = 0
    for (let qty = 0; qty <= 30; qty += 1) {
      const now = freeQtyFor(odd, qty)
      expect(now).toBeGreaterThanOrEqual(previous)
      previous = now
    }
    // ซื้อ 6 ควรได้ 4 (3 แถม 2 สองรอบ) ไม่ใช่ 1 จากการหักชั้นใหญ่ก่อน
    expect(freeQtyFor(odd, 6)).toBe(4)
  })

  it('เพดานจำนวนที่ซื้อได้ต้องกันสต็อกไว้แถมตามชั้นที่ได้จริง', () => {
    // สต็อก 23: ซื้อ 20 แถม 3 = 23 พอดี
    expect(maxPaidQty(tiered, 23)).toBe(20)
    // สต็อก 22: ซื้อ 20 ต้องใช้ 23 เกินสต็อก จึงได้แค่ 19 (แถม 1 รวม 20)
    expect(maxPaidQty(tiered, 22)).toBe(19)
    // ซื้อ + แถม ต้องไม่เกินสต็อกเสมอ
    for (let stock = 0; stock <= 60; stock += 1) {
      const paid = maxPaidQty(tiered, stock)
      expect(paid + freeQtyFor(tiered, paid)).toBeLessThanOrEqual(stock)
      expect(paid + 1 + freeQtyFor(tiered, paid + 1)).toBeGreaterThan(stock)
    }
  })

  it('ข้อมูลเก่าที่เก็บเป็นคู่เดียวยังใช้ได้เหมือนเดิม', () => {
    const legacy = { id: 'p7', promo_buy_qty: 10, promo_free_qty: 1 }
    expect(promoTiers(legacy)).toEqual([{ buy: 10, free: 1 }])
    expect(freeQtyFor(legacy, 25)).toBe(2)
  })

  it('ชั้นที่กรอกไม่ครบถูกตัดทิ้ง ไม่พังทั้งโปร', () => {
    const messy = { id: 'p6', promos: [{ buy: 10, free: 1 }, { buy: 0, free: 5 }, { buy: 5 }] }
    expect(promoTiers(messy)).toEqual([{ buy: 10, free: 1 }])
  })
})
