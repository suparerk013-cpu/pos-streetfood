import { PackageX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CartItemRow from '../components/CartItemRow'
import CartSheet from '../components/CartSheet'
import CheckoutModal from '../components/CheckoutModal'
import DamageModal from '../components/DamageModal'
import ModifierModal from '../components/ModifierModal'
import ProductGrid from '../components/ProductGrid'
import SuccessModal from '../components/SuccessModal'
import { useAppData } from '../lib/appDataContext'
import { isBundle, missingDeliveryPrice, priceFor, sellableIn } from '../lib/bundles'
import { PLATFORM_BUTTON_BG, PLATFORM_ICONS, productCategoryLabel } from '../lib/constants'
import { bundleStock } from '../lib/pricing'
import { buildFreeLines, maxPaidQty } from '../lib/promo'
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
  const {
    activeProducts,
    productsLoading,
    productById,
    shopName,
    online,
    enabledPlatforms,
  } = useAppData()
  const [channel, setChannel] = useState('store')
  const [platform, setPlatform] = useState(enabledPlatforms[0] ?? null)
  const [cart, setCart] = useState([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successResult, setSuccessResult] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [damageOpen, setDamageOpen] = useState(false)
  const [modifierTarget, setModifierTarget] = useState(null)

  // สลับช่องทางแล้วราคาเปลี่ยนทั้งกระดาน ตะกร้าเดิมจึงใช้ต่อไม่ได้
  useEffect(() => {
    setCart([])
    setActiveCategory('all')
  }, [channel])

  useEffect(() => {
    if (!platform || !enabledPlatforms.includes(platform)) setPlatform(enabledPlatforms[0] ?? null)
  }, [enabledPlatforms, platform])

  /** สินค้าที่ขายได้ในช่องทางนี้ พร้อมราคาและสต็อกของช่องทางนั้น */
  const channelProducts = useMemo(
    () =>
      sellableIn(activeProducts, channel).map((p) => ({
        ...p,
        price: priceFor(p, channel),
        stock_qty: isBundle(p) ? bundleStock(p, productById) : (p.stock_qty ?? 0),
      })),
    [activeProducts, channel, productById],
  )

  /** ของแถมคิดจากตะกร้า ไม่ได้เก็บในตะกร้า จะได้ไม่ทบซ้อนกันเอง */
  const freeLines = useMemo(
    () => buildFreeLines(cart, productById, { channel }),
    [cart, productById, channel],
  )
  const cartWithFree = useMemo(() => [...cart, ...freeLines], [cart, freeLines])

  /** เพดานจำนวนที่ซื้อได้ต่อสินค้า เผื่อของแถมไว้แล้ว */
  const maxPaidByProduct = useMemo(() => {
    const map = new Map()
    cart.forEach((item) => {
      if (map.has(item.productId)) return
      const product = productById.get(item.productId)
      map.set(item.productId, maxPaidQty(product, item.stockQty ?? Infinity, { channel }))
    })
    return map
  }, [cart, productById, channel])

  const unpricedDelivery = useMemo(
    () => (channel === 'delivery' ? channelProducts.filter(missingDeliveryPrice) : []),
    [channel, channelProducts],
  )

  const cartQtyByProductId = useMemo(() => {
    const map = new Map()
    cartWithFree.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
    })
    return map
  }, [cartWithFree])

  const categories = useMemo(
    () => [...new Set(channelProducts.map((p) => p.category).filter(Boolean))],
    [channelProducts],
  )

  const visibleProducts = useMemo(
    () =>
      activeCategory === 'all'
        ? channelProducts
        : channelProducts.filter((p) => p.category === activeCategory),
    [channelProducts, activeCategory],
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
  /**
   * ตั้งจำนวนตรง ๆ จากแป้นตัวเลข — เพดานต้องเผื่อของแถมด้วย
   * สต็อกเหลือ 11 กับโปร 10 แถม 1 ซื้อได้แค่ 10 เพราะไม้ที่ 11 ต้องกันไว้แถม
   */
  const handleSetQuantity = (key, qty) =>
    setCart((prev) => {
      const item = prev.find((i) => i.key === key)
      const product = item ? productById.get(item.productId) : null
      const ceiling = maxPaidQty(product, item?.stockQty ?? Infinity, { channel })
      return setItemQuantity(prev, key, qty, ceiling)
    })

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

      {/* สลับช่องทางขาย — ราคาและรายการสินค้าเปลี่ยนตามช่องทาง */}
      <div className="shrink-0 flex gap-1.5 px-3 pt-2 pb-1 bg-orange-50">
        {[
          { key: 'store', label: '🏠 หน้าร้าน' },
          { key: 'delivery', label: '🛵 เดลิเวอรี' },
        ].map((c) => (
          <button key={c.key} type="button" onClick={() => setChannel(c.key)}
            className={`flex-1 min-h-[44px] rounded-2xl border-2 font-bold text-sm transition-all ${
              channel === c.key
                ? 'border-orange-500 bg-white text-orange-600 shadow-sm'
                : 'border-transparent bg-white/60 text-gray-500'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {channel === 'delivery' && (
        <div className="shrink-0 px-3 pb-2 bg-orange-50">
          <div className="flex gap-1.5 overflow-x-auto">
            {enabledPlatforms.map((p) => (
              <button key={p} type="button" onClick={() => setPlatform(p)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  platform === p
                    ? `${PLATFORM_BUTTON_BG[p] ?? 'bg-gray-500'} text-white shadow`
                    : 'bg-white border border-gray-200 text-gray-500'
                }`}>
                <span>{PLATFORM_ICONS[p] ?? '🛵'}</span>
                {p}
              </button>
            ))}
          </div>
          {enabledPlatforms.length === 0 && (
            <p className="text-xs text-gray-400 py-2">ยังไม่ได้เปิดแอปเดลิเวอรี — ไปเปิดที่หน้าตั้งค่า</p>
          )}
          {unpricedDelivery.length > 0 && (
            <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              ⚠️ ยังไม่ได้ตั้งราคาเดลิเวอรี: {unpricedDelivery.map((p) => p.name).join(', ')} — ขายที่ราคาหน้าร้านซึ่งหัก GP แล้วอาจขาดทุน
            </p>
          )}
        </div>
      )}

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
                  {productCategoryLabel(cat)}
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
              freeLines={freeLines}
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
              <>
                {cart.map((item) => (
                  <CartItemRow
                    key={item.key}
                    item={item}
                    cartQtyForProduct={cartQtyByProductId?.get(item.productId) ?? item.quantity}
                    maxQty={maxPaidByProduct.get(item.productId)}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    onRemove={handleRemove}
                    onSetQuantity={handleSetQuantity}
                  />
                ))}
                {freeLines.map((line) => (
                  <div key={line.key} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-semibold text-green-700">
                      🎁 แถมฟรี · {line.name}
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      {line.quantity} {line.unit}
                    </span>
                  </div>
                ))}
              </>
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
          freeLines={freeLines}
          channel={channel}
          platform={channel === 'delivery' ? platform : null}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {successResult && (
        <SuccessModal result={successResult} onClose={() => setSuccessResult(null)} />
      )}

      {damageOpen && (
        <DamageModal
          products={activeProducts.filter((p) => !p.is_bundle)}
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
