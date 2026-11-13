import { useMemo, useState } from 'react'
import { toDateString } from '../lib/dates'
import { buildExpensePayload, EXPENSE_UNITS, nameSuggestions } from '../lib/expenses'
import ModalBackdrop from './ModalBackdrop'

/** รับเฉพาะตัวเลขกับจุดทศนิยมเดียว — ช่องแบบ text ไม่เปลี่ยนค่าเองตอนเลื่อนเมาส์ผ่านเหมือนช่อง number */
const decimalOnly = (value) => {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [head, ...rest] = cleaned.split('.')
  return rest.length > 0 ? `${head}.${rest.join('')}` : head
}

const asText = (n) => (n === null || n === undefined ? '' : String(n))

/**
 * บันทึกรายจ่าย — ชื่อ ราคา หน่วย จำนวน(ไม่บังคับ)
 *
 * ชื่อที่เคยจดขึ้นเป็นปุ่มให้กด พิมพ์ไปสองสามตัวรายการจะกรองให้เหลือที่ตรง
 * กดแล้วเติมหน่วยกับราคาครั้งล่าสุดให้เลย ส่วนใหญ่แค่ยืนยันแล้วบันทึก
 *
 * `entry` มีค่าเมื่อแก้รายการเดิม
 */
function ExpenseModal({ entry = null, recentEntries = [], onClose, onSubmit }) {
  const [name, setName] = useState(entry?.name ?? '')
  const [amount, setAmount] = useState(asText(entry?.amount))
  const [qty, setQty] = useState(asText(entry?.qty))
  const [unit, setUnit] = useState(entry?.unit ?? '')
  const [date, setDate] = useState(entry?.date ?? toDateString())
  const [note, setNote] = useState(entry?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [picked, setPicked] = useState(Boolean(entry))

  const suggestions = useMemo(
    () => (picked ? [] : nameSuggestions(recentEntries, name)),
    [recentEntries, name, picked],
  )

  // หน่วยที่เคยใช้แต่ไม่อยู่ในปุ่มมาตรฐาน (เช่น "กระสอบ" จากรายการเก่า) ต้องกดได้ด้วย
  const unitChoices = useMemo(() => {
    const list = [...EXPENSE_UNITS]
    if (unit && !list.includes(unit)) list.push(unit)
    return list
  }, [unit])

  const pick = (s) => {
    setName(s.name)
    if (s.unit) setUnit(s.unit)
    if (s.amount) setAmount(String(s.amount))
    setQty(s.qty ? String(s.qty) : '')
    setPicked(true)
  }

  const built = buildExpensePayload({ name, amount, qty, unit, date, note })
  const canClose = !saving

  const handleSubmit = async () => {
    if (built.error || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(built.payload)
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  const unitPrice = Number(qty) > 0 && Number(amount) > 0 ? Number(amount) / Number(qty) : null

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 shrink-0">
        <h2 className="text-base font-bold text-white">{entry ? 'แก้รายจ่าย' : 'จดรายจ่าย'}</h2>
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          aria-label="ปิด"
          className="w-10 h-10 shrink-0 rounded-full bg-white/20 text-white text-xl flex items-center justify-center disabled:opacity-40">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {/* ── ชื่อ ── */}
        <div>
          <label htmlFor="expense-name" className="text-xs font-bold text-gray-500">ซื้ออะไร / จ่ายค่าอะไร</label>
          <input
            id="expense-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setPicked(false) }}
            placeholder="เช่น น้ำแข็ง, ถ่าน, ค่าเช่าที่"
            autoComplete="off"
            className="mt-1 w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base font-semibold focus:outline-none focus:border-orange-400"
          />
          {suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-gray-400 mb-1.5">
                {name.trim() ? 'เคยจดไว้ — กดเพื่อเลือก' : 'จดบ่อย — กดเลือกได้เลย'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s.key} type="button" onClick={() => pick(s)}
                    className="min-h-[44px] rounded-xl bg-orange-50 border border-orange-200 px-3 text-left active:scale-95 transition-transform">
                    <span className="block text-sm font-bold text-orange-800 leading-tight">{s.name}</span>
                    <span className="block text-[10px] text-orange-500 leading-tight">
                      ครั้งก่อน {s.amount.toLocaleString()} ฿{s.qty ? ` · ${s.qty} ${s.unit ?? ''}` : s.unit ? ` · ${s.unit}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {name.trim() && !picked && suggestions.length === 0 && (
            <p className="text-[11px] text-gray-400 mt-1.5">ชื่อใหม่ — บันทึกแล้วครั้งหน้าจะขึ้นให้กดเลือก</p>
          )}
        </div>

        {/* ── ราคา ── */}
        <div>
          <label htmlFor="expense-amount" className="text-xs font-bold text-gray-500">จ่ายไปทั้งหมด (บาท)</label>
          <input
            id="expense-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(decimalOnly(e.target.value))}
            placeholder="0"
            className="mt-1 w-full min-h-[56px] rounded-xl border-2 border-gray-200 bg-white px-4 text-2xl font-extrabold tabular-nums focus:outline-none focus:border-orange-400"
          />
        </div>

        {/* ── หน่วย ── */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">หน่วย <span className="font-normal text-gray-400">(ไม่ใส่ก็ได้)</span></p>
          <div className="grid grid-cols-4 gap-1.5">
            {unitChoices.map((u) => (
              <button key={u} type="button" onClick={() => setUnit(unit === u ? '' : u)}
                aria-pressed={unit === u}
                className={`min-h-[44px] rounded-xl border-2 text-sm font-bold transition-colors ${
                  unit === u ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 bg-white text-gray-600'
                }`}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* ── จำนวน ── */}
        <div>
          <label htmlFor="expense-qty" className="text-xs font-bold text-gray-500">
            จำนวน <span className="font-normal text-gray-400">(ไม่ใส่ก็ได้)</span>
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="expense-qty"
              type="text"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(decimalOnly(e.target.value))}
              placeholder="-"
              className="w-28 min-h-[48px] rounded-xl border-2 border-gray-200 bg-white px-4 text-lg font-bold tabular-nums focus:outline-none focus:border-orange-400"
            />
            <span className="text-sm font-bold text-gray-500">{unit}</span>
            {unitPrice !== null && (
              <span className="ml-auto text-xs text-gray-400 tabular-nums">
                ตก{unit || 'ชิ้น'}ละ {Number(unitPrice.toFixed(2)).toLocaleString()} ฿
              </span>
            )}
          </div>
        </div>

        {/* ── วันที่ + โน้ต ── */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-bold text-gray-500">วันที่</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-500">โน้ต</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="ไม่บังคับ"
              className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" />
          </label>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        <button type="button" onClick={handleSubmit} disabled={Boolean(built.error) || saving}
          className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold text-base shadow-lg shadow-orange-200 active:scale-95 transition-all">
          {saving ? 'กำลังบันทึก...' : built.error && (name.trim() || amount) ? built.error : 'บันทึก'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default ExpenseModal
