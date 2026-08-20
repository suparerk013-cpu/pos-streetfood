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

export function addItemToCart(cart, product, selectedModifiers = {}) {
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
      modifiers: selectedModifiers,
      quantity: 1,
    },
  ]
}

export function updateItemQuantity(cart, key, delta) {
  return cart
    .map((item) =>
      item.key === key ? { ...item, quantity: item.quantity + delta } : item,
    )
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
