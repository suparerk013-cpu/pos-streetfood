export function getModifierCategories(product) {
  return Object.entries(product.modifiers || {}).filter(
    ([, options]) => Array.isArray(options) && options.length > 0,
  )
}

export function buildCartKey(productId, modifiers = {}) {
  const parts = Object.keys(modifiers)
    .sort()
    .map((key) => `${key}:${modifiers[key]}`)
  return [productId, ...parts].join('|')
}

function totalQtyForProduct(cart, productId) {
  return cart
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0)
}

export function addItemToCart(cart, product, selectedModifiers = {}) {
  const stockQty = product.stock_qty ?? 0
  if (totalQtyForProduct(cart, product.id) >= stockQty) return cart

  const key = buildCartKey(product.id, selectedModifiers)
  const existing = cart.find((item) => item.key === key)
  if (existing) {
    return cart.map((item) =>
      item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
    )
  }
  return [
    ...cart,
    {
      key,
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit ?? 'ชิ้น',
      delivery_prices: product.delivery_prices ?? {},
      stockQty,
      modifiers: selectedModifiers,
      quantity: 1,
    },
  ]
}

export function updateItemQuantity(cart, key, delta) {
  return cart
    .map((item) => {
      if (item.key !== key) return item
      if (delta > 0) {
        const total = totalQtyForProduct(cart, item.productId)
        if (total >= (item.stockQty ?? Infinity)) return item
      }
      return { ...item, quantity: item.quantity + delta }
    })
    .filter((item) => item.quantity > 0)
}

/**
 * ตั้งจำนวนตรง ๆ จากแป้นตัวเลข
 *
 * maxPaidQty คือเพดานที่เผื่อของแถมแล้ว เช่นสต็อกเหลือ 11 กับโปร 10 แถม 1
 * ซื้อได้สูงสุด 10 ไม่ใช่ 11 เพราะไม้ที่ 11 ต้องกันไว้แถม
 */
export function setItemQuantity(cart, key, qty, maxPaidQty) {
  return cart
    .map((item) => {
      if (item.key !== key) return item
      const ceiling = maxPaidQty ?? item.stockQty ?? Infinity
      const otherQty = cart
        .filter((other) => other.productId === item.productId && other.key !== key)
        .reduce((sum, other) => sum + other.quantity, 0)
      const clamped = Math.min(Math.max(qty, 0), Math.max(ceiling - otherQty, 0))
      return { ...item, quantity: clamped }
    })
    .filter((item) => item.quantity > 0)
}

/**
 * เปลี่ยนตัวเลือก (ความเผ็ด / น้ำจิ้ม) ของรายการที่อยู่ในตะกร้าแล้ว
 *
 * key ของรายการสร้างจาก productId + ตัวเลือก พอเปลี่ยนตัวเลือก key ต้องเปลี่ยนตาม
 * ถ้าเปลี่ยนแล้วไปตรงกับรายการที่มีตัวเลือกชุดเดียวกันอยู่ก่อนแล้ว ต้องยุบรวมเป็นบรรทัดเดียว
 * ไม่ใช่ปล่อยให้มีสองบรรทัดที่ key ซ้ำกัน ซึ่งจะทำให้ปุ่มบวกลบไปโดนบรรทัดผิด
 */
export function setItemModifiers(cart, key, modifiers = {}) {
  const target = cart.find((item) => item.key === key)
  if (!target) return cart

  const nextKey = buildCartKey(target.productId, modifiers)
  if (nextKey === key) return cart

  const twin = cart.find((item) => item.key === nextKey)
  if (twin) {
    return cart
      .filter((item) => item.key !== key)
      .map((item) =>
        item.key === nextKey ? { ...item, quantity: item.quantity + target.quantity } : item,
      )
  }

  return cart.map((item) => (item.key === key ? { ...item, key: nextKey, modifiers } : item))
}

export function removeItem(cart, key) {
  return cart.filter((item) => item.key !== key)
}

export function calcItemTotal(item) {
  return item.price * item.quantity
}

export function calcCartTotal(cart) {
  return cart.reduce((sum, item) => sum + calcItemTotal(item), 0)
}

export function formatModifiers(modifiers = {}) {
  return Object.values(modifiers).filter(Boolean).join(', ')
}
