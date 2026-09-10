import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { toDateString } from '../lib/dates'
import { trim } from '../lib/format'
import { recordPurchases } from '../lib/ingredients'
import { shoppingSuggestions } from '../lib/sauceStock'
import ModalBackdrop from './ModalBackdrop'

/**
 * ซื้อของ — หน้าเดียวจบ
 *
 * รายการมาจากสูตรน้ำจิ้มที่บันทึกไว้ แตะตัวไหนก็เด้งช่องกรอกจำนวนกับเงินที่จ่าย
 * กดบันทึกแล้วเข้าคลังทันทีและแถวนั้นหายไปจากรายการ เหลือแต่ของที่ยังไม่ได้ซื้อ
 *
 * บันทึกทีละรายการทันทีแทนที่จะเก็บรวมไว้ตอนท้าย เพราะยืนอยู่หน้าแผงตอนนั้น
 * จำได้แน่ว่าจ่ายไปเท่าไหร่ ถ้ารอไปกรอกทีเดียวตอนกลับถึงร้านจะเริ่มจำสลับกัน
 */
function SauceShopping({ onEditIngredient }) {
  const { sauces, ingredientById, activeIngredients, online } = useAppData()
  const [target, setTarget] = useState(null)
  const [done, setDone] = useState([])
  const [showAll, setShowAll] = useState(false)

  const suggestions = useMemo(
    () => shoppingSuggestions(sauces, ingredientById),
    [sauces, ingredientById],
  )

  // ซื้อแล้วซ่อนไปเลย ไม่รอให้สต็อกใหม่ดันระดับขึ้น
  // ซื้อพริกครึ่งโลแล้วยังขึ้นว่าใกล้หมดอยู่ จะชวนให้เผลอซื้อซ้ำ
  const doneIds = useMemo(() => new Set(done.map((d) => d.ingredient_id)), [done])
  const todo = suggestions.filter((row) => !doneIds.has(row.ingredient_id))
  const extras = activeIngredients.filter(
    (i) => !doneIds.has(i.id) && !suggestions.some((s) => s.ingredient_id === i.id),
  )
  const total = done.reduce((sum, d) => sum + d.amount, 0)

  const handleSave = async ({ qty, amount }) => {
    await recordPurchases(
      [{
        ingredientId: target.id,
        ingredientName: target.name,
        category: target.category,
        unit: target.unit,
        qty,
        totalAmount: amount,
      }],
      { date: toDateString() },
    )
    setDone((prev) => [...prev, { ingredient_id: target.id, name: target.name, qty, amount, unit: target.unit }])
    setTarget(null)
  }

  const openRow = (row) =>
    setTarget({
      id: row.ingredient_id ?? row.id,
      name: row.name,
      unit: row.unit,
      category: row.category,
      lastPrice: Number(row.lastPrice ?? row.last_price) || 0,
      suggestQty: row.suggestQty ?? 0,
    })

  return (
    <div className="flex flex-col gap-3">
      {!online && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          ตอนนี้ออฟไลน์ — บันทึกเข้าคลังไม่ได้จนกว่าจะมีสัญญาณ จดใส่กระดาษไว้ก่อนแล้วค่อยกรอกตอนกลับถึงร้าน
        </p>
      )}

      {done.length > 0 && (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-green-800">ซื้อแล้ว {done.length} รายการ</p>
            <p className="text-lg font-black text-green-700 tabular-nums">{total.toLocaleString()} ฿</p>
          </div>
          <p className="text-[11px] text-green-700 mt-1">
            {done.map((d) => `${d.name} ${trim(d.qty)} ${d.unit}`).join(' · ')}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          ต้องซื้อ — แตะเพื่อบันทึก
        </p>

        {suggestions.length === 0 && (
          <p className="px-4 pb-3 text-xs text-gray-400">
            ยังไม่มีสูตรน้ำจิ้มที่บันทึกไว้ — ทำน้ำจิ้มสักหม้อก่อน ระบบถึงจะรู้ว่าต้องซื้ออะไร
          </p>
        )}

        {suggestions.length > 0 && todo.length === 0 && (
          <p className="px-4 pb-3 text-xs font-bold text-green-600">✓ ซื้อครบทุกรายการแล้ว</p>
        )}

        {todo.map((row) => (
          <button key={row.ingredient_id} type="button" onClick={() => openRow(row)}
            className="w-full px-4 py-3 border-t border-gray-50 flex items-center gap-2 text-left active:bg-gray-50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[row.level] ?? 'bg-gray-300'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{row.name}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {row.tracked
                  ? `เหลือ ${trim(row.have)} ${row.unit} · ทำได้อีก ${row.pots} หม้อ`
                  : 'ยังไม่ได้นับสต็อก'}
                {row.lastPrice > 0 && ` · ครั้งก่อน ${row.lastPrice.toFixed(2)} ฿/${row.unit}`}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-xl ${
              row.suggestQty > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
            }`}>
              {row.suggestQty > 0 ? `ซื้อ ${trim(row.suggestQty)} ${row.unit}` : 'ซื้อเผื่อ'}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <button type="button" onClick={() => setShowAll(!showAll)}
          className="w-full px-4 py-3 flex items-center justify-between text-left">
          <span className="text-xs font-bold text-gray-500">ซื้อของอื่นที่ไม่อยู่ในรายการ</span>
          <span className="text-gray-300">{showAll ? '−' : '+'}</span>
        </button>
        {showAll && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {extras.length === 0 && <p className="text-[11px] text-gray-400">ไม่มีวัตถุดิบอื่นในทะเบียน</p>}
            {extras.map((i) => (
              <button key={i.id} type="button" onClick={() => openRow(i)}
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold">
                {i.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {target && (
        <BuyModal
          target={target}
          online={online}
          onClose={() => setTarget(null)}
          onSubmit={handleSave}
          onEditIngredient={() => { const id = target.id; setTarget(null); onEditIngredient?.(id) }}
        />
      )}
    </div>
  )
}

const DOT = { out: 'bg-red-500', low: 'bg-amber-500', ok: 'bg-green-500', unknown: 'bg-gray-300' }

/**
 * กรอกของที่เพิ่งซื้อ
 *
 * ต้องกรอกเงินที่จ่ายด้วย ไม่ใช่แค่จำนวน เพราะราคาต่อหน่วยคือตัวตั้งของทั้งระบบ
 * ต้นทุนต่อไม้ ราคาที่ควรตั้ง กำไร วิ่งจากเลขนี้หมด ถ้าบันทึกแต่จำนวน ต้นทุนจะค้างที่ราคาเก่า
 */
export function BuyModal({ target, online, onClose, onSubmit, onEditIngredient }) {
  const [qty, setQty] = useState(target.suggestQty > 0 ? String(target.suggestQty) : '')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const qtyNum = Number(qty) || 0
  const amountNum = Number(amount) || 0
  const unitPrice = qtyNum > 0 ? amountNum / qtyNum : 0
  const before = target.lastPrice

  // เทียบราคากับครั้งก่อน — ยืนหน้าแผงก็รู้ว่าแพงขึ้นกี่เปอร์เซ็นต์ ต่อได้หรือเดินไปเจ้าอื่น
  // และเป็นตัวจับเลขพิมพ์ผิดด้วย พิมพ์ 150 เป็น 1500 จะเด้งขึ้นมาทันที
  const percent = before > 0 && unitPrice > 0 ? ((unitPrice - before) / before) * 100 : null
  const suspicious = percent != null && Math.abs(percent) >= 100

  const isValid = qtyNum > 0 && amountNum > 0
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ qty: qtyNum, amount: amountNum })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ ตรวจสัญญาณแล้วกดใหม่ได้')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 shrink-0">
        <h2 className="text-base font-bold text-white truncate">ซื้อ{target.name}</h2>
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="w-10 h-10 shrink-0 rounded-full bg-white/20 text-white text-xl flex items-center justify-center disabled:opacity-40"
          aria-label="ปิด">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">ได้มากี่ {target.unit}</span>
          <input type="number" inputMode="decimal" step="any" min="0" value={qty} autoFocus
            onChange={(e) => setQty(e.target.value)} placeholder="0"
            className="mt-1 w-full min-h-[56px] rounded-xl border-2 border-orange-300 bg-orange-50 px-4 text-xl text-right font-bold focus:outline-none focus:border-orange-500" />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">จ่ายไปกี่บาท</span>
          <input type="number" inputMode="decimal" step="any" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0"
            className="mt-1 w-full min-h-[56px] rounded-xl border-2 border-orange-300 bg-orange-50 px-4 text-xl text-right font-bold focus:outline-none focus:border-orange-500" />
        </label>

        {unitPrice > 0 && (
          <div className={`rounded-xl border px-3 py-2 ${
            suspicious ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <p className="text-sm font-bold text-gray-800">{unitPrice.toFixed(2)} ฿ ต่อ 1 {target.unit}</p>
            {percent != null && (
              <p className={`text-[11px] font-bold ${
                suspicious ? 'text-red-600' : percent > 0 ? 'text-amber-700' : 'text-green-700'
              }`}>
                ครั้งก่อน {before.toFixed(2)} ฿ · {percent >= 0 ? '🔺' : '🔻'} {Math.abs(Math.round(percent))}%
                {suspicious && ' ⚠️ ต่างจากเดิมมาก ตรวจเลขอีกที'}
              </p>
            )}
          </div>
        )}

        <button type="button" onClick={onEditIngredient}
          className="self-start text-[11px] text-gray-400 underline decoration-dotted underline-offset-2">
          หน่วยไม่ใช่ {target.unit}? แก้ทะเบียนวัตถุดิบ
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 flex gap-2">
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="flex-1 min-h-[52px] rounded-xl bg-gray-100 text-gray-600 font-bold disabled:opacity-40">
          ยกเลิก
        </button>
        <button type="button" onClick={handleSubmit} disabled={!isValid || saving || !online}
          className="flex-[2] min-h-[52px] rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          <Check size={18} />
          {!online ? 'ออฟไลน์' : saving ? 'กำลังบันทึก...' : 'บันทึกเข้าคลัง'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default SauceShopping
