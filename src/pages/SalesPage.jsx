import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import CartItemRow from '../components/CartItemRow'
import CartSheet from '../components/CartSheet'
import CheckoutModal from '../components/CheckoutModal'
import ProductGrid from '../components/ProductGrid'
import SuccessModal from '../components/SuccessModal'
import { addItemToCart, calcCartTotal, removeItem, updateItemQuantity } from '../lib/cart'
import { db } from '../lib/firebase'
import { seedInitialProducts } from '../lib/seedProducts'

function SalesPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [seeding, setSeeding] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successResult, setSuccessResult] = useState(null)
  const [shopName, setShopName] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
      if (snap.exists()) setShopName(snap.data().shop_name ?? '')
    })
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((product) => product.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setProducts(items)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const cartQtyByProductId = useMemo(() => {
    const map = new Map()
    cart.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
    })
    return map
  }, [cart])

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  )

  const visibleProducts = useMemo(
    () => (activeCategory === 'all' ? products : products.filter((p) => p.category === activeCategory)),
    [products, activeCategory],
  )

  const handleSelectProduct = (product) => {
    if ((product.stock_qty ?? 0) <= 0) return
    setCart((prev) => addItemToCart(prev, product, {}))
  }

  const handleIncrement = (key) => setCart((prev) => updateItemQuantity(prev, key, 1))
  const handleDecrement = (key) => setCart((prev) => updateItemQuantity(prev, key, -1))
  const handleRemove = (key) => setCart((prev) => removeItem(prev, key))

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedInitialProducts()
    } finally {
      setSeeding(false)
    }
  }

  const handleCheckoutSuccess = (result) => {
    setCheckoutOpen(false)
    setCart([])
    setSuccessResult(result)
  }

  const total = calcCartTotal(cart)

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      {/* Full-width header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        {shopName && <h1 className="font-bold text-lg truncate">{shopName}</h1>}
        {import.meta.env.DEV && (
          <button type="button" onClick={handleSeed} disabled={seeding}
            className="text-xs bg-white/20 px-3 py-1.5 rounded-lg disabled:opacity-60">
            {seeding ? 'กำลัง Seed...' : 'Seed (dev)'}
          </button>
        )}
      </header>

      {/* Body: products left + cart right on desktop */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left: product grid */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {categories.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto bg-orange-50">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === 'all' ? 'bg-orange-500 text-white shadow' : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                ทั้งหมด
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeCategory === cat ? 'bg-orange-500 text-white shadow' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!loading && (
              <ProductGrid products={visibleProducts} cartQtyByProductId={cartQtyByProductId} onSelectProduct={handleSelectProduct} />
            )}
          </div>

          {/* Bottom cart sheet — mobile only */}
          <div className="md:hidden">
            <CartSheet
              cart={cart}
              cartQtyByProductId={cartQtyByProductId}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onCheckout={() => setCheckoutOpen(true)}
            />
          </div>
        </div>

        {/* Right cart panel — desktop only */}
        <div className="hidden md:flex flex-col w-80 shrink-0 bg-white border-l border-orange-100 shadow-[-4px_0_16px_rgba(0,0,0,0.07)]">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 shrink-0 bg-gradient-to-r from-orange-500 to-red-500">
            <h2 className="font-bold text-white tracking-wide">ตะกร้าสินค้า</h2>
            <span className="text-sm text-white/80 bg-white/20 rounded-full px-2.5 py-0.5 font-medium">
              {cart.length} รายการ
            </span>
          </div>

          {/* Scrollable cart items */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 divide-y divide-orange-50 bg-white">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-gray-400 text-sm">ยังไม่มีสินค้าในตะกร้า</p>
            ) : (
              cart.map((item) => (
                <CartItemRow
                  key={item.key}
                  item={item}
                  cartQtyForProduct={cartQtyByProductId?.get(item.productId) ?? item.quantity}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>

          {/* Panel footer: total + checkout */}
          <div className="shrink-0 border-t border-orange-100 bg-white">
            <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">ยอดรวม</p>
              <p className="text-2xl font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                {total.toLocaleString()} ฿
              </p>
            </div>
            <div className="px-4 pb-5">
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-2xl shadow-xl shadow-orange-200 active:scale-95 transition-all tracking-wide"
              >
                คิดเงิน
              </button>
            </div>
          </div>
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {successResult && (
        <SuccessModal result={successResult} onClose={() => setSuccessResult(null)} />
      )}
    </div>
  )
}

export default SalesPage
