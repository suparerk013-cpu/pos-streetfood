import { describe, expect, it } from 'vitest'
import { orderCost, summarizeDelivery, summarizeFreebies } from '../deliveryReport'
import { actualRate, effectiveRates } from '../payoutMath'

const unitCostOf = (id) => ({ p1: 4.5, p2: 20 })[id] ?? 0

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

describe('orderCost', () => {
  it('เซ็ตคิดต้นทุนจากส่วนประกอบ + ค่าบรรจุภัณฑ์', () => {
    expect(orderCost(deliveryOrder, { unitCostOf, packagingCost: 5 })).toBe(41) // 8 × 4.5 + 5
  })

  it('บิลหน้าร้านไม่มีค่าบรรจุภัณฑ์', () => {
    expect(orderCost(storeOrder, { unitCostOf, packagingCost: 5 })).toBe(49.5) // 11 × 4.5
  })

  it('ของแถมคิดต้นทุนเต็มแม้ราคาขายเป็น 0', () => {
    const noFree = { ...storeOrder, items: [{ product_id: 'p1', qty: 10 }] }
    expect(orderCost(storeOrder, { unitCostOf })).toBeGreaterThan(orderCost(noFree, { unitCostOf }))
  })
})

describe('summarizeDelivery', () => {
  const rateFor = () => 0.3
  const costOfOrder = (o) => orderCost(o, { unitCostOf, packagingCost: 5 })

  it('แยกยอดตามแอปและคิดกำไรหลังหัก GP', () => {
    const rows = summarizeDelivery([deliveryOrder, storeOrder], { rateFor, costOfOrder })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ platform: 'GrabFood', gross: 120, orders: 1 })
    expect(rows[0].fee).toBeCloseTo(36, 5)
    expect(rows[0].net).toBeCloseTo(84, 5)
    expect(rows[0].profit).toBeCloseTo(43, 5)
  })

  it('ไม่นับบิลหน้าร้านเข้ามาด้วย', () => {
    expect(summarizeDelivery([storeOrder], { rateFor, costOfOrder })).toEqual([])
  })

  it('เรียงจากยอดขายมากไปน้อย', () => {
    const small = { ...deliveryOrder, platform: 'Shopee Food', total_amount: 50, items: [] }
    const rows = summarizeDelivery([small, deliveryOrder], { rateFor, costOfOrder })
    expect(rows.map((r) => r.platform)).toEqual(['GrabFood', 'Shopee Food'])
  })
})

describe('summarizeFreebies', () => {
  it('รวมของแถมพร้อมต้นทุน', () => {
    const rows = summarizeFreebies([storeOrder], { unitCostOf, nameOf: () => 'ปลาหมึกย่าง' })
    expect(rows[0]).toMatchObject({ qty: 1, name: 'ปลาหมึกย่าง' })
    expect(rows[0].cost).toBeCloseTo(4.5, 5)
  })

  it('บิลที่ไม่มีของแถมคืนลิสต์ว่าง', () => {
    expect(summarizeFreebies([deliveryOrder], { unitCostOf })).toEqual([])
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
