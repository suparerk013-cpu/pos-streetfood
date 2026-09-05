import { useState } from 'react'
import { calcItemTotal, formatModifiers } from '../lib/cart'
import QtyModal from './QtyModal'

function CartItemRow({ item, cartQtyForProduct, maxQty, onIncrement, onDecrement, onRemove, onSetQuantity, onEditModifiers }) {
  const modifiersText = formatModifiers(item.modifiers)
  const atLimit = cartQtyForProduct >= (maxQty ?? item.stockQty ?? Infinity)
  const [qtyModalOpen, setQtyModalOpen] = useState(false)

  return (
    <div className="py-3 flex items-center gap-3">
      {/* แตะชื่อสินค้าเพื่อเลือกความเผ็ด/น้ำจิ้ม — ย้ายมาไว้ตรงนี้แทนหน้าต่างที่เคยเด้งตอนกดสินค้า */}
      <button
        type="button"
        onClick={() => onEditModifiers?.(item)}
        disabled={!onEditModifiers}
        className="flex-1 min-w-0 text-left disabled:cursor-default"
      >
        <p className="font-medium text-gray-800 truncate">{item.name}</p>
        {onEditModifiers && (
          <p className={`text-sm truncate ${modifiersText ? 'text-gray-400' : 'text-orange-400'}`}>
            {modifiersText || 'แตะเพื่อเลือกความเผ็ด / น้ำจิ้ม'}
          </p>
        )}
        {!onEditModifiers && modifiersText && (
          <p className="text-sm text-gray-400 truncate">{modifiersText}</p>
        )}
        <p className="text-orange-600 font-semibold">
          {calcItemTotal(item).toLocaleString()} ฿
        </p>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onDecrement(item.key)}
          className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 font-bold text-lg flex items-center justify-center active:scale-90"
          aria-label="ลดจำนวน"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setQtyModalOpen(true)}
          className="w-10 text-center font-semibold rounded-lg active:bg-orange-50"
        >
          {item.quantity}
        </button>
        <button
          type="button"
          onClick={() => onIncrement(item.key)}
          disabled={atLimit}
          className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 font-bold text-lg flex items-center justify-center active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
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

      {qtyModalOpen && (
        <QtyModal
          item={item}
          maxQty={maxQty}
          onClose={() => setQtyModalOpen(false)}
          onConfirm={(qty) => onSetQuantity(item.key, qty)}
        />
      )}
    </div>
  )
}

export default CartItemRow
