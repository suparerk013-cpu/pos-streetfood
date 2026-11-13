/**
 * หน้ารายจ่ายหน้าเดียว — รายการใหม่กับรายการซื้อวัตถุดิบเก่ารวมกัน และหน้าเทียบรับ-จ่าย
 */
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({}))
vi.mock('../../lib/usePurchases', () => ({
  usePurchasesInRange: () => ({
    purchases: [{ id: 'p1', ingredient_name: 'ปลาหมึกสด', total_amount: 600, qty: 3, unit: 'กก.', date: '2026-11-02' }],
    loading: false,
  }),
  useExpensesInRange: () => ({
    expenses: [
      { id: 'e1', name: 'น้ำแข็ง', amount: 40, qty: 2, unit: 'ถุง', date: '2026-11-12' },
      { id: 'e2', category: 'utility_electric', amount: 360, date: '2026-11-05' },
    ],
    loading: false,
  }),
  useRecentEntries: () => ({ expenses: [], purchases: [] }),
}))
vi.mock('../../lib/useShiftSales', () => ({
  useShiftSales: () => ({ gross: 5000, net: 4700, gpFee: 300, orderCount: 50, shiftCount: 4, loading: false, truncated: false }),
}))

let AppDataContext
let ExpensesPage
beforeAll(async () => {
  ;({ AppDataContext } = await import('../../lib/appDataContext'))
  ExpensesPage = (await import('../ExpensesPage')).default
})

const text = (html) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const render = () => renderToString(
  <AppDataContext.Provider value={{ shopName: '', online: true }}><ExpensesPage /></AppDataContext.Provider>,
)

describe('หน้ารายจ่าย', () => {
  it('รวมรายจ่ายใหม่ ค่าใช้จ่ายเก่า และการซื้อวัตถุดิบเก่าไว้ในรายการเดียว', () => {
    const t = text(render())
    expect(t).toContain('1,000') // 40 + 360 + 600
    expect(t).toContain('น้ำแข็ง')
    expect(t).toContain('ค่าไฟ')
    expect(t).toContain('ปลาหมึกสด')
    expect(t).toContain('รายการแบบเก่า')
    expect(t).toContain('2 ถุง')
  })

  it('ไม่มีทะเบียนวัตถุดิบ สต็อกวัตถุดิบ หรือทางไปหน้าน้ำจิ้มแล้ว', () => {
    const t = text(render())
    expect(t).not.toContain('ทะเบียนวัตถุดิบ')
    expect(t).not.toContain('น้ำจิ้ม')
    expect(t).not.toContain('เหลือ 0')
  })

  it('มีแท็บรับ-จ่าย ให้กดไปดูเทียบ', () => {
    expect(text(render())).toContain('รับ-จ่าย')
  })
})
