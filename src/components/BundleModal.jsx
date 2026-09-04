import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { CHANNELS } from '../lib/constants'
import { bundleCost, bundleStock, profitOf, suggestDeliveryPrice } from '../lib/pricing'
import ModalBackdrop from './ModalBackdrop'

/**
 * สร้าง/แก้เซ็ต — เลือกว่าประกอบจากสินค้าอะไรกี่ชิ้น
 * ระบบดึงต้นทุนจากทะเบียนวัตถุดิบมาคำนวณราคาแนะนำและกำไรให้ทันทีขณะพิมพ์
 */
function BundleModal({ bundle, onClose, onSubmit, onDelete }) {
  const { products, ingredientById, consumableCost, packagingCost, gpRateFor, enabledPlatforms } =
    useAppData()

  const [name, setName] = useState(bundle?.name ?? '')
  const [channel, setChannel] = useState(bundle?.channel ?? 'delivery')
  const [components, setComponents] = useState(bundle?.components ?? [])
  const [price, setPrice] = useState(String(bundle?.delivery_price ?? bundle?.price ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // สินค้าที่เอามาเป็นส่วนประกอบได้ ต้องไม่ใช่เซ็ตด้วยกันเอง กันเซ็ตซ้อนเซ็ต
  const pickable = useMemo(
    () => products.filter((p) => p.is_active !== false && !p.is_bundle),
    [products],
  )
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const draft = { components, is_bundle: true }
  const cost = bundleCost(draft, { productById, ingredientById, consumableCost, packagingCost })
  const stock = bundleStock(draft, productById)

  // เซ็ตที่ขายเฉพาะหน้าร้านไม่โดนหัก GP จึงคิดกำไรคนละแบบ
  const gpRate = channel === 'store' ? 0 : gpRateFor(enabledPlatforms[0])
  const suggested = suggestDeliveryPrice(cost, gpRate)
  const entered = Number(price) || 0
  const result = profitOf({ price: entered, cost, gpRate })
  const belowBreakEven = entered > 0 && result.profit < 0

  const addComponent = (productId) => {
    if (components.some((c) => c.product_id === productId)) return
    setComponents((prev) => [...prev, { product_id: productId, qty: 1 }])
  }

  const setQty = (productId, qty) =>
    setComponents((prev) =>
      prev.map((c) => (c.product_id === productId ? { ...c, qty: Math.max(1, Number(qty) || 1) } : c)),
    )

  const removeComponent = (productId) =>
    setComponents((prev) => prev.filter((c) => c.product_id !== productId))

  const canSave = name.trim() && components.length > 0 && entered > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        channel,
        components,
        price: entered,
        delivery_price: channel === 'store' ? null : entered,
      })
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่')
      setSaving(false)
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={!saving} maxWidthClass="max-w-md">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 flex items-center justify-between">
          <h2 className="font-extrabold text-white text-lg">{bundle ? 'แก้ไขเซ็ต' : 'สร้างเซ็ตใหม่'}</h2>
          <button type="button" onClick={onClose} disabled={saving}
            className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-40"
            aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="bundle-name" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              ชื่อเซ็ต
            </label>
            <input
              id="bundle-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ปลาหมึกย่าง 8 ไม้"
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 font-semibold focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ช่องทางขาย</p>
            <div className="flex gap-2">
              {Object.entries(CHANNELS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setChannel(key)}
                  className={`flex-1 min-h-[46px] rounded-2xl border-2 font-bold text-sm transition-colors ${
                    channel === key
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {channel === 'delivery' && (
              <p className="text-[11px] text-gray-400 mt-1.5">เซ็ตนี้จะไม่โผล่ในหน้าขายโหมดหน้าร้าน</p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ส่วนประกอบ</p>
            <div className="flex flex-col gap-1.5">
              {components.map((c) => {
                const product = productById.get(c.product_id)
                return (
                  <div key={c.product_id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 truncate">
                      {product?.name ?? 'สินค้าที่ถูกลบ'}
                    </span>
                    <input
                      type="number" inputMode="numeric" min="1"
                      value={c.qty}
                      onChange={(e) => setQty(c.product_id, e.target.value)}
                      aria-label={`จำนวน ${product?.name ?? ''}`}
                      className="w-16 h-9 rounded-lg border border-gray-200 bg-gray-50 px-2 text-center text-sm font-bold focus:outline-none focus:border-orange-400"
                    />
                    <span className="text-xs text-gray-400 w-8 shrink-0">{product?.unit ?? 'ชิ้น'}</span>
                    <button type="button" onClick={() => removeComponent(c.product_id)}
                      className="text-gray-300 hover:text-red-500 shrink-0" aria-label="เอาออกจากเซ็ต">
                      <X size={15} />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {pickable
                .filter((p) => !components.some((c) => c.product_id === p.id))
                .map((p) => (
                  <button key={p.id} type="button" onClick={() => addComponent(p.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-orange-300 text-orange-600 text-xs font-bold active:scale-95 transition-transform">
                    <Plus size={12} />
                    {p.name}
                  </button>
                ))}
            </div>
          </div>

          {/* สรุปต้นทุน กำไร */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">ต้นทุนรวม</span>
              <span className="font-bold text-gray-800 tabular-nums">{cost.toFixed(2)} ฿</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">ราคาแนะนำ</span>
              <button type="button" onClick={() => setPrice(String(suggested))}
                className="font-bold text-orange-600 tabular-nums underline decoration-dotted">
                {suggested.toLocaleString()} ฿ · ใช้ราคานี้
              </button>
            </div>
            {components.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">ทำได้จากสต็อกตอนนี้</span>
                <span className="font-bold text-gray-800 tabular-nums">{stock} ชุด</span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="bundle-price" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              ราคาที่ขาย (฿)
            </label>
            <input
              id="bundle-price"
              type="number" inputMode="decimal" step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={String(suggested || 0)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-2xl font-extrabold text-center focus:outline-none transition-all ${
                belowBreakEven
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-gray-50 text-gray-800 focus:border-orange-400 focus:bg-white'
              }`}
            />
            {entered > 0 && (
              <p className={`mt-1.5 text-sm font-semibold text-center ${
                belowBreakEven ? 'text-red-500' : 'text-green-600'
              }`}>
                {belowBreakEven ? '⚠️ ขาดทุน ' : '✓ กำไร '}
                {result.profit.toFixed(2)} ฿ ({Math.round(result.margin * 100)}%)
                {gpRate > 0 && (
                  <span className="block text-[11px] font-normal text-gray-400 mt-0.5">
                    หัก GP {Math.round(gpRate * 100)}% เหลือ {result.net.toFixed(2)} ฿ · ต้นทุน {cost.toFixed(2)} ฿
                  </span>
                )}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          <button type="button" onClick={handleSave} disabled={!canSave}
            className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all">
            {saving ? 'กำลังบันทึก...' : bundle ? 'บันทึกการแก้ไข' : 'สร้างเซ็ต'}
          </button>

          {bundle && onDelete && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 min-h-[46px] rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">
                  ไม่ลบ
                </button>
                <button type="button" onClick={onDelete}
                  className="flex-1 min-h-[46px] rounded-2xl bg-red-500 text-white font-bold text-sm">
                  ยืนยันเลิกขายเซ็ตนี้
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full min-h-[46px] rounded-2xl border border-gray-200 text-gray-400 font-semibold text-sm">
                เลิกขายเซ็ตนี้
              </button>
            )
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default BundleModal
