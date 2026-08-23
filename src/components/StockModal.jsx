import { useState } from 'react'
import ModalBackdrop from './ModalBackdrop'

function StockModal({ product, mode, onClose, onSubmit }) {
  const isAdjustment = mode === 'adjustment'
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const parsedQty = Number(qty)
  const isValid =
    qty.trim() !== '' &&
    Number.isInteger(parsedQty) &&
    (isAdjustment ? parsedQty !== 0 : parsedQty > 0)

  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(parsedQty, note.trim())
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 truncate min-w-0 flex-1 pr-2">
            {isAdjustment ? 'ปรับสต็อก' : 'นำเข้าสต็อก'} · {product.name}
          </h2>
          <button
            type="button"
            onClick={() => canClose && onClose()}
            disabled={!canClose}
            className="w-11 h-11 shrink-0 rounded-full bg-gray-100 text-gray-500 text-lg flex items-center justify-center disabled:opacity-40"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">
            {isAdjustment ? 'จำนวนที่ปรับ (ใส่เครื่องหมาย - หน้าตัวเลขถ้าจะลด)' : 'จำนวนที่นำเข้า'}
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            placeholder={isAdjustment ? 'เช่น -5 หรือ 3' : 'เช่น 50'}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">หมายเหตุ (ถ้ามี)</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={isAdjustment ? 'เช่น ของเสีย/นับผิด' : 'เช่น ล็อตใหม่เช้านี้'}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4"
          />
        </label>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="w-full min-h-[56px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default StockModal
