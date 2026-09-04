import { describe, expect, it } from 'vitest'
import { calcCashExpected, shiftCashDiff } from '../shifts'

describe('calcCashExpected', () => {
  it('เงินในลิ้นชัก = ทอนตั้งต้น + ยอดขายเงินสด', () => {
    expect(calcCashExpected(500, 3200)).toBe(3700)
  })

  it('ไม่หักเงินทอนซ้ำ — payment.amount เป็นยอดสุทธิหลังทอนแล้ว', () => {
    // ขาย 40 บาท รับมา 100 ทอน 60 → amount = 40, cash_received = 100, change = 60
    // เงินที่เพิ่มในลิ้นชักจริงคือ 40 ไม่ใช่ 40 - 60
    const cashSales = 40
    expect(calcCashExpected(500, cashSales)).toBe(540)
  })

  it('รับค่า null/undefined ได้โดยไม่พัง', () => {
    expect(calcCashExpected(null, undefined)).toBe(0)
    expect(calcCashExpected(undefined, 100)).toBe(100)
  })
})

describe('shiftCashDiff', () => {
  it('เงินครบพอดีได้ผลต่าง 0', () => {
    const shift = { cash_counted: 3700, summary: { opening_float: 500, cash_sales: 3200 } }
    expect(shiftCashDiff(shift)).toEqual({ expected: 3700, counted: 3700, diff: 0 })
  })

  it('เงินขาดได้ผลต่างติดลบ', () => {
    const shift = { cash_counted: 3650, summary: { opening_float: 500, cash_sales: 3200 } }
    expect(shiftCashDiff(shift).diff).toBe(-50)
  })

  it('คิดใหม่จากตัวเลขดิบ ไม่เชื่อ cash_diff เดิมที่เก็บไว้ผิด', () => {
    const shift = {
      cash_counted: 3700,
      summary: {
        opening_float: 500,
        cash_sales: 3200,
        change_total: 800,
        cash_expected: 2900, // ค่าผิดที่กะเก่าเก็บไว้ (หักเงินทอนซ้ำ)
        cash_diff: 800,      // ค่าผิดที่ทำให้ขึ้นว่า "เงินเกิน"
      },
    }
    expect(shiftCashDiff(shift)).toEqual({ expected: 3700, counted: 3700, diff: 0 })
  })

  it('กะที่ไม่มี summary ไม่ทำให้พัง', () => {
    expect(shiftCashDiff({}).diff).toBe(0)
    expect(shiftCashDiff(null).diff).toBe(0)
  })
})
