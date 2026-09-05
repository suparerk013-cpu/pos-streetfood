import { describe, expect, it } from 'vitest'
import {
  addItemToCart,
  buildCartKey,
  calcCartTotal,
  calcItemTotal,
  formatModifiers,
  getModifierCategories,
  removeItem,
  setItemModifiers,
  setItemQuantity,
  updateItemQuantity,
} from '../cart'

const squid = {
  id: 'p1',
  name: 'ปลาหมึกย่าง',
  price: 40,
  unit: 'ไม้',
  stock_qty: 3,
  modifiers: { spice_level: ['เผ็ดมาก', 'น้อย'], sauce: ['ซีฟู้ด'] },
}

const mussel = { id: 'p2', name: 'หอยแมลงภู่นึ่ง', price: 60, unit: 'จาน', stock_qty: 10 }

describe('addItemToCart', () => {
  it('เพิ่มสินค้าใหม่ลงตะกร้าพร้อมจำนวน 1', () => {
    const cart = addItemToCart([], squid)
    expect(cart).toHaveLength(1)
    expect(cart[0]).toMatchObject({ productId: 'p1', quantity: 1, price: 40, unit: 'ไม้' })
  })

  it('กดสินค้าเดิมซ้ำแล้วบวกจำนวนในแถวเดิม ไม่สร้างแถวใหม่', () => {
    const cart = addItemToCart(addItemToCart([], squid), squid)
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(2)
  })

  it('แยกแถวเมื่อตัวเลือกต่างกัน', () => {
    let cart = addItemToCart([], squid, { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, squid, { spice_level: 'น้อย' })
    expect(cart).toHaveLength(2)
    expect(cart[0].key).not.toBe(cart[1].key)
  })

  it('ไม่ให้เพิ่มเกินสต็อกที่มี', () => {
    let cart = []
    for (let i = 0; i < 5; i += 1) cart = addItemToCart(cart, squid)
    expect(cart[0].quantity).toBe(3)
  })

  it('นับสต็อกรวมข้ามตัวเลือกของสินค้าเดียวกัน', () => {
    let cart = addItemToCart([], squid, { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, squid, { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, squid, { spice_level: 'น้อย' })
    // สต็อก 3 ชิ้น ใช้ครบแล้ว เพิ่มอีกไม่ได้
    cart = addItemToCart(cart, squid, { spice_level: 'น้อย' })
    const totalQty = cart.reduce((s, i) => s + i.quantity, 0)
    expect(totalQty).toBe(3)
  })
})

describe('updateItemQuantity / setItemQuantity', () => {
  it('ลดจำนวนจนถึง 0 แล้วลบแถวออก', () => {
    const cart = addItemToCart([], squid)
    expect(updateItemQuantity(cart, cart[0].key, -1)).toHaveLength(0)
  })

  it('เพิ่มจำนวนเกินสต็อกไม่ได้', () => {
    let cart = addItemToCart([], squid)
    cart = updateItemQuantity(cart, cart[0].key, 1)
    cart = updateItemQuantity(cart, cart[0].key, 1)
    cart = updateItemQuantity(cart, cart[0].key, 1)
    expect(cart[0].quantity).toBe(3)
  })

  it('ตั้งจำนวนตรง ๆ จะถูกจำกัดไว้ที่สต็อก', () => {
    const cart = setItemQuantity(addItemToCart([], squid), buildCartKey('p1'), 99)
    expect(cart[0].quantity).toBe(3)
  })

  it('ตั้งจำนวนเป็น 0 แล้วแถวหายไป', () => {
    const cart = setItemQuantity(addItemToCart([], squid), buildCartKey('p1'), 0)
    expect(cart).toHaveLength(0)
  })
})

describe('การคิดยอด', () => {
  it('คิดยอดต่อรายการและยอดรวมถูกต้อง', () => {
    let cart = addItemToCart([], squid)
    cart = addItemToCart(cart, squid)
    cart = addItemToCart(cart, mussel)
    expect(calcItemTotal(cart[0])).toBe(80)
    expect(calcCartTotal(cart)).toBe(140)
  })

  it('ตะกร้าว่างยอดรวมเป็น 0', () => {
    expect(calcCartTotal([])).toBe(0)
  })
})

describe('removeItem', () => {
  it('ลบเฉพาะแถวที่ระบุ', () => {
    let cart = addItemToCart([], squid)
    cart = addItemToCart(cart, mussel)
    const next = removeItem(cart, buildCartKey('p1'))
    expect(next).toHaveLength(1)
    expect(next[0].productId).toBe('p2')
  })
})

describe('ตัวเลือกสินค้า', () => {
  it('อ่านหมวดตัวเลือกที่มีค่าเท่านั้น', () => {
    const categories = getModifierCategories({ modifiers: { a: ['x'], b: [], c: null } })
    expect(categories.map(([k]) => k)).toEqual(['a'])
  })

  it('สินค้าที่ไม่มีตัวเลือกคืนลิสต์ว่าง', () => {
    expect(getModifierCategories(mussel)).toEqual([])
  })

  it('คีย์ตะกร้าไม่ขึ้นกับลำดับที่ใส่ตัวเลือก', () => {
    expect(buildCartKey('p1', { b: '2', a: '1' })).toBe(buildCartKey('p1', { a: '1', b: '2' }))
  })

  it('แสดงตัวเลือกเป็นข้อความอ่านง่าย', () => {
    expect(formatModifiers({ spice_level: 'เผ็ดมาก', sauce: 'ซีฟู้ด' })).toBe('เผ็ดมาก, ซีฟู้ด')
  })
})

describe('setItemModifiers', () => {
  const squid = { id: 'p1', name: 'ปลาหมึกย่าง', price: 10, stock_qty: 50, unit: 'ไม้' }

  it('เปลี่ยนตัวเลือกแล้ว key เปลี่ยนตาม ปุ่มบวกลบยังทำงานกับบรรทัดเดิม', () => {
    let cart = addItemToCart([], squid, {})
    cart = setItemModifiers(cart, cart[0].key, { spice_level: 'เผ็ดมาก' })
    expect(cart).toHaveLength(1)
    expect(cart[0].modifiers).toEqual({ spice_level: 'เผ็ดมาก' })
    expect(cart[0].key).toBe(buildCartKey('p1', { spice_level: 'เผ็ดมาก' }))
    expect(cart[0].quantity).toBe(1)
  })

  it('เปลี่ยนไปชนกับบรรทัดที่มีตัวเลือกชุดเดียวกันอยู่แล้ว ต้องยุบรวมจำนวนกัน', () => {
    let cart = addItemToCart([], squid, { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, squid, { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, squid, { spice_level: 'ไม่เผ็ด' })
    expect(cart).toHaveLength(2)

    const mild = cart.find((i) => i.modifiers.spice_level === 'ไม่เผ็ด')
    cart = setItemModifiers(cart, mild.key, { spice_level: 'เผ็ดมาก' })

    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(3)
    expect(new Set(cart.map((i) => i.key)).size).toBe(cart.length)
  })

  it('เลือกค่าเดิมซ้ำ ไม่เปลี่ยนอะไรเลย', () => {
    const cart = addItemToCart([], squid, { sauce: 'ซีฟู้ด' })
    expect(setItemModifiers(cart, cart[0].key, { sauce: 'ซีฟู้ด' })).toBe(cart)
  })

  it('key ที่ไม่มีในตะกร้า คืนตะกร้าเดิม', () => {
    const cart = addItemToCart([], squid, {})
    expect(setItemModifiers(cart, 'ไม่มีจริง', { sauce: 'หวาน' })).toBe(cart)
  })
})
