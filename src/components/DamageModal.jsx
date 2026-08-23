import { useState } from 'react'
import ModalBackdrop from './ModalBackdrop'

const REASONS = ['ตกพื้น', 'ไฟไหม้/ไหม้', 'หมดอายุ', 'ชำรุด/แตกหัก', 'อื่นๆ']

function DamageModal({ products, onClose, onSubmit }) {
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState(REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const parsedQty = Number(qty)
  const finalReason = reason === 'อื่นๆ' ? customReason.trim() : reason
  const isValid = productId !== '' && Number.isInteger(parsedQty) && parsedQty > 0 && finalReason !== ''
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ productId, qty: parsedQty, reason: finalReason })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">แจ้งสินค้าเสียหาย</h2>
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
          <span className="text-sm font-medium text-gray-600">สินค้า</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-base bg-white"
          >
            <option value="">เลือกสินค้า...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (เหลือ {p.stock_qty ?? 0})</option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">จำนวนที่เสียหาย</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <div className="mb-4">
          <span className="text-sm font-medium text-gray-600 block mb-2">สาเหตุ</span>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  reason === r ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {reason === 'อื่นๆ' && (
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-600">ระบุสาเหตุ</span>
            <input
              type="text"
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
              placeholder="เช่น หมากัด, ลืมไว้กลางแดด"
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4"
            />
          </label>
        )}

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="w-full min-h-[56px] rounded-xl bg-red-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกสินค้าเสียหาย'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default DamageModal
