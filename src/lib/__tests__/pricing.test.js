import { describe, expect, it } from 'vitest'
import { bundleStock, netAfterGp, separatePriceOf } from '../pricing'

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, stock_qty: 32 }
const ball = { id: 'p2', name: 'ลูกชิ้นปิ้ง', price: 5, stock_qty: 40 }
const productById = new Map([[squid.id, squid], [ball.id, ball]])

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

describe('separatePriceOf — ราคาถ้าซื้อแยกที่หน้าร้าน', () => {
  it('รวมราคาขายปกติของส่วนประกอบทุกชิ้น', () => {
    const bundle = { components: [{ product_id: 'p1', qty: 8 }, { product_id: 'p2', qty: 4 }] }
    expect(separatePriceOf(bundle, productById)).toBe(100) // 8×10 + 4×5
  })

  it('สินค้าที่ถูกลบไปแล้วนับเป็นศูนย์ ไม่พัง', () => {
    expect(separatePriceOf({ components: [{ product_id: 'ไม่มีแล้ว', qty: 3 }] }, productById)).toBe(0)
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
