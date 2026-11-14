import { describe, expect, it, vi } from 'vitest'
import { blurFocusedNumberInput, installNumberInputGuard } from '../numberInputGuard'

describe('กันช่องตัวเลขเปลี่ยนเองตอนหมุนล้อเมาส์', () => {
  it('ช่องตัวเลขที่เลือกอยู่ถูกปล่อย ตัวเลขจะไม่ขยับตามล้อ', () => {
    const blur = vi.fn()
    blurFocusedNumberInput({ activeElement: { tagName: 'INPUT', type: 'number', blur } })
    expect(blur).toHaveBeenCalled()
  })

  it('ช่องข้อความทั่วไปไม่โดนปล่อย พิมพ์ต่อได้', () => {
    const blur = vi.fn()
    blurFocusedNumberInput({ activeElement: { tagName: 'INPUT', type: 'text', blur } })
    expect(blur).not.toHaveBeenCalled()
  })

  it('ติดตั้งตัวฟังล้อเมาส์ครั้งเดียวทั้งแอป และถอดออกได้', () => {
    const listeners = []
    const doc = {
      addEventListener: (type, fn) => listeners.push({ type, fn }),
      removeEventListener: (type, fn) => listeners.splice(listeners.findIndex((l) => l.fn === fn), 1),
    }
    const off = installNumberInputGuard(doc)
    expect(listeners.map((l) => l.type)).toEqual(['wheel'])
    off()
    expect(listeners).toHaveLength(0)
  })
})
