import { describe, expect, it } from 'vitest'
import {
  eachDateInRange,
  getMonthRange,
  getPreviousRange,
  toDateString,
} from '../dates'

describe('toDateString', () => {
  it('เติมศูนย์หน้าเดือนและวันเสมอ', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getPreviousRange', () => {
  it('7 วันนี้ เทียบกับ 7 วันก่อนหน้าที่ยาวเท่ากัน', () => {
    expect(getPreviousRange('2026-09-04', '2026-09-10')).toEqual({
      from: '2026-08-28',
      to: '2026-09-03',
    })
  })

  it('วันเดียว เทียบกับเมื่อวาน', () => {
    expect(getPreviousRange('2026-09-04', '2026-09-04')).toEqual({
      from: '2026-09-03',
      to: '2026-09-03',
    })
  })
})

describe('getMonthRange', () => {
  it('ครอบทั้งเดือนตั้งแต่วันที่ 1 ถึงวันสุดท้าย', () => {
    expect(getMonthRange(new Date(2026, 1, 15))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })
})

describe('eachDateInRange', () => {
  it('คืนทุกวันในช่วง เพื่อให้กราฟมีแท่งครบแม้วันนั้นไม่มียอดขาย', () => {
    expect(eachDateInRange('2026-09-01', '2026-09-04')).toEqual([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
    ])
  })

  it('ช่วงวันเดียวคืนหนึ่งวัน', () => {
    expect(eachDateInRange('2026-09-04', '2026-09-04')).toEqual(['2026-09-04'])
  })
})
