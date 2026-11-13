/**
 * เรนเดอร์หน้าต่างจริงด้วยข้อมูลจำลอง เพื่อจับบั๊กแบบ "จอขาว"
 *
 * เคยพลาดมาแล้ว: หน้าต่างแก้ไขสินค้าอ้างตัวแปรก่อนบรรทัดที่ประกาศ (temporal dead zone)
 * เทสต์ยูนิตของ lib ไม่จับ เพราะไม่เคยเรนเดอร์คอมโพเนนต์เลย
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }))
import { AppDataContext } from '../../lib/appDataContext'
import AddProductModal from '../AddProductModal'
import EditProductModal from '../EditProductModal'
import BundleModal from '../BundleModal'
import CartItemRow from '../CartItemRow'
import ExpenseModal from '../ExpenseModal'

const squid = {
  id: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้', stock_qty: 20,
  is_active: true, category: 'squid',
}

const appData = {
  products: [squid],
  activeProducts: [squid],
  productById: new Map([[squid.id, squid]]),
  enabledPlatforms: ['GrabFood', 'LINE MAN'],
  gpRateFor: () => 0.3,
  settings: {},
  loading: false,
}

const render = (node) =>
  renderToString(<AppDataContext.Provider value={appData}>{node}</AppDataContext.Provider>)

describe('เรนเดอร์หน้าต่างในคลังสินค้า', () => {
  it('หน้าต่างแก้ไขสินค้าเรนเดอร์ได้ ไม่จอขาว', () => {
    const html = render(<EditProductModal product={squid} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).toContain('ปลาหมึกย่าง')
  })

  it('โปรหลายชั้นที่บันทึกไว้ขึ้นครบทุกแถว พร้อมตัวอย่างของแถมรวม', () => {
    const tiered = { ...squid, promos: [{ buy: 10, free: 1 }, { buy: 20, free: 3 }] }
    const html = render(<EditProductModal product={tiered} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).toContain('ซื้อกี่ไม้ โปรที่ 1')
    expect(html).toContain('ซื้อกี่ไม้ โปรที่ 2')
    expect(html).toContain('+ เพิ่มโปรอีกชั้น')
    // ซื้อ 40 → 20 แถม 3 สองรอบ = 6 (React แทรกคอมเมนต์คั่นตัวแปร จึงเทียบเป็นช่วง)
    const preview = html.slice(html.indexOf('ตัวอย่าง: ซื้อ'), html.indexOf('ใช้เฉพาะหน้าร้าน'))
    expect(preview.replace(/<!-- -->/g, '')).toContain('ซื้อ 40 ไม้ → แถม 6 ไม้')
  })

  it('สินค้าที่ยังไม่เคยตั้งโปร ขึ้นแถวว่างรอกรอกแถวเดียว ไม่มีปุ่มลบ', () => {
    const html = render(<EditProductModal product={squid} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).not.toContain('ลบโปรที่ 1')
  })

  it('หน้าต่างแก้ไขสินค้าไม่มีช่องตั้งราคาเดลิเวอรีแล้ว — เดลิเวอรีขายเป็นเซ็ต', () => {
    const html = render(<EditProductModal product={squid} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).not.toContain('ช่องทางขาย')
    expect(html).toContain('เดลิเวอรีขายเฉพาะสินค้าจัดเซ็ต')
  })

  it('หน้าต่างแก้ไขสินค้าไม่คิดต้นทุนแล้ว ไม่มีช่องต้นทุนหรือสูตรน้ำจิ้ม', () => {
    const html = render(<EditProductModal product={squid} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).not.toContain('ต้นทุน')
    expect(html).not.toContain('สูตรน้ำจิ้ม')
  })

  it('หน้าต่างเพิ่มสินค้าเรนเดอร์ได้ และไม่มีช่องตั้งตัวเลือกสินค้าแล้ว', () => {
    const html = render(<AddProductModal onClose={() => {}} onSubmit={() => {}} existingCategories={['squid']} />)
    expect(html).not.toContain('ช่องทางขาย')
    expect(html).not.toContain('ตัวเลือกสินค้า')
  })

  it('รายการในตะกร้าไม่ชวนให้เลือกความเผ็ด/น้ำจิ้มอีกแล้ว', () => {
    const line = {
      key: 'p1', productId: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้',
      stockQty: 20, modifiers: {}, quantity: 2,
    }
    const html = render(
      <CartItemRow item={line} cartQtyForProduct={2} onIncrement={() => {}}
        onDecrement={() => {}} onRemove={() => {}} onSetQuantity={() => {}} />,
    )
    expect(html).toContain('ปลาหมึกย่าง')
    expect(html).not.toContain('เผ็ด')
    expect(html).not.toContain('น้ำจิ้ม')
  })

  it('หน้าต่างเซ็ตเรนเดอร์ได้ทั้งตอนสร้างใหม่และตอนแก้ไข', () => {
    expect(render(<BundleModal onClose={() => {}} onSubmit={() => {}} />)).toBeTruthy()
    const bundle = {
      id: 's1', name: 'ปลาหมึก 8 ไม้', is_bundle: true, channel: 'delivery',
      price: 120, delivery_price: 120, components: [{ product_id: 'p1', qty: 8 }],
    }
    expect(render(<BundleModal bundle={bundle} onClose={() => {}} onSubmit={() => {}} />)).toContain('ปลาหมึก 8 ไม้')
  })

  it('หน้าต่างจดรายจ่ายขึ้นชื่อที่เคยจดให้กดเลือก พร้อมราคาครั้งก่อน', () => {
    const recent = [
      { id: 'e1', source: 'expenses', name: 'น้ำแข็ง', amount: 40, qty: 2, unit: 'ถุง', date: '2026-11-12' },
      { id: 'e2', source: 'expenses', name: 'น้ำแข็ง', amount: 40, qty: 2, unit: 'ถุง', date: '2026-11-11' },
      { id: 'e3', source: 'expenses', name: 'ถ่าน', amount: 120, qty: null, unit: 'ถุง', date: '2026-11-10' },
    ]
    const t = render(<ExpenseModal recentEntries={recent} onClose={() => {}} onSubmit={() => {}} />)
      .replace(/<!-- -->/g, '')
    expect(t).toContain('จดบ่อย')
    expect(t).toContain('น้ำแข็ง')
    expect(t).toContain('ครั้งก่อน 40 ฿ · 2 ถุง')
    // ซื้อบ่อยกว่าขึ้นก่อน
    expect(t.indexOf('น้ำแข็ง')).toBeLessThan(t.indexOf('ถ่าน'))
    expect(t).toContain('กิโล')
    expect(t).toContain('มัด')
  })

  it('แก้รายการเดิม เติมค่าเดิมให้ครบ ไม่ขึ้นปุ่มชื่อให้เลือกซ้ำ', () => {
    const entry = { id: 'e1', source: 'expenses', name: 'น้ำแข็ง', amount: 40, qty: 2, unit: 'ถุง', date: '2026-11-12' }
    const html = render(<ExpenseModal entry={entry} recentEntries={[entry]} onClose={() => {}} onSubmit={() => {}} />)
    expect(html).toContain('แก้รายจ่าย')
    expect(html).toContain('value="40"')
    expect(html).not.toContain('จดบ่อย')
  })

  it('ช่องราคากับจำนวนเป็นช่องข้อความ เลื่อนเมาส์ผ่านแล้วตัวเลขไม่เปลี่ยนเอง', () => {
    const html = render(<ExpenseModal onClose={() => {}} onSubmit={() => {}} />)
    expect(html).not.toContain('type="number"')
    expect(html).toContain('inputMode="decimal"')
  })
})
