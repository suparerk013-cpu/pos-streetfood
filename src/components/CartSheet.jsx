import { calcCartTotal } from '../lib/cart'
import CartItemRow from './CartItemRow'

function CartSheet({ cart, cartQtyByProductId, onIncrement, onDecrement, onRemove, onSetQuantity, onCheckout, checkoutDisabled = false }) {
  const total = calcCartTotal(cart)

  return (
    <div className="flex flex-col shrink-0 shadow-[0_-6px_20px_rgba(0,0,0,0.1)] max-h-[50vh] sm:max-h-[45vh] min-h-[200px]">
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 shrink-0 bg-gradient-to-r from-orange-500 to-red-500">
        <h2 className="font-bold text-white tracking-wide">ตะกร้าสินค้า</h2>
        <span className="text-sm text-white/80 bg-white/20 rounded-full px-2.5 py-0.5 font-medium">{cart.length} รายการ</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 divide-y divide-orange-50 bg-white">
        {cart.length === 0 ? (
          <p className="py-6 text-center text-gray-400">ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          cart.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              cartQtyForProduct={cartQtyByProductId?.get(item.productId) ?? item.quantity}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
              onSetQuantity={onSetQuantity}
            />
          ))
        )}
      </div>

      {/* Mobile footer: total left, button right (ขยาย touch target) */}
      <div className="shrink-0 bg-white border-t border-orange-100 sm:hidden px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-none">ยอดรวม</p>
          <p className="text-2xl font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent leading-tight">
            {total.toLocaleString()} ฿
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={cart.length === 0 || checkoutDisabled}
          className="min-h-[64px] min-w-[140px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-xl shadow-lg shadow-orange-300 active:scale-95 transition-all"
        >
          {checkoutDisabled ? 'ออฟไลน์' : 'คิดเงิน'}
        </button>
      </div>

      {/* Desktop/Tablet footer: ยอดบนซ้าย, ปุ่มใหญ่กลาง */}
      <div className="hidden sm:block shrink-0 bg-white border-t border-orange-100">
        <div className="px-4 pt-2 pb-1 flex items-baseline justify-between">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">ยอดรวม</p>
          <p className="text-2xl font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            {total.toLocaleString()} ฿
          </p>
        </div>
        <div className="px-8 pb-4">
          <button
            type="button"
            onClick={onCheckout}
            disabled={cart.length === 0 || checkoutDisabled}
            className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-2xl shadow-xl shadow-orange-200 active:scale-95 transition-all tracking-wide"
          >
            {checkoutDisabled ? 'ออฟไลน์' : 'คิดเงิน'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CartSheet
