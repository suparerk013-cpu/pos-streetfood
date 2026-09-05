/**
 * โครงหน้าจอของหน้าขาย
 *
 * แถบตะกร้าฝั่งขวาต้องเต็มความสูงตั้งแต่ใต้หัวเรื่องถึงขอบล่าง ถ้าปุ่มสลับช่องทาง
 * หลุดออกมาอยู่นอกคอลัมน์ซ้ายเมื่อไหร่ จะมีแถบสีส้มโผล่คั่นเหนือตะกร้าทันที
 */
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), doc: () => ({}), query: () => ({}), where: () => ({}),
  orderBy: () => ({}), limit: () => ({}), onSnapshot: () => () => {},
  Timestamp: { fromDate: (d) => d, now: () => new Date() },
  serverTimestamp: () => new Date(), addDoc: async () => ({}), updateDoc: async () => {},
  deleteDoc: async () => {}, getDocs: async () => ({ docs: [] }),
  getDoc: async () => ({ exists: () => false }),
  runTransaction: async () => ({}), increment: (n) => n, writeBatch: () => ({}),
}))

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้', stock_qty: 20, is_active: true, category: 'ปลาหมึก' }
const mussel = { id: 'p2', name: 'หอยแมลงภู่นึ่ง', price: 60, unit: 'ถุง', stock_qty: 0, is_active: true, category: 'หอยแมลงภู่' }

const ctx = {
  products: [squid, mussel], activeProducts: [squid, mussel],
  productById: new Map([['p1', squid], ['p2', mussel]]),
  productsLoading: false, ingredients: [], ingredientById: new Map(), consumableCost: 1,
  enabledPlatforms: ['GrabFood', 'LINE MAN'], gpRateFor: () => 0.3, gpRates: {},
  store: {}, shopName: 'มหาทะเลซีฟูด', shifts: [], shiftsLoading: false, currentShift: null,
  online: true, dataError: null, packagingCost: 5,
}

let AppDataContext
let SalesPage
beforeAll(async () => {
  ;({ AppDataContext } = await import('../../lib/appDataContext'))
  SalesPage = (await import('../SalesPage')).default
})

const render = () =>
  renderToString(<AppDataContext.Provider value={ctx}><SalesPage /></AppDataContext.Provider>)

describe('โครงหน้าขาย', () => {
  it('เรนเดอร์สินค้าและตะกร้าได้', () => {
    const html = render()
    expect(html).toContain('ปลาหมึกย่าง')
    expect(html).toContain('ตะกร้าสินค้า')
  })

  it('ปุ่มสลับช่องทางอยู่ในคอลัมน์เดียวกับตารางสินค้า ไม่ได้คร่อมทั้งสองคอลัมน์', () => {
    const html = render()
    const channelAt = html.indexOf('หน้าร้าน')
    const gridAt = html.indexOf('ปลาหมึกย่าง')
    const cartAt = html.indexOf('ตะกร้าสินค้า')
    expect(channelAt).toBeGreaterThan(-1)
    expect(channelAt).toBeLessThan(gridAt)
    expect(gridAt).toBeLessThan(cartAt)
  })

  it('แถบตะกร้าเดสก์ท็อปเป็นคอลัมน์เต็มความสูง ไม่มีขอบมนที่ทำให้ดูไม่ชนขอบ', () => {
    const html = render()
    const at = html.lastIndexOf('hidden md:flex')
    const panelClass = html.slice(at, html.indexOf('">', at))
    expect(panelClass).toContain('flex-col')
    expect(panelClass).toContain('w-80')
    expect(panelClass).not.toContain('rounded')
  })
})
