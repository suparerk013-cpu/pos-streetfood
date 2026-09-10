import { describe, expect, it } from 'vitest'
import { InsufficientStockError, summarizePayments } from './orders'

describe('summarizePayments', () => {
  it('รวมข้อความช่องทางชำระ + ยอด และรวมเงินทอนทั้งหมด', () => {
    const { line, changeTotal } = summarizePayments([
      { method: 'cash', amount: 100, change: 20 },
      { method: 'promptpay', amount: 50 },
    ])
    expect(line).toBe('เงินสด 100 + โมบายแบงค์กิ้ง 50')
    expect(changeTotal).toBe(20)
  })
})

describe('InsufficientStockError', () => {
  it('สร้างข้อความสรุปสินค้าที่สต็อกไม่พอ', () => {
    const err = new InsufficientStockError([{ name: 'หอยแมลงภู่', available: 2, requested: 5 }])
    expect(err.message).toContain('หอยแมลงภู่')
    expect(err.message).toContain('เหลือ 2')
    expect(err.shortages).toHaveLength(1)
  })
})
