/**
 * เรนเดอร์หน้าต่างจริงด้วยข้อมูลจำลอง เพื่อจับบั๊กแบบ "จอขาว"
 *
 * เคยพลาดมาแล้ว: หน้าต่างแก้ไขสินค้าอ้างตัวแปรก่อนบรรทัดที่ประกาศ (temporal dead zone)
 * เทสต์ยูนิตของ lib ไม่จับ เพราะไม่เคยเรนเดอร์คอมโพเนนต์เลย
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppDataContext } from '../../lib/appDataContext'
import AddProductModal from '../AddProductModal'
import EditProductModal from '../EditProductModal'
import BundleModal from '../BundleModal'
import CartItemRow from '../CartItemRow'

const squid = {
  id: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้', stock_qty: 20,
  is_active: true, category: 'squid', ingredient_id: 'i1', yield_per_unit: 20,
}

const appData = {
  products: [squid],
  activeProducts: [squid],
  productById: new Map([[squid.id, squid]]),
  ingredientById: new Map([['i1', { id: 'i1', name: 'ปลาหมึกสด', last_price: 60, unit: 'กก.' }]]),
  ingredients: [{ id: 'i1', name: 'ปลาหมึกสด', last_price: 60, unit: 'กก.' }],
  activeIngredients: [{ id: 'i1', name: 'ปลาหมึกสด', last_price: 60, unit: 'กก.' }],
  consumableCost: 1,
  sauceEnabled: true,
  sauces: [{ id: 's1', name: 'น้ำจิ้มหมึกย่าง', icon: '🦑', last_batch: { cost_per_serve: 0.24 } }],
  sauceById: new Map([['s1', { id: 's1', name: 'น้ำจิ้มหมึกย่าง', icon: '🦑', last_batch: { cost_per_serve: 0.24 } }]]),
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

  it('หน้าต่างแก้ไขสินค้าโชว์ต้นทุนแตกเป็นก้อน วัตถุดิบ น้ำจิ้ม ของประกอบ', () => {
    const sauced = { ...squid, sauce_id: 's1' }
    const html = render(<EditProductModal product={sauced} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).toContain('วัตถุดิบหลัก')
    expect(html).toContain('สูตรน้ำจิ้ม')
    // หมึก 3 + น้ำจิ้ม 0.24 + ของประกอบ 1
    expect(html.replace(/<!-- -->/g, '')).toContain('4.24 ฿')
  })

  it('ปิดระบบน้ำจิ้มแล้ว ช่องเลือกสูตรหายไปจากหน้าต่างแก้ไขสินค้า', () => {
    const off = { ...appData, sauceEnabled: false, sauceById: null }
    const html = renderToString(
      <AppDataContext.Provider value={off}>
        <EditProductModal product={{ ...squid, sauce_id: 's1' }} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />
      </AppDataContext.Provider>,
    )
    expect(html).not.toContain('สูตรน้ำจิ้ม')
    expect(html.replace(/<!-- -->/g, '')).toContain('4.00 ฿')
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
})

