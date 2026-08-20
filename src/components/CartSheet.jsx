import { calcCartTotal } from '../lib/cart'
import CartItemRow from './CartItemRow'

function CartSheet({ cart, onIncrement, onDecrement, onRemove, onCheckout }) {
  const total = calcCartTotal(cart)

  return (
    <div className="flex flex-col shrink-0 border-t border-orange-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] max-h-[50vh] sm:max-h-[45vh] min-h-[200px]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <h2 className="font-bold text-gray-700">ตะกร้าสินค้า</h2>
        <span className="text-sm text-gray-400">{cart.length} รายการ</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 divide-y divide-orange-50">
        {cart.length === 0 ? (
          <p className="py-6 text-center text-gray-400">ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          cart.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-orange-100 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm text-gray-400">ยอดรวม</p>
          <p className="text-2xl font-bold text-gray-800">
            {total.toLocaleString()} ฿
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="min-h-[56px] px-4 sm:px-8 rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold whitespace-nowrap text-sm sm:text-base active:scale-95 transition-transform"
        >
          คิดเงิน / ชำระเงิน
        </button>
      </div>
    </div>
  )
}

export default CartSheet
