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

export function setItemQuantity(cart, key, qty) {
  return cart
    .map((item) => {
      if (item.key !== key) return item
      const stockQty = item.stockQty ?? Infinity
      const clamped = Math.min(Math.max(qty, 0), stockQty)
      return { ...item, quantity: clamped }
    })
    .filter((item) => item.quantity > 0)
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
