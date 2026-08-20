import { useState } from 'react'
import { EXPENSE_CATEGORY_LABELS, toDateString } from '../lib/expenses'
import ModalBackdrop from './ModalBackdrop'

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS)

function ExpenseModal({ onClose, onSubmit }) {
  const [category, setCategory] = useState('other')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toDateString())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isValid = Number(amount) > 0 && date.trim() !== ''
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ category, amount: Number(amount), date, note: note.trim() })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">บันทึกค่าใช้จ่าย</h2>
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

        <div className="mb-4">
          <span className="text-sm font-medium text-gray-600">หมวดหมู่</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`min-h-[48px] rounded-xl border-2 font-medium transition-colors ${
                  category === key
                    ? 'border-orange-600 bg-orange-50 text-orange-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {EXPENSE_CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">จำนวนเงิน (บาท)</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">วันที่</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">โน้ต (ถ้ามี)</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="เช่น ค่าน้ำเดือนสิงหาคม"
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

export default ExpenseModal
