import { UNCATEGORIZED_COLOR } from '../lib/categoryColors'
import { CRITICAL_STOCK_THRESHOLD } from '../lib/constants'

/**
 * การ์ดสินค้าแบบปุ่มใหญ่ สีตามหมวด
 *
 * ช่วงคนเยอะคนขายไม่อ่านชื่อ จำสีกับตำแหน่งเอา — ส้มคือหมึก ฟ้าคือหอย
 * ราคาตัวโตอยู่มุมล่างซ้าย จำนวนที่กดไว้ขึ้นเป็นวงกลมขาวมุมขวาบน
 */
function ProductCard({ product, cartQty = 0, maxQty, remaining, color = UNCATEGORIZED_COLOR, onSelect }) {
  const stockQty = product.stock_qty ?? 0
  // ที่เหลือหลังหักของในตะกร้า — กดหมึก 13 ไม้จาก 40 ป้ายต้องขึ้น 27 ไม่ใช่ 40 ค้างไว้
  const left = remaining ?? stockQty
  const outOfStock = stockQty <= 0
  // เพดานจริงอาจต่ำกว่าสต็อก เพราะโปรแถมกินของในสต็อกด้วย
  // ถ้าใช้สต็อกตรง ๆ การ์ดจะยังดูกดได้ทั้งที่กดแล้วไม่มีอะไรเกิดขึ้น
  const cartFull = !outOfStock && cartQty >= (maxQty ?? stockQty)
  const disabled = outOfStock || cartFull

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(product)}
      disabled={disabled}
      className={`relative min-h-[132px] rounded-2xl p-3.5 text-left text-white flex flex-col justify-between gap-2 transition-transform ${
        outOfStock ? 'bg-gray-300' : `${color.tile} shadow-sm active:scale-[0.96]`
      } ${cartFull ? 'opacity-70' : ''}`}
    >
      {cartQty > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-9 h-9 px-2 rounded-full bg-white text-gray-900 text-lg font-black flex items-center justify-center shadow-md ring-2 ring-black/10 tabular-nums">
          {cartQty}
        </span>
      )}

      <div className="flex items-start gap-2 pr-6">
        {product.image_base64 && (
          <img src={product.image_base64} alt=""
            className={`w-11 h-11 shrink-0 rounded-xl object-cover border-2 border-white/40 ${outOfStock ? 'grayscale' : ''}`} />
        )}
        <span className="text-base font-black leading-tight line-clamp-2">{product.name}</span>
      </div>

      <div className="flex items-end justify-between gap-1">
        <span className="text-3xl font-black leading-none tabular-nums">
          {product.price}<span className="text-base ml-0.5">฿</span>
        </span>
        <span className={`shrink-0 text-xs font-bold rounded-full px-2 py-0.5 ${
          outOfStock ? 'bg-black/15' : cartFull ? 'bg-white text-gray-900' : left <= CRITICAL_STOCK_THRESHOLD ? 'bg-red-600 ring-2 ring-white' : 'bg-black/20'
        }`}>
          {outOfStock ? 'หมด' : cartFull ? 'ครบแล้ว' : `เหลือ ${left}`}
        </span>
      </div>
    </button>
  )
}

export default ProductCard
