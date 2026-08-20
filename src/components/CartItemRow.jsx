import { calcItemTotal, formatModifiers } from '../lib/cart'

function CartItemRow({ item, onIncrement, onDecrement, onRemove }) {
  const modifiersText = formatModifiers(item.modifiers)

  return (
    <div className="py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{item.name}</p>
        {modifiersText && (
          <p className="text-sm text-gray-400 truncate">{modifiersText}</p>
        )}
        <p className="text-orange-600 font-semibold">
          {calcItemTotal(item).toLocaleString()} ฿
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onDecrement(item.key)}
          className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 font-bold text-lg flex items-center justify-center active:scale-90"
          aria-label="ลดจำนวน"
        >
          −
        </button>
        <span className="w-10 text-center font-semibold">{item.quantity}</span>
        <button
          type="button"
          onClick={() => onIncrement(item.key)}
          className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 font-bold text-lg flex items-center justify-center active:scale-90"
          aria-label="เพิ่มจำนวน"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.key)}
        className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-gray-400 active:scale-90"
        aria-label="ลบรายการ"
      >
        ×
      </button>
    </div>
  )
}

export default CartItemRow
