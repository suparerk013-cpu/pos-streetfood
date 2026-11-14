import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import CartItemRow from './CartItemRow'

/**
 * ตะกร้าบนมือถือ — ปกติหุบเหลือแถบล่างแถบเดียว: จำนวนชิ้น ยอด และปุ่มคิดเงิน
 *
 * จำนวนที่กดไว้ขึ้นบนการ์ดสินค้าอยู่แล้ว ไม่ต้องกางรายการกินครึ่งจอตลอดเวลา
 * อยากแก้จำนวนหรือลบรายการค่อยแตะแถบซ้ายเพื่อกางออก
 */
function CartSheet({ cart, total = 0, maxByProduct, productById, channel = 'store', cartQtyByProductId, onIncrement, onDecrement, onRemove, onSetQuantity, onCheckout, checkoutDisabled = false }) {
  const [open, setOpen] = useState(false)
  const pieces = cart.reduce((s, i) => s + i.quantity, 0)
  const empty = cart.length === 0

  return (
    <div className="flex flex-col shrink-0 bg-white border-t-2 border-gray-100 shadow-[0_-6px_20px_rgba(0,0,0,0.08)]">
      {open && !empty && (
        <div className="max-h-[45vh] overflow-y-auto px-4 divide-y divide-gray-100">
          <div className="flex items-center justify-between py-2">
            <h2 className="font-black text-gray-800">ตะกร้าสินค้า · {cart.length} รายการ</h2>
            <button type="button" onClick={() => setOpen(false)} className="min-h-[40px] px-3 text-sm font-bold text-gray-500">หุบ</button>
          </div>
          {cart.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              cartQtyForProduct={cartQtyByProductId?.get(item.productId) ?? item.quantity}
              maxQty={maxByProduct?.get(item.productId)}
              product={productById?.get(item.productId)}
              channel={channel}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
              onSetQuantity={onSetQuantity}
            />
          ))}
        </div>
      )}

      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} disabled={empty}
          aria-expanded={open}
          className="flex-1 min-w-0 min-h-[60px] text-left rounded-2xl px-2 active:bg-gray-50 disabled:active:bg-transparent">
          <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
            {empty ? 'ยังไม่มีสินค้า' : `${pieces.toLocaleString()} ชิ้น · ดูตะกร้า`}
            {!empty && (open ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
          </span>
          <span className="block text-3xl font-black text-gray-900 tabular-nums leading-tight">
            {total.toLocaleString()} ฿
          </span>
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={empty || checkoutDisabled}
          className="shrink-0 min-h-[64px] min-w-[140px] px-6 rounded-2xl bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-xl active:scale-95 transition-transform"
        >
          {checkoutDisabled ? 'ออฟไลน์' : 'คิดเงิน'}
        </button>
      </div>
    </div>
  )
}

export default CartSheet
