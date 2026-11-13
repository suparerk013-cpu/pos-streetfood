import { describe, expect, it } from 'vitest'
import { summarizeDelivery, summarizeFreebies } from '../deliveryReport'
import { actualRate, effectiveRates } from '../payoutMath'

const deliveryOrder = {
  channel: 'delivery',
  platform: 'GrabFood',
  total_amount: 120,
  items: [{ product_id: 's1', qty: 1, is_bundle: true, components: [{ product_id: 'p1', qty: 8 }] }],
}
const storeOrder = {
  channel: 'store',
  total_amount: 100,
  items: [{ product_id: 'p1', qty: 10 }, { product_id: 'p1', qty: 1, is_free: true }],
}

describe('summarizeDelivery', () => {
  const rateFor = () => 0.3

  it('แยกยอดตามแอป หัก GP แล้วบอกเงินที่เข้าจริง', () => {
    const rows = summarizeDelivery([deliveryOrder, storeOrder], { rateFor })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ platform: 'GrabFood', gross: 120, orders: 1 })
    expect(rows[0].fee).toBeCloseTo(36, 5)
    expect(rows[0].net).toBeCloseTo(84, 5)
  })

  it('ไม่นับบิลหน้าร้านเข้ามาด้วย', () => {
    expect(summarizeDelivery([storeOrder], { rateFor })).toEqual([])
  })

  it('เรียงจากยอดขายมากไปน้อย', () => {
    const small = { ...deliveryOrder, platform: 'Shopee Food', total_amount: 50, items: [] }
    const rows = summarizeDelivery([small, deliveryOrder], { rateFor })
    expect(rows.map((r) => r.platform)).toEqual(['GrabFood', 'Shopee Food'])
  })
})

describe('summarizeFreebies', () => {
  it('นับของแถมเป็นชิ้น', () => {
    const rows = summarizeFreebies([storeOrder], { nameOf: () => 'ปลาหมึกย่าง' })
    expect(rows[0]).toMatchObject({ qty: 1, name: 'ปลาหมึกย่าง' })
  })

  it('บิลที่ไม่มีของแถมคืนลิสต์ว่าง', () => {
    expect(summarizeFreebies([deliveryOrder])).toEqual([])
  })
})

describe('actualRate', () => {
  it('ยอด 18,400 เข้าจริง 12,070 = ถูกหัก 34.4%', () => {
    expect(actualRate(18400, 12070)).toBeCloseTo(0.3440, 3)
  })

  it('ยอด 0 ไม่คำนวณอัตรา', () => {
    expect(actualRate(0, 0)).toBe(0)
  })

  it('เงินเข้ามากกว่ายอดขาย อัตราไม่ติดลบ', () => {
    expect(actualRate(100, 150)).toBe(0)
  })
})

describe('effectiveRates', () => {
  it('ใช้อัตราจากรอบจ่ายเงินล่าสุดของแอปนั้น', () => {
    const rateFor = effectiveRates(
      [
        { platform: 'GrabFood', to: '2026-08-31', actual_rate: 0.32 },
        { platform: 'GrabFood', to: '2026-09-15', actual_rate: 0.344 },
      ],
      () => 0.3,
    )
    expect(rateFor('GrabFood')).toBeCloseTo(0.344, 5)
  })

  it('แอปที่ยังไม่มีรอบจ่ายเงินใช้ค่าที่ตั้งไว้ในหน้าตั้งค่า', () => {
    const rateFor = effectiveRates([], (p) => (p === 'LINE MAN' ? 0.28 : 0.3))
    expect(rateFor('LINE MAN')).toBe(0.28)
  })
})
