import { PackageX, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CartItemRow from '../components/CartItemRow'
import CartSheet from '../components/CartSheet'
import CheckoutModal from '../components/CheckoutModal'
import DamageModal from '../components/DamageModal'
import ModalBackdrop from '../components/ModalBackdrop'
import ProductGrid from '../components/ProductGrid'
import SuccessModal from '../components/SuccessModal'
import { useAppData } from '../lib/appDataContext'
import { isBundle, missingDeliveryPrice, priceFor, sellableIn } from '../lib/bundles'
import { PLATFORM_BUTTON_BG, PLATFORM_ICONS, productCategoryLabel } from '../lib/constants'
import { bundleStock } from '../lib/pricing'
import { searchProducts } from '../lib/productSearch'
import { cartSubtotal, maxKeyableQty, splitCart } from '../lib/promo'
import {
  addItemToCart,
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
  const [search, setSearch] = useState('')
  const [pendingChannel, setPendingChannel] = useState(null)
  const [damageOpen, setDamageOpen] = useState(false)

  // สลับช่องทางแล้วราคาเปลี่ยนทั้งกระดาน ตะกร้าเดิมจึงใช้ต่อไม่ได้
  useEffect(() => {
    setCart([])
    setActiveCategory('all')
    setSearch('')
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

  /**
   * จำนวนในตะกร้าคือของที่ลูกค้ารับไปทั้งหมด แตกออกเป็นบรรทัดที่คิดเงินกับบรรทัดแถม
   * ตอนออกบิลเท่านั้น ตะกร้าบนหน้าจอยังโชว์จำนวนเต็มที่คนขายกดไว้
   */
  const { paidLines, freeLines } = useMemo(
    () => splitCart(cart, productById, { channel }),
    [cart, productById, channel],
  )

  const unpricedDelivery = useMemo(
    () => (channel === 'delivery' ? channelProducts.filter(missingDeliveryPrice) : []),
    [channel, channelProducts],
  )

  /**
   * กดได้สูงสุดกี่ชิ้นต่อสินค้า
   *
   * ต่ำกว่าสต็อกได้ เพราะกดครบชุดโปรแล้วต้องมีของเหลือพอส่งของแถมด้วย
   * คิดจากสินค้าทุกตัวที่ขายได้ ไม่ใช่เฉพาะที่อยู่ในตะกร้า เพราะการ์ดสินค้า
   * ต้องรู้เพดานด้วยถึงจะขึ้นป้าย "ครบแล้ว" ได้ถูกจังหวะ ไม่งั้นการ์ดจะดูกดได้
   * แต่กดแล้วไม่มีอะไรเกิดขึ้น
   */
  const maxByProduct = useMemo(() => {
    const map = new Map()
    channelProducts.forEach((p) => {
      map.set(p.id, maxKeyableQty(p, p.stock_qty ?? Infinity, { channel }))
    })
    return map
  }, [channelProducts, channel])

  const cartQtyByProductId = useMemo(() => {
    const map = new Map()
    cart.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
    })
    return map
  }, [cart])

  const categories = useMemo(
    () => [...new Set(channelProducts.map((p) => p.category).filter(Boolean))],
    [channelProducts],
  )

  /**
   * พิมพ์ค้นหาแล้วค้นทั้งร้าน ไม่ติดหมวดที่เลือกค้างไว้
   * ไม่งั้นเลือกหมวด "ปลาหมึก" อยู่ พิมพ์ "ลูกชิ้น" จะไม่เจอ แล้วงงว่าทำไม
   */
  const visibleProducts = useMemo(() => {
    if (search.trim() !== '') return searchProducts(channelProducts, search)
    return activeCategory === 'all'
      ? channelProducts
      : channelProducts.filter((p) => p.category === activeCategory)
  }, [channelProducts, activeCategory, search])

  /**
   * แตะสินค้า = ลงตะกร้าทันที ไม่มีหน้าต่างถามตัวเลือกคั่น
   *
   * หน้าร้านต้องกดเร็ว ๆ ตอนลูกค้ายืนรอ การเด้งหน้าต่างถามความเผ็ด/น้ำจิ้มทุกครั้ง
   * ทำให้การขาย 1 ไม้กลายเป็น 4 แตะ ตอนนี้เลิกใช้ตัวเลือกแล้ว เหลือแตะเดียวจบ
   */
  /**
   * สลับช่องทางล้างตะกร้าทิ้ง เพราะราคาคนละชุดกัน ของเดิมใช้ต่อไม่ได้
   * แต่ถ้าเผลอแตะโดนตอนคีย์ออเดอร์ยาว ๆ อยู่ ของหายหมดโดยไม่มีทางเรียกคืน
   * มีของอยู่ในตะกร้าจึงต้องถามก่อน
   */
  const requestChannel = (next) => {
    if (next === channel) return
    if (cart.length > 0) {
      setPendingChannel(next)
      return
    }
    setChannel(next)
  }

  const confirmChannel = () => {
    setChannel(pendingChannel)
    setPendingChannel(null)
  }

  const handleSelectProduct = (product) => {
    if ((product.stock_qty ?? 0) <= 0) return
    setCart((prev) => addItemToCart(prev, product, {}, maxByProduct.get(product.id)))
  }

  const handleIncrement = (key) =>
    setCart((prev) => {
      const item = prev.find((i) => i.key === key)
      return updateItemQuantity(prev, key, 1, maxByProduct.get(item?.productId))
    })
  const handleDecrement = (key) => setCart((prev) => updateItemQuantity(prev, key, -1))
  const handleRemove = (key) => setCart((prev) => removeItem(prev, key))
  /**
   * ตั้งจำนวนตรง ๆ จากแป้นตัวเลข
   * เพดานคือสต็อกที่มี เพราะเลขที่กดคือของที่ออกจากร้านจริง รวมของแถมแล้ว
   */
  const handleSetQuantity = (key, qty) =>
    setCart((prev) => {
      const item = prev.find((i) => i.key === key)
      return setItemQuantity(prev, key, qty, maxByProduct.get(item?.productId))
    })

  const handleCheckoutSuccess = (result) => {
    setCheckoutOpen(false)
    setCart([])
    setSearch('')
    setSuccessResult(result)
  }

  const openCheckout = () => {
    if (!online) return
    setCheckoutOpen(true)
  }

  /** ยอดที่เก็บจริง หักของแถมออกแล้ว — 11 ไม้ กับโปร 10 แถม 1 คือ 100 บาท */
  const total = cartSubtotal(cart, productById, { channel })

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

      {/* ตัวเลือกช่องทาง/หมวดหมู่อยู่ในคอลัมน์ซ้ายทั้งหมด แถบตะกร้าฝั่งขวาจะได้เต็มความสูง
          ตั้งแต่ใต้หัวเรื่องจนถึงขอบล่าง ไม่มีแถบสีส้มโผล่คั่นข้างบน */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left: product grid */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* สลับช่องทางขาย — ราคาและรายการสินค้าเปลี่ยนตามช่องทาง */}
        <div className="shrink-0 flex gap-1.5 px-3 pt-2 pb-1 bg-orange-50">
          {[
            { key: 'store', label: '🏠 หน้าร้าน' },
            { key: 'delivery', label: '🛵 เดลิเวอรี' },
          ].map((c) => (
            <button key={c.key} type="button" onClick={() => requestChannel(c.key)}
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

        {/* ช่องค้นหา — ไม่ auto focus เด็ดขาด ไม่งั้นเปิดหน้าขายทีคีย์บอร์ดเด้งบังครึ่งจอ */}
        <div className="shrink-0 px-3 pt-1 pb-2 bg-orange-50">
          <div className="flex items-center gap-2 rounded-2xl bg-white border-2 border-transparent px-3 shadow-sm transition-colors focus-within:border-orange-400 focus-within:shadow">
            <Search size={17} className="shrink-0 text-orange-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              enterKeyHint="search"
              aria-label="ค้นหาสินค้า"
              className="flex-1 min-w-0 h-11 bg-transparent text-sm font-semibold text-gray-700 placeholder:text-gray-400 placeholder:font-medium focus:outline-none"
            />
            {search !== '' && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
                className="shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

          {categories.length > 1 && search.trim() === '' && (
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
              <ProductGrid
                products={visibleProducts}
                cartQtyByProductId={cartQtyByProductId}
                maxByProduct={maxByProduct}
                onSelectProduct={handleSelectProduct}
                emptyMessage={
                  search.trim() !== ''
                    ? `ไม่พบสินค้าที่ตรงกับ "${search.trim()}"\nลองพิมพ์สั้นลง หรือกดกากบาทเพื่อล้างคำค้น`
                    : channel === 'delivery'
                      ? 'เดลิเวอรีขายเฉพาะสินค้าจัดเซ็ต\nไปสร้างเซ็ตที่ คลังสินค้า › แท็บเซ็ต'
                      : undefined
                }
              />
            )}
          </div>

          {/* Bottom cart sheet — mobile only */}
          <div className="md:hidden">
            <CartSheet
              cart={cart}
              total={total}
              maxByProduct={maxByProduct}
              productById={productById}
              channel={channel}
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
                    maxQty={maxByProduct.get(item.productId)}
                    product={productById.get(item.productId)}
                    channel={channel}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    onRemove={handleRemove}
                    onSetQuantity={handleSetQuantity}
                  />
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

      {pendingChannel && (
        <ModalBackdrop onClose={() => setPendingChannel(null)}>
          <div className="p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">สลับช่องทางขาย?</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                ตะกร้ามีสินค้าอยู่ {cart.length} รายการ
                <span className="block mt-1 font-semibold text-red-500">
                  สลับไป{pendingChannel === 'delivery' ? 'เดลิเวอรี' : 'หน้าร้าน'}แล้วตะกร้าจะถูกล้าง
                  เพราะคนละราคากัน
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPendingChannel(null)}
                className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-700 font-bold active:scale-95 transition-transform">
                ขายต่อ
              </button>
              <button type="button" onClick={confirmChannel}
                className="flex-1 min-h-[52px] rounded-2xl bg-red-500 text-white font-bold active:scale-95 transition-transform">
                ล้างแล้วสลับ
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={paidLines}
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
