import { describe, expect, it } from 'vitest'
import {
  cartSubtotal,
  effectiveQtyByProduct,
  freeQtyFor,
  hasPromo,
  lineBreakdown,
  promoTiers,
  qtyToNextFree,
  splitCart,
  splitPaidAndFree,
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

/**
 * จำนวนในตะกร้าคือของที่ลูกค้ารับไปทั้งหมด ไม่ใช่จำนวนที่คิดเงิน
 * คนขายกด 11 ไม้ตามที่ลูกค้าขอ ต้องเก็บ 100 บาท ไม่ใช่ 110 แล้วแถมเพิ่มอีกไม้
 */
describe('splitPaidAndFree — กด 11 ไม้ ต้องเป็น 100 บาท', () => {
  // ปลาหมึก 10 ฿/ไม้ · ซื้อ 10 แถม 1
  const cases = [
    [9, 9, 0],
    [10, 10, 0],
    [11, 10, 1],
    [12, 11, 1],
    [20, 19, 1],
    [21, 20, 1],
    [22, 20, 2],
    [33, 30, 3],
  ]

  it.each(cases)('รับไป %i ไม้ → คิดเงิน %i แถม %i', (total, paid, free) => {
    expect(splitPaidAndFree(squid, total)).toEqual({ paid, free })
  })

  it('ที่คิดเงิน + ที่แถม ต้องเท่ากับที่ลูกค้ารับไปเสมอ และแถมต้องไม่เกินสิทธิ์', () => {
    for (let total = 0; total <= 60; total += 1) {
      const { paid, free } = splitPaidAndFree(squid, total)
      expect(paid + free).toBe(total)
      expect(free).toBeLessThanOrEqual(freeQtyFor(squid, paid))
    }
  })

  it('คิดเงินน้อยที่สุดเท่าที่ยังครอบคลุมของที่รับไปครบ', () => {
    for (let total = 1; total <= 60; total += 1) {
      const { paid } = splitPaidAndFree(squid, total)
      if (paid > 0) {
        expect(paid - 1 + freeQtyFor(squid, paid - 1)).toBeLessThan(total)
      }
    }
  })

  it('สินค้าไม่มีโปร คิดเงินเต็มจำนวน', () => {
    expect(splitPaidAndFree(mussel, 11)).toEqual({ paid: 11, free: 0 })
  })

  it('เดลิเวอรีไม่แถม คิดเงินเต็มจำนวน', () => {
    expect(splitPaidAndFree(squid, 11, { channel: 'delivery' })).toEqual({ paid: 11, free: 0 })
  })

  it('โปรหลายชั้นก็แยกถูก — ซื้อ 20 แถม 3 คู่กับ ซื้อ 10 แถม 1', () => {
    const tiered = { id: 'p3', promos: [{ buy: 10, free: 1 }, { buy: 20, free: 3 }] }
    expect(splitPaidAndFree(tiered, 23)).toEqual({ paid: 20, free: 3 })
    expect(splitPaidAndFree(tiered, 22)).toEqual({ paid: 20, free: 2 })
  })
})

describe('splitCart / cartSubtotal', () => {
  it('กด 11 ไม้ → บิลแยกเป็นขาย 10 กับแถม 1 เก็บเงิน 100', () => {
    const cart = [line('p1', 11)]
    const { paidLines, freeLines } = splitCart(cart, productById)

    expect(paidLines).toHaveLength(1)
    expect(paidLines[0].quantity).toBe(10)
    expect(freeLines).toHaveLength(1)
    expect(freeLines[0]).toMatchObject({ productId: 'p1', quantity: 1, price: 0, isFree: true })
    expect(cartSubtotal(cart, productById)).toBe(100)
  })

  it('กด 12 ไม้ → เก็บ 110', () => {
    expect(cartSubtotal([line('p1', 12)], productById)).toBe(110)
  })

  it('สินค้าที่ไม่มีโปรไม่มีบรรทัดแถม', () => {
    const { freeLines } = splitCart([line('p2', 5)], productById)
    expect(freeLines).toHaveLength(0)
  })

  it('เดลิเวอรีไม่มีของแถม เก็บเต็มจำนวน', () => {
    const cart = [line('p1', 11)]
    expect(splitCart(cart, productById, { channel: 'delivery' }).freeLines).toHaveLength(0)
    expect(cartSubtotal(cart, productById, { channel: 'delivery' })).toBe(110)
  })

  it('ตะกร้าว่างยอดเป็น 0', () => {
    expect(cartSubtotal([], productById)).toBe(0)
  })
})

describe('lineBreakdown', () => {
  it('แถวในตะกร้าโชว์ราคาที่หักของแถมแล้ว พร้อมจำนวนที่แถม', () => {
    expect(lineBreakdown(line('p1', 11), squid)).toEqual({ paid: 10, free: 1, lineTotal: 100 })
  })

  it('สินค้าไม่มีโปรโชว์ราคาเต็ม', () => {
    expect(lineBreakdown(line('p2', 3), mussel)).toEqual({ paid: 3, free: 0, lineTotal: 30 })
  })
})

describe('effectiveQtyByProduct', () => {
  it('ตัดสต็อกเท่ากับจำนวนที่กด เพราะรวมของแถมอยู่แล้ว', () => {
    const map = effectiveQtyByProduct([line('p1', 11), line('p2', 2)])
    expect(map.get('p1')).toBe(11)
    expect(map.get('p2')).toBe(2)
  })
})
