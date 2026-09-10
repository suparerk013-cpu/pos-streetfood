import { describe, expect, it } from 'vitest'
import { toDateString } from './expenses'

describe('toDateString', () => {
  it('แปลงวันที่เป็นรูปแบบ YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('เติมเลข 0 นำหน้าเดือน/วันที่เป็นหลักเดียว', () => {
    expect(toDateString(new Date(2026, 8, 2))).toBe('2026-09-02')
  })
})
