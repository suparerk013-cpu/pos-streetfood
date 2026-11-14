import { describe, expect, it } from 'vitest'
import {
  OUTSIDE_SHIFT_KEY,
  groupByShift,
  hourlyWithinShift,
  netOfOrders,
  orderWindow,
  ordersInShiftRange,
  shiftTimeRange,
  totalsFromSummaries,
} from '../shiftSales'

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min)

// กะวันที่ 12 เปิดสี่โมงเย็น ปิดตีหนึ่งของวันที่ 13
const shift12 = { id: 's12', status: 'closed', opened_at: at(2026, 11, 12, 16, 10), closed_at: at(2026, 11, 13, 1, 5) }
const shift13 = { id: 's13', status: 'open', opened_at: at(2026, 11, 13, 16, 30), closed_at: null }

const order = (fields) => ({ channel: 'store', total_amount: 100, ...fields })

describe('netOfOrders — เงินเข้ากระเป๋าจริง', () => {
  it('หน้าร้านได้เต็ม เดลิเวอรีหัก GP ตามแอป', () => {
    const orders = [
      order({ total_amount: 3000 }),
      order({ channel: 'delivery', platform: 'GrabFood', total_amount: 2000 }),
    ]
    expect(netOfOrders(orders, () => 0.3)).toBeCloseTo(4400)
  })
})

describe('groupByShift — หนึ่งกะหนึ่งแท่ง', () => {
  it('บิลหลังเที่ยงคืนยังนับเป็นของกะที่เปิดเมื่อวาน ไม่ถูกผ่าครึ่ง', () => {
    const orders = [
      order({ shift_id: 's12', created_at: at(2026, 11, 12, 18) }),
      order({ shift_id: 's12', created_at: at(2026, 11, 13, 0, 30) }),
    ]
    const rows = groupByShift(orders, [shift12], { rateFor: () => 0 })
    expect(rows).toHaveLength(1)
    expect(rows[0].gross).toBe(200)
    expect(rows[0].count).toBe(2)
    expect(rows[0].label).toBe('12/11')
  })

  it('เรียงกะเก่าไปใหม่ อ่านกราฟซ้ายไปขวาได้', () => {
    const rows = groupByShift([], [shift13, shift12], { rateFor: () => 0 })
    expect(rows.map((r) => r.shiftId)).toEqual(['s12', 's13'])
  })

  it('กะที่เปิดแต่ขายไม่ได้เลยยังมีแท่งศูนย์ ไม่หายไปเหมือนวันปิดร้าน', () => {
    const rows = groupByShift([], [shift12], { rateFor: () => 0 })
    expect(rows[0].gross).toBe(0)
  })

  it('บิลที่ขายตอนไม่ได้เปิดกะ รวมเป็นแท่งนอกกะ เงินไม่หายเงียบ', () => {
    const orders = [order({ shift_id: null, total_amount: 250 })]
    const rows = groupByShift(orders, [shift12], { rateFor: () => 0 })
    const outside = rows.find((r) => r.key === OUTSIDE_SHIFT_KEY)
    expect(outside.gross).toBe(250)
    expect(outside.isOutside).toBe(true)
  })

  it('ไม่มีบิลนอกกะ ก็ไม่มีแท่งนอกกะให้รก', () => {
    const rows = groupByShift([order({ shift_id: 's12' })], [shift12], { rateFor: () => 0 })
    expect(rows.some((r) => r.key === OUTSIDE_SHIFT_KEY)).toBe(false)
  })

  it('แยกยอดขายกับเงินเข้าจริงในแท่งเดียวกัน', () => {
    const orders = [
      order({ shift_id: 's12', total_amount: 3000 }),
      order({ shift_id: 's12', channel: 'delivery', platform: 'LINE MAN', total_amount: 2000 }),
    ]
    const [row] = groupByShift(orders, [shift12], { rateFor: () => 0.3 })
    expect(row.gross).toBe(5000)
    expect(row.net).toBeCloseTo(4400)
    expect(row.store).toBe(3000)
    expect(row.delivery).toBe(2000)
  })
})

describe('hourlyWithinShift — รายชั่วโมงข้ามเที่ยงคืน', () => {
  it('เที่ยงคืนครึ่งเป็นแท่งท้าย ๆ ของกะ ไม่ใช่แท่งแรกของกราฟ', () => {
    const orders = [
      order({ created_at: at(2026, 11, 12, 16, 20) }),
      order({ created_at: at(2026, 11, 13, 0, 30) }),
    ]
    const bars = hourlyWithinShift(orders, shift12)
    expect(bars[0].shortLabel).toBe('16')
    expect(bars[0].value).toBe(100)
    // 16,17,...,23,0 → เที่ยงคืนคือช่องที่ 8
    expect(bars[8].shortLabel).toBe('0')
    expect(bars[8].value).toBe(100)
  })

  it('กราฟยาวถึงชั่วโมงที่ปิดกะ ชั่วโมงที่ขายไม่ได้เห็นเป็นช่องว่าง', () => {
    const bars = hourlyWithinShift([order({ created_at: at(2026, 11, 12, 16, 20) })], shift12)
    expect(bars[bars.length - 1].shortLabel).toBe('1')
  })

  it('กะที่ยังเปิดอยู่ ยาวถึงตอนนี้', () => {
    const bars = hourlyWithinShift([], shift13, { now: at(2026, 11, 13, 19, 15) })
    expect(bars.map((b) => b.shortLabel)).toEqual(['16', '17', '18', '19'])
  })
})

describe('orderWindow — ช่วงที่ต้องดึงบิล', () => {
  it('ยืดจุดจบไปถึงเวลาปิดกะสุดท้าย บิลหลังเที่ยงคืนจะได้ไม่หลุด', () => {
    const { start, end } = orderWindow('2026-11-12', '2026-11-12', [shift12])
    expect(start).toEqual(at(2026, 11, 12, 0))
    expect(end).toEqual(shift12.closed_at)
  })

  it('กะที่ยังเปิดอยู่ ยืดถึงตอนนี้', () => {
    const now = at(2026, 11, 14, 0, 45)
    const { end } = orderWindow('2026-11-13', '2026-11-13', [shift13], { now })
    expect(end).toEqual(now)
  })
})

describe('ordersInShiftRange — เก็บเฉพาะบิลของช่วงนี้', () => {
  it('บิลตีหนึ่งของกะเมื่อวานที่ตกมาในช่วงเวลาที่ดึง ไม่นับเป็นของวันนี้', () => {
    const orders = [
      order({ shift_id: 's12', created_at: at(2026, 11, 13, 0, 30) }),
      order({ shift_id: 's13', created_at: at(2026, 11, 13, 18) }),
    ]
    const kept = ordersInShiftRange(orders, [shift13], '2026-11-13', '2026-11-13')
    expect(kept).toHaveLength(1)
    expect(kept[0].shift_id).toBe('s13')
  })

  it('บิลนอกกะนับตามวันในปฏิทิน เพราะไม่มีกะให้อ้าง', () => {
    const orders = [
      order({ shift_id: null, created_at: at(2026, 11, 13, 12) }),
      order({ shift_id: null, created_at: at(2026, 11, 14, 12) }),
    ]
    expect(ordersInShiftRange(orders, [], '2026-11-13', '2026-11-13')).toHaveLength(1)
  })
})

describe('totalsFromSummaries — เทียบช่วงก่อนจากสรุปที่เก็บไว้', () => {
  it('รวมยอดจากสรุปตอนปิดกะ ไม่ต้องนับบิลใหม่', () => {
    const shifts = [
      { status: 'closed', summary: { total: 4000, order_count: 40 } },
      { status: 'closed', summary: { total: 3000, order_count: 25 } },
    ]
    expect(totalsFromSummaries(shifts)).toEqual({ gross: 7000, count: 65 })
  })

  it('มีกะไหนไม่มีสรุป ไม่เทียบเลย ดีกว่าลูกศรหลอก', () => {
    const shifts = [
      { status: 'closed', summary: { total: 4000, order_count: 40 } },
      { status: 'closed', summary: null },
    ]
    expect(totalsFromSummaries(shifts)).toBe(null)
  })

  it('ไม่มีกะที่ปิดแล้วในช่วงนั้น ไม่มีอะไรให้เทียบ', () => {
    expect(totalsFromSummaries([])).toBe(null)
  })
})

describe('shiftTimeRange', () => {
  it('กะที่ยังไม่ปิดเขียนว่าตอนนี้', () => {
    expect(shiftTimeRange(shift13)).toBe('16:30 – ตอนนี้')
    expect(shiftTimeRange(shift12)).toBe('16:10 – 01:05')
  })
})

describe('compareShiftsHourly — เทียบรายชั่วโมงกับกะก่อน', async () => {
  const { compareShiftsHourly, previousShiftName } = await import('../shiftSales')
  const yest = { id: 'y', status: 'closed', opened_at: at(2026, 11, 12, 16, 10), closed_at: at(2026, 11, 13, 0, 50) }
  const today = { id: 't', status: 'open', opened_at: at(2026, 11, 13, 16, 30), closed_at: null }
  const yOrders = [
    order({ created_at: at(2026, 11, 12, 16, 20), total_amount: 100 }),
    order({ created_at: at(2026, 11, 12, 20, 15), total_amount: 300 }),
    order({ created_at: at(2026, 11, 12, 22, 0), total_amount: 500 }),
    order({ created_at: at(2026, 11, 13, 0, 30), total_amount: 200 }),
  ]
  const tOrders = [
    order({ created_at: at(2026, 11, 13, 16, 40), total_amount: 150 }),
    order({ created_at: at(2026, 11, 13, 20, 5), total_amount: 250 }),
  ]
  const now = at(2026, 11, 13, 20, 30)

  it('ชั่วโมงเดียวกันตามนาฬิกาอยู่แท่งเดียวกัน แม้เปิดร้านคนละนาที', () => {
    const { bars } = compareShiftsHourly(tOrders, today, yOrders, yest, { now })
    expect(bars[0]).toMatchObject({ shortLabel: '16', value: 150, compare: 100 })
    expect(bars[4]).toMatchObject({ shortLabel: '20', value: 250, compare: 300 })
  })

  it('แกนยาวถึงเวลาปิดกะเมื่อวาน (เที่ยงคืน) ชั่วโมงที่ยังไม่ถึงของวันนี้ติดป้ายว่ายังไม่ถึง', () => {
    const { bars } = compareShiftsHourly(tOrders, today, yOrders, yest, { now })
    expect(bars[bars.length - 1]).toMatchObject({ shortLabel: '0', compare: 200, future: true })
    expect(bars[4].future).toBe(false)
  })

  it('เทียบยอดถึงเวลาเดียวกัน ไม่เอายอดเต็มกะเมื่อวานมาเทียบยอดครึ่งกะ', () => {
    const { sameTime, previousTotal } = compareShiftsHourly(tOrders, today, yOrders, yest, { now })
    expect(sameTime).toMatchObject({ current: 400, previous: 400, at: '20:30' })
    expect(previousTotal).toBe(1100)
  })

  it('ดูกะที่ปิดแล้ว ไม่มีการเทียบเวลาเดียวกัน (เทียบทั้งกะแทน)', () => {
    const { sameTime } = compareShiftsHourly(yOrders, yest, [], null)
    expect(sameTime).toBe(null)
  })

  it('กะก่อนเปิดวันก่อนหน้าพอดีเรียกว่าเมื่อวาน ห่างกว่านั้นบอกวันที่', () => {
    expect(previousShiftName(today, yest)).toBe('เมื่อวาน')
    const older = { opened_at: at(2026, 11, 10, 16, 0) }
    expect(previousShiftName(today, older)).toBe('กะ 10/11')
  })
})
