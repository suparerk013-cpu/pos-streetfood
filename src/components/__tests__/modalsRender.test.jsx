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
import ModifierModal from '../ModifierModal'

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
  consumableCost: 1,
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

  it('หน้าต่างแก้ไขสินค้าไม่มีช่องตั้งราคาเดลิเวอรีแล้ว — เดลิเวอรีขายเป็นเซ็ต', () => {
    const html = render(<EditProductModal product={squid} onClose={() => {}} onSubmit={() => {}} onDelete={() => {}} />)
    expect(html).not.toContain('ช่องทางขาย')
    expect(html).toContain('เดลิเวอรีขายเฉพาะสินค้าจัดเซ็ต')
  })

  it('หน้าต่างเพิ่มสินค้าเรนเดอร์ได้', () => {
    const html = render(<AddProductModal onClose={() => {}} onSubmit={() => {}} existingCategories={['squid']} />)
    expect(html).not.toContain('ช่องทางขาย')
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

describe('ตะกร้าและตัวเลือกสินค้า', () => {
  const squidWithMods = {
    ...squid,
    modifiers: { spice_level: ['เผ็ดมาก', 'ปานกลาง', 'ไม่เผ็ด'], sauce: ['ซีฟู้ด', 'หวาน'] },
  }
  const line = {
    key: 'p1', productId: 'p1', name: 'ปลาหมึกย่าง', price: 10, unit: 'ไม้',
    stockQty: 20, modifiers: {}, quantity: 2,
  }

  it('รายการในตะกร้าที่มีตัวเลือก ชวนให้แตะเลือกความเผ็ด/น้ำจิ้ม', () => {
    const html = render(
      <CartItemRow item={line} cartQtyForProduct={2} onIncrement={() => {}} onDecrement={() => {}}
        onRemove={() => {}} onSetQuantity={() => {}} onEditModifiers={() => {}} />,
    )
    expect(html).toContain('แตะเพื่อเลือกความเผ็ด / น้ำจิ้ม')
  })

  it('รายการที่ไม่มีตัวเลือก ไม่ชวนให้แตะ', () => {
    const html = render(
      <CartItemRow item={line} cartQtyForProduct={2} onIncrement={() => {}} onDecrement={() => {}}
        onRemove={() => {}} onSetQuantity={() => {}} onEditModifiers={null} />,
    )
    expect(html).not.toContain('แตะเพื่อเลือก')
  })

  it('เปิดหน้าต่างตัวเลือกจากตะกร้า ต้องขึ้นค่าที่เคยเลือกไว้ ไม่ใช่ตัวแรกเสมอ', () => {
    const html = render(
      <ModifierModal product={squidWithMods} initialSelected={{ spice_level: 'ไม่เผ็ด' }}
        onClose={() => {}} onConfirm={() => {}} />,
    )
    // ตัวที่ถูกเลือกจะมีกรอบส้ม ตัวอื่นเป็นกรอบเทา
    const chosen = html.slice(html.indexOf('ไม่เผ็ด') - 260, html.indexOf('ไม่เผ็ด'))
    expect(chosen).toContain('border-orange-600')
  })
})
