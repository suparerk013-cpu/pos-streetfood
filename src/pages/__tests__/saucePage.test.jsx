/**
 * หน้าน้ำจิ้มและหน้าต่างบันทึกหม้อ
 *
 * เรนเดอร์ของจริงด้วยข้อมูลจำลอง เพื่อจับบั๊กแบบจอขาวก่อนขึ้นเว็บ
 * หน้านี้เปิด onSnapshot เองและเรียก lib ที่ import firebase จึงต้อง mock ทั้งสองชั้น
 */
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), doc: () => ({}), query: () => ({}), where: () => ({}),
  orderBy: () => ({}), limit: () => ({}),
  // ของจริง onSnapshot ยิงกลับทันทีแม้ไม่มีข้อมูล ถ้า mock ไม่ยิง หน้าจะค้างที่ 'กำลังโหลด'
  onSnapshot: (_q, cb) => { cb({ docs: [] }); return () => {} },
  serverTimestamp: () => new Date(), addDoc: async () => ({}), updateDoc: async () => {},
  deleteDoc: async () => {}, getDocs: async () => ({ docs: [] }), increment: (n) => n,
  writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
}))

const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้', is_active: true, sauce_id: 's1' }

const sauceWithBatch = {
  id: 's1', name: 'น้ำจิ้มหมึกย่าง', icon: '🦑', unit: 'กก.',
  recipe: [
    { ingredient_id: 'chili', ingredient_name: 'พริก', unit: 'กก.', qty: 0.2, per_batch: null },
    { ingredient_id: 'fish', ingredient_name: 'น้ำปลา', unit: 'ขวด', qty: 70, entry_unit: 'มล.', content_qty: 700 },
  ],
  last_batch: { total_cost: 71.9, yield_qty: 2, serves: 300, cost_per_yield: 35.95, cost_per_serve: 0.2397 },
}
const freshSauce = { id: 's2', name: 'น้ำจิ้มซีฟู้ด', icon: '🌶️', unit: 'กก.', recipe: [], last_batch: null }

const ingredients = [
  { id: 'chili', name: 'พริก', unit: 'กก.', last_price: 150, is_active: true, stock_qty: 0.3 },
  { id: 'fish', name: 'น้ำปลา', unit: 'ขวด', last_price: 35, is_active: true, stock_qty: 2, content_qty: 700, content_unit: 'มล.' },
]

const ctx = {
  products: [squid], activeProducts: [squid], productById: new Map([['p1', squid]]),
  productsLoading: false,
  ingredients, activeIngredients: ingredients,
  ingredientById: new Map(ingredients.map((i) => [i.id, i])),
  consumableCost: 1, packagingCost: 5,
  sauceEnabled: true,
  sauces: [sauceWithBatch, freshSauce],
  sauceById: new Map([['s1', sauceWithBatch], ['s2', freshSauce]]),
  enabledPlatforms: ['GrabFood'], gpRateFor: () => 0.3, gpRates: {},
  store: {}, shopName: 'มหาทะเลซีฟูด', shifts: [], shiftsLoading: false, currentShift: null,
  online: true, dataError: null,
}

let AppDataContext
let SaucePage
let SauceBatchModal
beforeAll(async () => {
  ;({ AppDataContext } = await import('../../lib/appDataContext'))
  SaucePage = (await import('../SaucePage')).default
  SauceBatchModal = (await import('../../components/SauceBatchModal')).default
})

const render = (node, value = ctx) =>
  renderToString(<AppDataContext.Provider value={value}>{node}</AppDataContext.Provider>)

const plain = (html) => html.replace(/<!-- -->/g, '')

describe('หน้าน้ำจิ้ม', () => {
  it('เรนเดอร์ได้ ไม่จอขาว และขึ้นครบทุกสูตร', () => {
    const html = render(<SaucePage />)
    expect(html).toContain('น้ำจิ้มหมึกย่าง')
    expect(html).toContain('น้ำจิ้มซีฟู้ด')
  })

  it('สูตรที่เคยทำหม้อแล้ว โชว์ต้นทุนต่อชิ้นจากหม้อล่าสุด', () => {
    // ตัวเลขกับหน่วยอยู่คนละ span เพื่อให้หน่วยตัวเล็กลง จึงตัดแท็กออกก่อนเทียบ
    const text = plain(render(<SaucePage />)).replace(/<[^>]+>/g, '')
    expect(text).toContain('0.24 ฿/ชิ้น')
    expect(text).toContain('71.90 ฿')
  })

  it('สูตรที่ยังไม่เคยทำ บอกตรง ๆ ว่าต้นทุนยังเป็น 0', () => {
    expect(render(<SaucePage />)).toContain('ยังไม่เคยทำสูตรนี้')
  })

  it('บอกว่าสูตรไหนผูกกับสินค้าอะไร และสูตรไหนยังไม่ได้ผูก', () => {
    const html = plain(render(<SaucePage />))
    expect(html).toContain('ใช้กับ: ปลาหมึกย่าง')
    expect(html).toContain('ยังไม่ได้ผูกกับสินค้า')
  })

  it('ไม่มีสูตรสักอัน ขึ้นคำแนะนำแทนหน้าว่าง', () => {
    const html = render(<SaucePage />, { ...ctx, sauces: [], sauceById: new Map() })
    expect(html).toContain('ยังไม่มีสูตรน้ำจิ้ม')
  })
})

describe('แจ้งเตือนของหมด', () => {
  it('บอกว่าทำได้อีกกี่หม้อ และตัวไหนจะหมดก่อน', () => {
    // พริกเหลือ 0.3 ใช้หม้อละ 0.2 → ทำได้อีก 1 หม้อ
    const text = plain(render(<SaucePage />)).replace(/<[^>]+>/g, '')
    expect(text).toContain('ทำได้อีก 1 หม้อ')
    expect(text).toContain('พริกจะหมดก่อน')
  })

  it('ของไม่พอทำหม้อถัดไป ขึ้นเตือนพร้อมชื่อของที่ขาด', () => {
    const empty = ingredients.map((i) => (i.id === 'chili' ? { ...i, stock_qty: 0 } : i))
    const html = render(<SaucePage />, {
      ...ctx, ingredients: empty, activeIngredients: empty,
      ingredientById: new Map(empty.map((i) => [i.id, i])),
    })
    expect(plain(html)).toContain('ทำหม้อถัดไปไม่ได้')
  })

  it('ตอนของหมดกางตารางให้เลย เห็นทีละตัวว่าใครเหลือเท่าไหร่', () => {
    // ของหมดไม่พร้อมกัน บอกแค่จำนวนหม้อจึงไม่พอ ต้องเห็นทุกตัวในตารางเดียว
    const empty = ingredients.map((i) => (i.id === 'chili' ? { ...i, stock_qty: 0 } : i))
    const text = plain(render(<SaucePage />, {
      ...ctx, ingredients: empty, activeIngredients: empty,
      ingredientById: new Map(empty.map((i) => [i.id, i])),
    })).replace(/<[^>]+>/g, '')
    expect(text).toContain('ใช้/หม้อ')
    expect(text).toContain('พริก')
    expect(text).toContain('น้ำปลา')
  })
})

describe('แท็บย่อยในหน้าน้ำจิ้ม', () => {
  it('มีครบสี่แท็บ', () => {
    const html = render(<SaucePage />)
    expect(html).toContain('สูตร')
    expect(html).toContain('ซื้อของ')
    expect(html).toContain('ประวัติ')
    expect(html).toContain('รายงาน')
  })

  it('เปิดแท็บซื้อของได้ตรงจากลิงก์ในหน้าค่าใช้จ่าย', () => {
    const html = render(<SaucePage initialTab="shopping" />)
    expect(html).toContain('เตรียมรายการ')
    expect(html).toContain('ระบบแนะนำจากสูตรน้ำจิ้ม')
  })

  it('แท็บซื้อของแนะนำของที่ใกล้หมดพร้อมจำนวนที่ควรซื้อ', () => {
    const text = plain(render(<SaucePage initialTab="shopping" />)).replace(/<[^>]+>/g, '')
    expect(text).toContain('พริก')
    // ต้องมี 5 × 0.2 = 1 กก. เหลือ 0.3 → ขาด 0.7 ปัดขึ้นเป็น 0.75
    expect(text).toContain('+ ซื้อ 0.75 กก.')
  })

  it('แท็บรายงานเตือนไม่ให้เอาตัวเลขไปหักกำไรซ้ำ', () => {
    const html = plain(render(<SaucePage initialTab="report" />))
    expect(html).toContain('อย่าเอาไปหักกำไรซ้ำ')
  })
})

describe('หน้าต่างบันทึกทำน้ำจิ้ม', () => {
  it('เปิดมาพร้อมสูตรของหม้อก่อนหน้า ไม่ต้องกรอกใหม่ทั้งหม้อ', () => {
    const html = render(<SauceBatchModal sauce={sauceWithBatch} onClose={() => {}} onSubmit={() => {}} />)
    expect(html).toContain('บันทึกทำ')
    expect(html).toContain('พริก')
    expect(html).toContain('น้ำปลา')
  })

  it('คิดต้นทุนหม้อให้เห็นทันที — พริก 30 + น้ำปลา 70 มล. จากขวด 700 = 3.50', () => {
    const html = plain(render(<SauceBatchModal sauce={sauceWithBatch} onClose={() => {}} onSubmit={() => {}} />))
    expect(html).toContain('33.50 ฿ / หม้อ')
  })

  it('วัตถุดิบที่ตั้งขนาดบรรจุไว้ เลือกหน่วยตวงได้ และบอกว่าตัดสต็อกเท่าไหร่', () => {
    const html = plain(render(<SauceBatchModal sauce={sauceWithBatch} onClose={() => {}} onSubmit={() => {}} />))
    expect(html).toContain('1 ขวด = 700 มล.')
    expect(html.replace(/<[^>]+>/g, '')).toContain('ตัดสต็อก 0.1 ขวด')
  })

  it('วัตถุดิบที่ยังไม่ได้ตั้งขนาดบรรจุ ชวนให้ไปตั้ง', () => {
    const html = render(<SauceBatchModal sauce={sauceWithBatch} onClose={() => {}} onSubmit={() => {}} />)
    expect(html).toContain('ตั้งว่า 1 กก. มีกี่')
  })

  it('สูตรใหม่ที่ยังไม่มีอะไร เปิดมาพร้อมแถวว่างให้กรอก 1 แถว', () => {
    const html = render(<SauceBatchModal sauce={freshSauce} onClose={() => {}} onSubmit={() => {}} />)
    expect(html).toContain('เลือกวัตถุดิบ')
    expect(html).toContain('+ เพิ่มวัตถุดิบ')
  })
})
