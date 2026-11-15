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
import { expandToStockUnits, isBundle, missingDeliveryPrice, priceFor, remainingAfterCart, sellableIn } from '../lib/bundles'
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
import { categoryColorMap, colorOfCategory } from '../lib/categoryColors'
import { shiftTimeRange } from '../lib/shiftSales'

function SalesPage() {
  const {
    activeProducts: liveProducts,
    productsLoading,
    productById: liveProductById,
    shopName,
    online,
    enabledPlatforms,
    currentShift,
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

  /**
   * สต็อกหลังขายที่รู้จากบิลที่เพิ่งออก — ใช้แทนค่าจากเซิร์ฟเวอร์ชั่วคราว
   *
   * ออกบิลแล้วต้องรอข้อมูลสินค้ารอบใหม่ถึงจะเห็นสต็อกลด ส่วนใหญ่ไม่กี่วินาที
   * แต่มือถือที่พักหน้าจอไปนาน ๆ ตัวรอฟังข้อมูลบางทีค้าง ป้าย "เหลือ" เลยไม่ลดจนต้องรีเฟรช
   * จำค่าที่ระบบเพิ่งตัดไว้แล้วโชว์ทันที พอข้อมูลจริงมาถึงตรงกันแล้ว (หรือเกิน 30 วินาที) ก็เลิกใช้
   */
  const [stockOverrides, setStockOverrides] = useState(() => new Map())
  useEffect(() => {
    setStockOverrides((prev) => {
      if (prev.size === 0) return prev
      const now = Date.now()
      const next = new Map()
      prev.forEach((o, id) => {
        const live = liveProducts.find((p) => p.id === id)
        if (live && (live.stock_qty ?? 0) !== o.stock && now - o.at < 30000) next.set(id, o)
      })
      return next.size === prev.size ? prev : next
    })
  }, [liveProducts])
  const activeProducts = useMemo(
    () => (stockOverrides.size === 0
      ? liveProducts
      : liveProducts.map((p) => (stockOverrides.has(p.id) ? { ...p, stock_qty: stockOverrides.get(p.id).stock } : p))),
    [liveProducts, stockOverrides],
  )
  const productById = useMemo(
    () => (stockOverrides.size === 0 ? liveProductById : new Map(activeProducts.map((p) => [p.id, p]))),
    [stockOverrides, liveProductById, activeProducts],
  )

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

  // สีตามหมวดคิดจากสินค้าทั้งร้าน ไม่ใช่เฉพาะช่องทางนี้ สลับหน้าร้าน/เดลิเวอรีแล้วสีหมวดเดิมไม่เปลี่ยน
  const colorMap = useMemo(() => categoryColorMap(activeProducts), [activeProducts])

  // ป้าย "เหลือ" บนการ์ด = สต็อกลบของที่กดลงตะกร้าแล้ว (รวมของแถมและส่วนประกอบเซ็ต)
  const remainingByProduct = useMemo(() => {
    const usage = expandToStockUnits(cart, productById)
    return new Map(channelProducts.map((p) => [p.id, remainingAfterCart(p, usage, productById)]))
  }, [cart, channelProducts, productById])

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
    if (result?.stockAfter) {
      const at = Date.now()
      setStockOverrides((prev) => {
        const next = new Map(prev)
        Object.entries(result.stockAfter).forEach(([id, stock]) => next.set(id, { stock, at }))
        return next
      })
    }
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
    <div className="h-full w-full flex flex-col bg-white overflow-hidden">
      {/* หัวส้ม: สถานะกะ ชื่อร้าน และสวิตช์ช่องทางขาย */}
      <header className="shrink-0 bg-orange-500 text-white px-4 pt-3 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/75 font-semibold truncate">
            {currentShift ? `กะเปิดอยู่ · ${shiftTimeRange(currentShift).split(' – ')[0]}` : 'ยังไม่ได้เปิดกะ'}
          </p>
          <h1 className="text-xl font-black leading-tight truncate">{shopName || 'หน้าขาย'}</h1>
        </div>
        {/* ราคาและรายการสินค้าเปลี่ยนตามช่องทาง */}
        <div className="shrink-0 flex bg-white/20 rounded-xl p-1 text-sm font-bold" role="tablist" aria-label="ช่องทางขาย">
          {[
            { key: 'store', label: 'หน้าร้าน' },
            { key: 'delivery', label: 'เดลิเวอรี' },
          ].map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={channel === c.key} onClick={() => requestChannel(c.key)}
              className={`min-h-[40px] px-3 rounded-lg transition-colors ${
                channel === c.key ? 'bg-white text-orange-600' : 'text-white'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {/* ตัวเลือกหมวด/ค้นหาอยู่ในคอลัมน์ซ้ายทั้งหมด แถบตะกร้าฝั่งขวาจะได้เต็มความสูง */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left: product grid */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {channel === 'delivery' && (
          <div className="shrink-0 px-3 pt-2.5">
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
        <div className="shrink-0 px-3 pt-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-2xl bg-gray-100 border-2 border-transparent px-3 transition-colors focus-within:border-orange-400 focus-within:bg-white">
            <Search size={17} className="shrink-0 text-gray-400" />
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
          <button type="button" onClick={() => setDamageOpen(true)}
            className="shrink-0 min-h-[48px] px-3 rounded-2xl bg-gray-100 text-gray-600 text-xs font-bold flex flex-col items-center justify-center leading-tight active:bg-gray-200">
            <PackageX size={16} />
            เสีย/เครม
          </button>
        </div>

          {categories.length > 1 && search.trim() === '' && (
            <div className="shrink-0 flex gap-2 px-3 pt-2.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                  activeCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                ทั้งหมด
              </button>
              {categories.map((cat) => {
                const color = colorOfCategory(colorMap, cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                      activeCategory === cat ? `${color.tile} text-white` : color.soft
                    }`}
                  >
                    {productCategoryLabel(cat)}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!productsLoading && (
              <ProductGrid
                products={visibleProducts}
                cartQtyByProductId={cartQtyByProductId}
                maxByProduct={maxByProduct}
                remainingByProduct={remainingByProduct}
                colorMap={colorMap}
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
        <div className="hidden md:flex flex-col w-80 shrink-0 bg-white border-l-2 border-gray-100">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 shrink-0 border-b border-gray-100">
            <h2 className="font-black text-gray-900 text-lg">ตะกร้าสินค้า</h2>
            <span className="text-sm text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5 font-bold">
              {cart.length} รายการ
            </span>
          </div>

          {/* Scrollable cart items */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 divide-y divide-gray-100 bg-white">
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
          <div className="shrink-0 border-t-2 border-gray-100 bg-white">
            <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
              <p className="text-sm text-gray-400 font-bold">ยอดรวม</p>
              <p className="text-3xl font-black text-gray-900 tabular-nums">
                {total.toLocaleString()} ฿
              </p>
            </div>
            <div className="px-4 pb-5">
              <button
                type="button"
                onClick={openCheckout}
                disabled={cart.length === 0 || !online}
                className="w-full min-h-[64px] rounded-2xl bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-2xl active:scale-95 transition-transform"
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
