/**
 * ปุ่ม "ใส่ราคา" ในหน้าคิดเงิน — กรอกราคาที่เก็บลูกค้าจริง ระบบแปลงเป็นส่วนลดให้
 */
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { quickPrices } from '../../lib/pricing'

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../lib/orders', () => ({ createOrder: vi.fn(), InsufficientStockError: class extends Error {} }))

let CheckoutModal
let AppDataContext
beforeAll(async () => {
  ;({ default: CheckoutModal } = await import('../CheckoutModal'))
  ;({ AppDataContext } = await import('../../lib/appDataContext'))
})

describe('quickPrices — ราคาปัดลงให้กดเร็ว', () => {
  it('ยอด 137 ได้ 130 กับ 100', () => {
    expect(quickPrices(137)).toEqual([130, 100])
  })

  it('ไม่เสนอราคาที่เท่ายอดเดิมหรือเป็นศูนย์', () => {
    expect(quickPrices(130)).toEqual([100])
    expect(quickPrices(8)).toEqual([])
  })

  it('ยอดใหญ่ได้สามปุ่ม เรียงจากมากไปน้อย', () => {
    expect(quickPrices(1287)).toEqual([1280, 1250, 1200])
  })
})

describe('หน้าคิดเงิน', () => {
  it('มีปุ่มใส่ราคาอยู่คู่กับปุ่มส่วนลด', () => {
    const cart = [{ key: 'p1', productId: 'p1', name: 'หมึก', price: 10, quantity: 13, modifiers: {} }]
    const ctx = { currentShift: null, productById: new Map(), gpRateFor: () => 0 }
    const html = renderToString(
      <AppDataContext.Provider value={ctx}>
        <CheckoutModal cart={cart} onClose={() => {}} onSuccess={() => {}} />
      </AppDataContext.Provider>,
    )
    expect(html).toContain('ใส่ราคา')
    expect(html).toContain('ส่วนลด')
  })
})
