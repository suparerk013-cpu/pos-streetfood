import { PackageX } from 'lucide-react'
import { useMemo, useState } from 'react'
import CartItemRow from '../components/CartItemRow'
import CartSheet from '../components/CartSheet'
import CheckoutModal from '../components/CheckoutModal'
import DamageModal from '../components/DamageModal'
import ModifierModal from '../components/ModifierModal'
import ProductGrid from '../components/ProductGrid'
import SuccessModal from '../components/SuccessModal'
import { useAppData } from '../lib/appDataContext'
import {
  addItemToCart,
  calcCartTotal,
  getModifierCategories,
  removeItem,
  setItemQuantity,
  updateItemQuantity,
} from '../lib/cart'
import { reportDamage } from '../lib/stock'

function SalesPage() {
  const { activeProducts, productsLoading, shopName, online } = useAppData()
  const [cart, setCart] = useState([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successResult, setSuccessResult] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [damageOpen, setDamageOpen] = useState(false)
  const [modifierTarget, setModifierTarget] = useState(null)

  const cartQtyByProductId = useMemo(() => {
    const map = new Map()
    cart.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
    })
    return map
  }, [cart])

  const categories = useMemo(
    () => [...new Set(activeProducts.map((p) => p.category).filter(Boolean))],
    [activeProducts],
  )

  const visibleProducts = useMemo(
    () =>
      activeCategory === 'all'
        ? activeProducts
        : activeProducts.filter((p) => p.category === activeCategory),
    [activeProducts, activeCategory],
  )

  /**
   * สินค้าที่มีตัวเลือก (ความเผ็ด / น้ำจิ้ม) จะเปิดหน้าต่างให้เลือกก่อนลงตะกร้า
   * เดิมส่ง {} ตายตัว ทำให้ตัวเลือกที่ตั้งไว้ในคลังสินค้าใช้งานไม่ได้เลย
   */
  const handleSelectProduct = (product) => {
    if ((product.stock_qty ?? 0) <= 0) return
    if (getModifierCategories(product).length > 0) {
      setModifierTarget(product)
      return
    }
    setCart((prev) => addItemToCart(prev, product, {}))
  }

  const handleConfirmModifiers = (selected) => {
    setCart((prev) => addItemToCart(prev, modifierTarget, selected))
    setModifierTarget(null)
  }

  const handleIncrement = (key) => setCart((prev) => updateItemQuantity(prev, key, 1))
  const handleDecrement = (key) => setCart((prev) => updateItemQuantity(prev, key, -1))
  const handleRemove = (key) => setCart((prev) => removeItem(prev, key))
  const handleSetQuantity = (key, qty) => setCart((prev) => setItemQuantity(prev, key, qty))

  const handleCheckoutSuccess = (result) => {
    setCheckoutOpen(false)
    setCart([])
    setSuccessResult(result)
  }

  const openCheckout = () => {
    if (!online) return
    setCheckoutOpen(true)
  }

  const total = calcCartTotal(cart)

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      {/* Full-width header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        {shopName && <h1 className="font-bold text-lg truncate">{shopName}</h1>}
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={() => setDamageOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-lg active:bg-white/30 transition-colors">
            <PackageX size={14} />
            เสียหาย/เครม
          </button>
        </div>
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
            {!productsLoading && (
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
              onSetQuantity={handleSetQuantity}
              onCheckout={openCheckout}
              checkoutDisabled={!online}
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
                  onSetQuantity={handleSetQuantity}
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
                onClick={openCheckout}
                disabled={cart.length === 0 || !online}
                className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-2xl shadow-xl shadow-orange-200 active:scale-95 transition-all tracking-wide"
              >
                {online ? 'คิดเงิน' : 'ออฟไลน์'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modifierTarget && (
        <ModifierModal
          product={modifierTarget}
          onClose={() => setModifierTarget(null)}
          onConfirm={handleConfirmModifiers}
        />
      )}

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

      {damageOpen && (
        <DamageModal
          products={activeProducts}
          onClose={() => setDamageOpen(false)}
          onSubmit={async (payload) => {
            await reportDamage(payload)
            setDamageOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default SalesPage
