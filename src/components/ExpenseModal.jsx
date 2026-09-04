import { useState } from 'react'
import { toDateString } from '../lib/dates'
import { EXPENSE_CATEGORY_ICONS as CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS } from '../lib/expenses'
import ModalBackdrop from './ModalBackdrop'

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS)

function ExpenseModal({ onClose, onSubmit }) {
  const [category, setCategory] = useState('utility_water')
  const [customLabel, setCustomLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toDateString())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const needsLabel = category === 'other'
  const labelPlaceholder = 'เช่น ค่าซ่อมอุปกรณ์'
  const labelTitle = 'ชื่อค่าใช้จ่าย'

  const isValid = Number(amount) > 0 && date.trim() !== '' && (!needsLabel || customLabel.trim() !== '')
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        category,
        custom_label: needsLabel ? customLabel.trim() : null,
        amount: Number(amount),
        date,
        note: note.trim(),
      })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 shrink-0">
        <h2 className="text-base font-bold text-white">บันทึกค่าใช้จ่าย</h2>
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="w-10 h-10 shrink-0 rounded-full bg-white/20 text-white text-xl flex items-center justify-center disabled:opacity-40">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Category selector */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">หมวดหมู่</p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_KEYS.map((key) => (
              <button key={key} type="button" onClick={() => { setCategory(key); setCustomLabel('') }}
                className={`min-h-[52px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
                  category === key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 bg-white'
                }`}>
                <span className="text-lg">{CATEGORY_ICONS[key]}</span>
                {EXPENSE_CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Item name for raw_material or other */}
        {needsLabel && (
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {labelTitle} <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={labelPlaceholder}
              autoFocus
              className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-orange-300 bg-orange-50 px-4 text-sm focus:outline-none focus:border-orange-500"
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนเงิน (บาท)</span>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-xl font-bold focus:outline-none focus:border-orange-400" />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">โน้ต</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="ไม่บังคับ"
              className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-3 text-sm" />
          </label>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        <button type="button" onClick={handleSubmit} disabled={!isValid || saving}
          className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold text-base shadow-lg shadow-orange-200 active:scale-95 transition-all">
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default ExpenseModal
