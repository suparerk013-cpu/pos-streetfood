import { useState } from 'react'
import ModalBackdrop from './ModalBackdrop'
import Numpad from './Numpad'

function QtyModal({ item, onClose, onConfirm }) {
  const [value, setValue] = useState('0')
  const stockQty = item.stockQty ?? Infinity
  const qty = Number(value)
  const isValid = qty > 0 && qty <= stockQty

  const handleConfirm = () => {
    if (!isValid) return
    onConfirm(qty)
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose} maxWidthClass="max-w-sm">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 truncate min-w-0 flex-1 pr-2">{item.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-gray-100 text-gray-500 text-lg flex items-center justify-center"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>

        <Numpad value={value} onChangeValue={setValue} unit="ชิ้น" />

        {Number.isFinite(stockQty) && qty > stockQty && (
          <p className="mt-2 text-center text-sm text-red-500">มีสต็อกเหลือ {stockQty} ชิ้น</p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid}
          className="mt-3 w-full min-h-[60px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-xl active:scale-95 transition-transform"
        >
          ยืนยันจำนวน
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default QtyModal
