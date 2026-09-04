import { describe, expect, it } from 'vitest'
import { displayName, toEmail } from '../authUsername'

describe('toEmail', () => {
  it('ชื่อสั้น ๆ ถูกเติมโดเมนหลังบ้านให้', () => {
    expect(toEmail('pos')).toBe('pos@pos.local')
  })

  it('พิมพ์อีเมลเต็มมาก็ใช้ได้ตามเดิม บัญชีเก่ายังล็อกอินได้', () => {
    expect(toEmail('somchai@gmail.com')).toBe('somchai@gmail.com')
  })

  it('ตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็ก', () => {
    expect(toEmail('  POS  ')).toBe('pos@pos.local')
    expect(toEmail('Somchai@Gmail.com')).toBe('somchai@gmail.com')
  })

  it('ค่าว่างคืนค่าว่าง ไม่เติมโดเมนให้กลายเป็นชื่อที่ใช้ไม่ได้', () => {
    expect(toEmail('')).toBe('')
    expect(toEmail('   ')).toBe('')
    expect(toEmail(null)).toBe('')
    expect(toEmail(undefined)).toBe('')
  })
})

describe('displayName', () => {
  it('ตัดโดเมนหลังบ้านออกเวลาแสดงผล', () => {
    expect(displayName('pos@pos.local')).toBe('pos')
  })

  it('อีเมลจริงแสดงเต็ม', () => {
    expect(displayName('somchai@gmail.com')).toBe('somchai@gmail.com')
  })

  it('ยังไม่ล็อกอินแสดงขีด', () => {
    expect(displayName(null)).toBe('-')
    expect(displayName('')).toBe('-')
  })
})
