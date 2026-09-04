import { describe, expect, it } from 'vitest'
import { stockUnitsFromItems, summarizePayments } from '../orderLines'

describe('stockUnitsFromItems', () => {
  it('สินค้าธรรมดาตัดสต็อกตามจำนวนที่ขาย', () => {
    const map = stockUnitsFromItems([{ product_id: 'p1', qty: 3 }])
    expect(map.get('p1')).toBe(3)
  })

  it('เซ็ตกระจายเป็นส่วนประกอบ ไม่ตัดที่ตัวเซ็ต', () => {
    const map = stockUnitsFromItems([
      { product_id: 's1', qty: 2, is_bundle: true, components: [{ product_id: 'p1', qty: 8 }] },
    ])
    expect(map.get('p1')).toBe(16)
    expect(map.has('s1')).toBe(false)
  })

  it('ของแถมตัดสต็อกด้วย แม้ราคาเป็น 0', () => {
    const map = stockUnitsFromItems([
      { product_id: 'p1', qty: 10 },
      { product_id: 'p1', qty: 1, is_free: true },
    ])
    expect(map.get('p1')).toBe(11)
  })

  it('เซ็ตรวมกับสินค้าเดี่ยวในบิลเดียวกัน จำนวนบวกกันถูกต้อง', () => {
    const map = stockUnitsFromItems([
      { product_id: 's1', qty: 1, is_bundle: true, components: [{ product_id: 'p1', qty: 8 }, { product_id: 'p2', qty: 5 }] },
      { product_id: 'p1', qty: 2 },
    ])
    expect(map.get('p1')).toBe(10)
    expect(map.get('p2')).toBe(5)
  })

  it('เซ็ตที่ไม่มีส่วนประกอบติดมาถูกนับเป็นสินค้าเดี่ยว ไม่หายไปเฉย ๆ', () => {
    const map = stockUnitsFromItems([{ product_id: 's1', qty: 1, is_bundle: true }])
    expect(map.get('s1')).toBe(1)
  })
})

describe('summarizePayments', () => {
  it('รวมข้อความและเงินทอนของหลายวิธีชำระ', () => {
    const r = summarizePayments([
      { method: 'cash', amount: 100, change: 20 },
      { method: 'promptpay', amount: 50 },
    ])
    expect(r.line).toBe('เงินสด 100 + โมบายแบงค์กิ้ง 50')
    expect(r.changeTotal).toBe(20)
  })

  it('ใช้ชื่อแพลตฟอร์มถ้าเป็นเดลิเวอรี', () => {
    expect(summarizePayments([{ method: 'delivery', platform: 'GrabFood', amount: 120 }]).line)
      .toBe('GrabFood 120')
  })
})
