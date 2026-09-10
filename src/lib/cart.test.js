import { describe, expect, it } from 'vitest'
import {
  addItemToCart,
  buildCartKey,
  calcCartTotal,
  calcItemTotal,
  formatModifiers,
  getModifierCategories,
  removeItem,
  setItemQuantity,
  updateItemQuantity,
} from './cart'

const product = (overrides = {}) => ({
  id: 'p1',
  name: 'ปลาหมึกย่าง',
  price: 40,
  unit: 'ไม้',
  stock_qty: 5,
  modifiers: { spice_level: ['เผ็ดมาก', 'น้อย'] },
  ...overrides,
})

describe('buildCartKey', () => {
  it('รวม productId กับ modifiers ที่เรียงลำดับ key แล้ว', () => {
    expect(buildCartKey('p1', { b: '2', a: '1' })).toBe('p1|a:1|b:2')
  })

  it('ไม่มี modifiers ก็ได้แค่ productId', () => {
    expect(buildCartKey('p1')).toBe('p1')
  })
})

describe('getModifierCategories', () => {
  it('กรองเฉพาะกลุ่มที่มีตัวเลือกจริง', () => {
    const result = getModifierCategories({ modifiers: { a: ['x'], b: [], c: 'not-array' } })
    expect(result).toEqual([['a', ['x']]])
  })

  it('ไม่มี modifiers เลยคืน array ว่าง', () => {
    expect(getModifierCategories({})).toEqual([])
  })
})

describe('addItemToCart', () => {
  it('เพิ่มสินค้าใหม่เข้าตะกร้าด้วย quantity 1', () => {
    const cart = addItemToCart([], product(), {})
    expect(cart).toHaveLength(1)
    expect(cart[0]).toMatchObject({ productId: 'p1', quantity: 1, price: 40 })
  })

  it('เพิ่มสินค้าเดิม (key ตรงกัน) จะบวก quantity แทนการเพิ่มแถวใหม่', () => {
    let cart = addItemToCart([], product(), {})
    cart = addItemToCart(cart, product(), {})
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(2)
  })

  it('ห้ามเพิ่มเกินจำนวนสต็อกที่มี', () => {
    let cart = []
    const p = product({ stock_qty: 1 })
    cart = addItemToCart(cart, p, {})
    cart = addItemToCart(cart, p, {})
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(1)
  })

  it('modifiers ต่างกันถือเป็นแถวแยกกันในตะกร้า', () => {
    let cart = addItemToCart([], product({ stock_qty: 5 }), { spice_level: 'เผ็ดมาก' })
    cart = addItemToCart(cart, product({ stock_qty: 5 }), { spice_level: 'น้อย' })
    expect(cart).toHaveLength(2)
  })
})

describe('updateItemQuantity', () => {
  it('เพิ่มจำนวนได้ถ้ายังไม่เกินสต็อก', () => {
    const cart = [{ key: 'p1', productId: 'p1', quantity: 1, stockQty: 3, price: 40 }]
    const updated = updateItemQuantity(cart, 'p1', 1)
    expect(updated[0].quantity).toBe(2)
  })

  it('ไม่เพิ่มเกินสต็อกที่จำกัดไว้', () => {
    const cart = [{ key: 'p1', productId: 'p1', quantity: 3, stockQty: 3, price: 40 }]
    const updated = updateItemQuantity(cart, 'p1', 1)
    expect(updated[0].quantity).toBe(3)
  })

  it('ลดจำนวนจนเป็น 0 จะลบแถวออกจากตะกร้า', () => {
    const cart = [{ key: 'p1', productId: 'p1', quantity: 1, stockQty: 3, price: 40 }]
    const updated = updateItemQuantity(cart, 'p1', -1)
    expect(updated).toHaveLength(0)
  })
})

describe('setItemQuantity', () => {
  it('clamp ค่าไว้ระหว่าง 0 กับสต็อกที่มี', () => {
    const cart = [{ key: 'p1', productId: 'p1', quantity: 1, stockQty: 5, price: 40 }]
    expect(setItemQuantity(cart, 'p1', 100)[0].quantity).toBe(5)
    expect(setItemQuantity(cart, 'p1', -10)).toHaveLength(0)
  })
})

describe('removeItem / calcItemTotal / calcCartTotal', () => {
  it('removeItem ลบแถวที่ key ตรงกัน', () => {
    const cart = [{ key: 'p1', quantity: 1 }, { key: 'p2', quantity: 1 }]
    expect(removeItem(cart, 'p1')).toEqual([{ key: 'p2', quantity: 1 }])
  })

  it('calcItemTotal และ calcCartTotal คำนวณถูกต้อง', () => {
    const cart = [
      { key: 'a', price: 40, quantity: 2 },
      { key: 'b', price: 60, quantity: 1 },
    ]
    expect(calcItemTotal(cart[0])).toBe(80)
    expect(calcCartTotal(cart)).toBe(140)
  })
})

describe('formatModifiers', () => {
  it('รวมค่าที่เลือกด้วยจุลภาค และตัดค่าว่างออก', () => {
    expect(formatModifiers({ spice: 'เผ็ดมาก', sauce: '' })).toBe('เผ็ดมาก')
    expect(formatModifiers()).toBe('')
  })
})
