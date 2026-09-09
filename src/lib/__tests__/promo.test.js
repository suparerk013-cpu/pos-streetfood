import { describe, expect, it } from 'vitest'
import {
  cartSubtotal,
  effectiveQtyByProduct,
  maxKeyableQty,
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
describe('splitPaidAndFree — ลูกค้าได้ของแถมเต็มสิทธิ์เสมอ', () => {
  // ปลาหมึก 10 ฿/ไม้ · ซื้อ 10 แถม 1
  // [กด, คิดเงิน, แถม, ส่งให้ลูกค้า]
  const cases = [
    [9, 9, 0, 9],
    [10, 10, 1, 11],
    [11, 10, 1, 11],
    [12, 11, 1, 12],
    [19, 18, 1, 19],
    [20, 19, 1, 20],
    [21, 20, 2, 22],
    [22, 20, 2, 22],
  ]

  it.each(cases)('กด %i → คิดเงิน %i แถม %i ส่งให้ %i', (asked, paid, free, total) => {
    expect(splitPaidAndFree(squid, asked)).toEqual({ paid, free, total })
  })

  it('กด 10 กับ กด 11 ต้องได้ผลเหมือนกันเป๊ะ คนขายกดเลขไหนก็ไม่ผิด', () => {
    expect(splitPaidAndFree(squid, 10)).toEqual(splitPaidAndFree(squid, 11))
  })

  it('ของที่ส่งให้ต้องไม่น้อยกว่าที่ลูกค้าขอ และแถมต้องเต็มสิทธิ์ของยอดที่คิดเงิน', () => {
    for (let asked = 0; asked <= 60; asked += 1) {
      const { paid, free, total } = splitPaidAndFree(squid, asked)
      expect(total).toBe(paid + free)
      expect(total).toBeGreaterThanOrEqual(asked)
      expect(free).toBe(freeQtyFor(squid, paid))
    }
  })

  it('คิดเงินน้อยที่สุดเท่าที่ยังส่งของครบตามที่ลูกค้าขอ', () => {
    for (let asked = 1; asked <= 60; asked += 1) {
      const { paid } = splitPaidAndFree(squid, asked)
      if (paid > 0) {
        expect(paid - 1 + freeQtyFor(squid, paid - 1)).toBeLessThan(asked)
      }
    }
  })

  it('สินค้าไม่มีโปร คิดเงินเต็มจำนวน ไม่มีของแถม', () => {
    expect(splitPaidAndFree(mussel, 11)).toEqual({ paid: 11, free: 0, total: 11 })
  })

  it('เดลิเวอรีไม่แถม คิดเงินเต็มจำนวน', () => {
    expect(splitPaidAndFree(squid, 11, { channel: 'delivery' })).toEqual({ paid: 11, free: 0, total: 11 })
  })

  it('โปรหลายชั้นเลือกทางที่ลูกค้าจ่ายน้อยที่สุดที่ยังได้ของครบตามที่ขอ', () => {
    const tiered = { id: 'p3', promos: [{ buy: 10, free: 1 }, { buy: 20, free: 3 }] }
    // ขอ 20 ไม้: จ่าย 19 ได้แถม 1 ครบ 20 พอดี ถูกกว่าจ่าย 20 แล้วได้ 23
    expect(splitPaidAndFree(tiered, 20)).toEqual({ paid: 19, free: 1, total: 20 })
    // ขอ 21 ขึ้นไป ต้องข้ามไปชั้น 20 แถม 3 แล้วได้ 23 ไม้เต็มสิทธิ์
    expect(splitPaidAndFree(tiered, 21)).toEqual({ paid: 20, free: 3, total: 23 })
    expect(splitPaidAndFree(tiered, 23)).toEqual({ paid: 20, free: 3, total: 23 })
  })
})

describe('maxKeyableQty', () => {
  it('สต็อก 10 กดได้แค่ 9 เพราะกด 10 ต้องส่งของ 11 ไม้ซึ่งไม่มี', () => {
    expect(maxKeyableQty(squid, 10)).toBe(9)
  })

  it('สต็อก 11 กดได้ 11 พอดี — จ่าย 10 แถม 1', () => {
    expect(maxKeyableQty(squid, 11)).toBe(11)
  })

  it('สต็อก 17 กดได้ 17 เต็ม', () => {
    expect(maxKeyableQty(squid, 17)).toBe(17)
  })

  it('กดเต็มเพดานแล้วของที่ต้องส่งต้องไม่เกินสต็อก และกดเพิ่มอีกชิ้นต้องเกิน', () => {
    for (let stock = 0; stock <= 60; stock += 1) {
      const cap = maxKeyableQty(squid, stock)
      expect(splitPaidAndFree(squid, cap).total).toBeLessThanOrEqual(stock)
      expect(splitPaidAndFree(squid, cap + 1).total).toBeGreaterThan(stock)
    }
  })

  it('สินค้าไม่มีโปร เพดานคือสต็อกตรง ๆ', () => {
    expect(maxKeyableQty(mussel, 10)).toBe(10)
  })

  it('เดลิเวอรีไม่แถม เพดานคือสต็อกตรง ๆ', () => {
    expect(maxKeyableQty(squid, 10, { channel: 'delivery' })).toBe(10)
  })
})

describe('splitCart / cartSubtotal', () => {
  it('กด 10 ไม้ → เก็บ 100 และมีบรรทัดแถม 1 ไม้ ส่งของรวม 11', () => {
    const cart = [line('p1', 10)]
    const { paidLines, freeLines } = splitCart(cart, productById)

    expect(paidLines[0].quantity).toBe(10)
    expect(freeLines[0]).toMatchObject({ productId: 'p1', quantity: 1, price: 0, isFree: true })
    expect(cartSubtotal(cart, productById)).toBe(100)
  })

  it('กด 11 ไม้ → เก็บ 100 เท่ากับกด 10', () => {
    expect(cartSubtotal([line('p1', 11)], productById)).toBe(100)
  })

  it('กด 12 ไม้ → เก็บ 110', () => {
    expect(cartSubtotal([line('p1', 12)], productById)).toBe(110)
  })

  it('สินค้าที่ไม่มีโปรไม่มีบรรทัดแถม', () => {
    expect(splitCart([line('p2', 5)], productById).freeLines).toHaveLength(0)
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
  it('กด 10 โชว์ราคา 100 พร้อมบอกว่าต้องส่ง 11 ไม้', () => {
    expect(lineBreakdown(line('p1', 10), squid)).toEqual({ paid: 10, free: 1, total: 11, lineTotal: 100 })
  })

  it('สินค้าไม่มีโปรโชว์ราคาเต็ม', () => {
    expect(lineBreakdown(line('p2', 3), mussel)).toEqual({ paid: 3, free: 0, total: 3, lineTotal: 30 })
  })
})

describe('effectiveQtyByProduct', () => {
  it('ตัดสต็อกเท่ากับที่คิดเงินบวกที่แถม ไม่ใช่แค่เลขที่กด', () => {
    const map = effectiveQtyByProduct([line('p1', 10), line('p2', 2)], productById)
    expect(map.get('p1')).toBe(11)
    expect(map.get('p2')).toBe(2)
  })
})
