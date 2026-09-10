import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTime, PAYMENT_METHOD_LABELS } from './format'

const tsAt = (date) => ({ toDate: () => date })

describe('formatTime / formatDate / formatDateTime', () => {
  it('คืนค่าว่างเมื่อไม่มี timestamp ที่ใช้ได้', () => {
    expect(formatTime(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDateTime({})).toBe('')
  })

  it('format ค่าจาก Firestore Timestamp-like object ได้โดยไม่ throw', () => {
    const ts = tsAt(new Date(2026, 8, 2, 14, 30))
    expect(formatTime(ts)).toMatch(/14|02|:/i)
    expect(formatDate(ts).length).toBeGreaterThan(0)
    expect(formatDateTime(ts)).toBeTruthy()
  })
})

describe('PAYMENT_METHOD_LABELS', () => {
  it('มีป้ายกำกับครบทุกช่องทางชำระที่ระบบรองรับ', () => {
    expect(Object.keys(PAYMENT_METHOD_LABELS).sort()).toEqual(['cash', 'delivery', 'promptpay'])
  })
})
