/**
 * แดชบอร์ดแบบรายกะ
 *
 * เรนเดอร์หน้าจริงโดยแทนตัวดึงข้อมูลด้วยข้อมูลจำลอง เพื่อจับบั๊กแบบจอขาว
 * และยืนยันว่าบิลหลังเที่ยงคืนยังนับเป็นของกะที่เปิดเมื่อวาน
 */
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min)

// กะที่ยังเปิดอยู่ เปิดสี่โมงเย็นวันที่ 13 ตอนนี้เลยเที่ยงคืนมาแล้ว
const openShift = { id: 's13', status: 'open', opened_at: at(2026, 11, 13, 16, 30), closed_at: null }
const closedShift = {
  id: 's12', status: 'closed',
  opened_at: at(2026, 11, 12, 16, 10), closed_at: at(2026, 11, 13, 1, 5),
  summary: { total: 900, order_count: 9 },
}

const shiftOrders = [
  { id: 'o1', shift_id: 's13', channel: 'store', total_amount: 300, created_at: at(2026, 11, 13, 18), items: [], payments: [] },
  // ขายหลังเที่ยงคืน ยังต้องเป็นยอดของกะวันที่ 13
  { id: 'o2', shift_id: 's13', channel: 'store', total_amount: 200, created_at: at(2026, 11, 14, 0, 40), items: [], payments: [] },
  { id: 'o3', shift_id: 's13', channel: 'delivery', platform: 'GrabFood', total_amount: 1000, created_at: at(2026, 11, 13, 20), items: [], payments: [] },
]

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
  onSnapshot: () => () => {}, Timestamp: { fromDate: (d) => d, fromMillis: (n) => new Date(n) },
}))
vi.mock('../../lib/useOrders', () => ({
  useOrdersForShift: (id) => ({ orders: id === 's13' ? shiftOrders : [], loading: false }),
  useOrdersBetween: () => ({ orders: [], loading: false, truncated: false }),
  useShiftsInRange: () => ({ shifts: [], loading: false }),
}))
vi.mock('../../lib/usePurchases', () => ({
  usePurchasesInRange: () => ({ purchases: [] }),
  useExpensesInRange: () => ({ expenses: [{ id: 'e1', amount: 400 }] }),
  usePayouts: () => [],
}))

const ctx = {
  activeProducts: [], productById: new Map(),
  gpRateFor: () => 0.3,
  currentShift: openShift,
  shifts: [openShift, closedShift],
}

let AppDataContext
let ReportsPage
beforeAll(async () => {
  ;({ AppDataContext } = await import('../../lib/appDataContext'))
  ReportsPage = (await import('../ReportsPage')).default
})

const render = (value = ctx) =>
  renderToString(<AppDataContext.Provider value={value}><ReportsPage /></AppDataContext.Provider>)
const text = (html) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('แดชบอร์ดรายกะ', () => {
  it('เปิดมาที่กะนี้ และบอกว่ากะยังเปิดอยู่', () => {
    const t = text(render())
    expect(t).toContain('กะนี้')
    expect(t).toContain('● เปิดอยู่')
    expect(t).toContain('16:30 – ตอนนี้')
  })

  it('บิลหลังเที่ยงคืนนับรวมในกะเดียวกัน ไม่ถูกผ่าเป็นวันใหม่', () => {
    // 300 + 200 (ตีศูนย์สี่สิบ) + 1000 = 1,500
    expect(text(render())).toContain('1,500')
  })

  it('โชว์เงินเข้าจริงหลังหัก GP คู่กับยอดขาย', () => {
    // หน้าร้าน 500 เต็ม + เดลิเวอรี 1000 × 0.7 = 1,200
    const t = text(render())
    expect(t).toContain('เงินเข้าจริง')
    expect(t).toContain('1,200')
  })

  it('เงินเหลือหักทั้งรายจ่ายที่จดไว้และค่า GP', () => {
    // 1,500 − รายจ่าย 400 − GP 300 = 800
    expect(text(render())).toContain('+800')
  })

  it('ดูกะก่อนหน้าได้ ปุ่มกะก่อนกดได้เพราะมีกะที่ปิดไปแล้ว', () => {
    const html = render()
    expect(html).toMatch(/aria-label="กะก่อนหน้า"(?![^>]*disabled)/)
  })

  it('กะที่ยังขายอยู่ ไม่เทียบกับกะที่ปิดแล้ว ยอดครึ่งกะจะดูตกตลอด', () => {
    // ยอดกะนี้ 1,500 กับกะก่อนที่ปิดแล้ว 900 — ถ้าเทียบจะขึ้นลูกศร ซึ่งไม่ควรขึ้น
    expect(render()).not.toMatch(/[↑↓]\d+%/)
  })

  it('ไม่ได้เปิดกะ ปุ่มเขียนว่ากะล่าสุด แล้วโชว์กะที่ปิดไปล่าสุดแทน', () => {
    const t = text(render({ ...ctx, currentShift: null, shifts: [closedShift] }))
    expect(t).toContain('กะล่าสุด')
    expect(t).toContain('16:10 – 01:05')
  })

  it('ยังไม่เคยเปิดกะเลย บอกตรง ๆ ไม่จอขาว', () => {
    expect(text(render({ ...ctx, currentShift: null, shifts: [] }))).toContain('ยังไม่เคยเปิดกะ')
  })

  it('ไม่คิดต้นทุนจากสูตรอีกแล้ว ไม่มีคำว่าต้นทุนบนหน้า', () => {
    expect(text(render())).not.toContain('ต้นทุน')
  })
})
