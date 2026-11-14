import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({}))

const { nextQueueNo } = await import('../orders')
const { dailyProductsToReset } = await import('../shiftActions')

const today = '2026-11-14'

describe('nextQueueNo — เลขคิวนับตามกะ', () => {
  it('กะเดียวกันข้ามเที่ยงคืน นับต่อ ไม่กลับไปเป็น 1', () => {
    const data = { current_value: 37, day: '2026-11-13', shift_id: 's1' }
    expect(nextQueueNo(data, { shiftId: 's1', today }).value).toBe(38)
  })

  it('กะใหม่เริ่ม 1', () => {
    const data = { current_value: 37, day: today, shift_id: 's1' }
    expect(nextQueueNo(data, { shiftId: 's2', today }).value).toBe(1)
  })

  it('ตัวนับแบบเก่าที่ยังไม่จำกะ วันเดียวกัน นับต่อ กะที่เปิดค้างตอนอัปเดตจะได้ไม่มีคิว 1 ซ้ำ', () => {
    const data = { current_value: 12, day: today }
    const next = nextQueueNo(data, { shiftId: 's1', today })
    expect(next).toEqual({ value: 13, day: today, shiftId: 's1' })
  })

  it('ขายตอนไม่ได้เปิดกะ ใช้วันที่แบบเดิม', () => {
    expect(nextQueueNo({ current_value: 5, day: today, shift_id: 's1' }, { today }).value).toBe(6)
    expect(nextQueueNo({ current_value: 5, day: '2026-11-13' }, { today }).value).toBe(1)
    expect(nextQueueNo(null, { today }).value).toBe(1)
  })
})

describe('dailyProductsToReset — เปิดกะล้างสต็อกรายวัน', () => {
  it('เอาเฉพาะสินค้ารายวันที่ยังมีของค้าง ไม่รวมเซ็ต', () => {
    const products = [
      { id: 'a', stock_type: 'daily', stock_qty: 3 },
      { id: 'b', stock_type: 'daily', stock_qty: 0 },
      { id: 'c', stock_type: 'batch', stock_qty: 9 },
      { id: 'd', stock_type: 'daily', is_bundle: true, stock_qty: 2 },
    ]
    expect(dailyProductsToReset(products).map((p) => p.id)).toEqual(['a'])
  })
})
