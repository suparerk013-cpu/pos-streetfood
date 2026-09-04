import { describe, expect, it } from 'vitest'
import { expandToStockUnits, isBundle, missingDeliveryPrice, priceFor, sellableIn } from '../bundles'

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, channel: 'store', is_active: true }
const mussel = { id: 'p2', name: 'หอยแมลงภู่', price: 50, channel: 'both', is_active: true, delivery_price: 75 }
const set8 = {
  id: 's1', name: 'ปลาหมึก 8 ไม้', price: 80, delivery_price: 120,
  is_bundle: true, channel: 'delivery', is_active: true,
  components: [{ product_id: 'p1', qty: 8 }],
}
const setMix = {
  id: 's2', name: 'หมึก 8 + ลูกชิ้น 5', is_bundle: true, channel: 'delivery', is_active: true,
  price: 0, delivery_price: 155,
  components: [{ product_id: 'p1', qty: 8 }, { product_id: 'p3', qty: 5 }],
}
const archived = { id: 'p9', name: 'เลิกขาย', price: 20, channel: 'both', is_active: false }

const productById = new Map([[squid.id, squid], [mussel.id, mussel], [set8.id, set8], [setMix.id, setMix]])
const all = [squid, mussel, set8, setMix, archived]

describe('isBundle', () => {
  it('เซ็ตต้องมีทั้งธงและส่วนประกอบ', () => {
    expect(isBundle(set8)).toBe(true)
    expect(isBundle(squid)).toBe(false)
    expect(isBundle({ is_bundle: true, components: [] })).toBe(false)
  })
})

describe('sellableIn', () => {
  it('หน้าร้านเห็นสินค้าหน้าร้านและทั้งคู่ ไม่เห็นเซ็ตเดลิเวอรี', () => {
    expect(sellableIn(all, 'store').map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('เดลิเวอรีเห็นเซ็ตและสินค้าที่ตั้งเป็นทั้งคู่', () => {
    expect(sellableIn(all, 'delivery').map((p) => p.id)).toEqual(['p2', 's1', 's2'])
  })

  it('สินค้าที่เลิกขายไม่โผล่ในช่องทางไหนเลย', () => {
    expect(sellableIn(all, 'store').some((p) => p.id === 'p9')).toBe(false)
    expect(sellableIn(all, 'delivery').some((p) => p.id === 'p9')).toBe(false)
  })

  it('สินค้าที่ไม่ได้ตั้ง channel ถือเป็นหน้าร้าน', () => {
    expect(sellableIn([{ id: 'x', is_active: true }], 'store')).toHaveLength(1)
    expect(sellableIn([{ id: 'x', is_active: true }], 'delivery')).toHaveLength(0)
  })
})

describe('priceFor', () => {
  it('ช่องทางเดลิเวอรีใช้ราคาเดลิเวอรี', () => {
    expect(priceFor(mussel, 'delivery')).toBe(75)
  })

  it('ช่องทางหน้าร้านใช้ราคาปกติ', () => {
    expect(priceFor(mussel, 'store')).toBe(50)
  })

  it('ยังไม่ตั้งราคาเดลิเวอรี ใช้ราคาหน้าร้านแทน', () => {
    expect(priceFor(squid, 'delivery')).toBe(10)
  })
})

describe('missingDeliveryPrice', () => {
  it('เตือนได้ว่าสินค้านี้ยังไม่ตั้งราคาเดลิเวอรี', () => {
    expect(missingDeliveryPrice(squid)).toBe(true)
    expect(missingDeliveryPrice(mussel)).toBe(false)
  })
})

describe('expandToStockUnits', () => {
  it('เซ็ต 8 ไม้ 2 ชุด ตัดสต็อกหมึก 16 ไม้', () => {
    const map = expandToStockUnits([{ productId: 's1', quantity: 2 }], productById)
    expect(map.get('p1')).toBe(16)
    expect(map.has('s1')).toBe(false)
  })

  it('เซ็ตรวมกระจายทุกส่วนประกอบ', () => {
    const map = expandToStockUnits([{ productId: 's2', quantity: 1 }], productById)
    expect(map.get('p1')).toBe(8)
    expect(map.get('p3')).toBe(5)
  })

  it('ซื้อทั้งเซ็ตและสินค้าเดี่ยว จำนวนบวกกัน', () => {
    const map = expandToStockUnits(
      [{ productId: 's1', quantity: 1 }, { productId: 'p1', quantity: 3 }],
      productById,
    )
    expect(map.get('p1')).toBe(11)
  })

  it('สินค้าธรรมดาผ่านไปตามเดิม', () => {
    const map = expandToStockUnits([{ productId: 'p2', quantity: 4 }], productById)
    expect(map.get('p2')).toBe(4)
  })
})
