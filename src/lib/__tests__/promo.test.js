import { describe, expect, it } from 'vitest'
import { buildFreeLines, effectiveQtyByProduct, freeQtyFor, hasPromo, qtyToNextFree } from '../promo'

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

  it('ครบพอดีแล้วไม่ต้องซื้อเพิ่ม', () => {
    expect(qtyToNextFree(squid, 10)).toBe(0)
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
