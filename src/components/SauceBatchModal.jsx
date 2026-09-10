import { useMemo, useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import {
  batchTotals,
  entryUnitsFor,
  lineAmount,
  lineBaseQty,
  linesMissingPrice,
  linesOverStock,
} from '../lib/sauceCost'
import IngredientModal from './IngredientModal'
import ModalBackdrop from './ModalBackdrop'

/**
 * บันทึกว่าวันนี้ทำน้ำจิ้มไป 1 หม้อ
 *
 * เปิดมาพร้อมสูตรของหม้อก่อนหน้าเป็นค่าตั้งต้น เพราะส่วนใหญ่ทำเหมือนเดิม
 * วันไหนพริกแพงแล้วใส่น้อยลงก็แก้เฉพาะบรรทัดนั้น ไม่ต้องกรอกใหม่ทั้งหม้อ
 *
 * ตัวเลขที่กรอกคือของที่ใส่จริง ไม่ใช่ของที่ตั้งใจจะใส่ — ต้นทุนที่ได้จึงเป็นของวันนั้นจริง ๆ
 */

let rowSeq = 0
const newRow = (line = {}) => {
  rowSeq += 1
  return {
    id: rowSeq,
    ingredient_id: line.ingredient_id ?? '',
    qty: line.qty != null ? String(line.qty) : '',
    entry_unit: line.entry_unit ?? '',
    per_batch: line.per_batch != null ? String(line.per_batch) : '',
  }
}

function SauceBatchModal({ sauce, onClose, onSubmit }) {
  const { activeIngredients, ingredientById } = useAppData()
  const [rows, setRows] = useState(() => {
    const recipe = sauce?.recipe ?? []
    return recipe.length > 0 ? recipe.map((line) => newRow(line)) : [newRow()]
  })
  const [yieldQty, setYieldQty] = useState(String(sauce?.last_batch?.yield_qty ?? ''))
  const [serves, setServes] = useState(String(sauce?.last_batch?.serves ?? ''))
  const [note, setNote] = useState('')
  const [editIngredient, setEditIngredient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const lines = useMemo(
    () =>
      rows.map((row) => {
        const ingredient = ingredientById.get(row.ingredient_id)
        return {
          ingredient_id: row.ingredient_id,
          ingredient_name: ingredient?.name ?? '',
          unit: ingredient?.unit ?? 'ชิ้น',
          qty: Number(row.qty) || 0,
          // ยังไม่ได้เลือกหน่วยก็ถือว่ากรอกเป็นหน่วยที่ซื้อมา ซึ่งเป็นตัวเลือกแรกเสมอ
          entry_unit: row.entry_unit || ingredient?.unit || 'ชิ้น',
          content_qty: Number(ingredient?.content_qty) || null,
          per_batch: Number(row.per_batch) || 0,
        }
      }),
    [rows, ingredientById],
  )

  const totals = useMemo(
    () => batchTotals(lines, { yieldQty, serves, ingredientById }),
    [lines, yieldQty, serves, ingredientById],
  )
  const missing = useMemo(() => linesMissingPrice(lines, ingredientById), [lines, ingredientById])
  const overStock = useMemo(() => linesOverStock(lines, ingredientById), [lines, ingredientById])

  const addRow = () => setRows((prev) => [...prev, newRow()])
  const removeRow = (id) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  const updateRow = (id, field, value) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  /** สลับวัตถุดิบแล้วต้องล้างหน่วยที่เลือกไว้ ไม่งั้นค้างหน่วยของตัวเก่าที่ตัวใหม่ไม่มี */
  const changeIngredient = (id, ingredientId) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ingredient_id: ingredientId, entry_unit: '', per_batch: '' } : r)),
    )

  const isValid = totals.lines.length > 0 && Number(yieldQty) > 0 && Math.floor(Number(serves)) > 0
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ lines, yieldQty: Number(yieldQty), serves: Math.floor(Number(serves)), note })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose} maxWidthClass="max-w-lg">
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 shrink-0">
        <h2 className="text-base font-bold text-white">
          {sauce?.icon ?? '🍲'} บันทึกทำ{sauce?.name ?? 'น้ำจิ้ม'}
        </h2>
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="w-10 h-10 shrink-0 rounded-full bg-white/20 text-white text-xl flex items-center justify-center disabled:opacity-40"
          aria-label="ปิด">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500 -mb-1">
          กรอกที่ใช้จริงวันนี้ พรุ่งนี้ใส่ไม่เท่ากันก็กรอกใหม่ได้ ระบบจะจำสูตรล่าสุดไว้ให้
        </p>

        <div className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const ingredient = ingredientById.get(row.ingredient_id)
            // คิดจากบรรทัดตรง ๆ ไม่ไปหยิบจากยอดรวม เผื่อใส่วัตถุดิบตัวเดียวกันสองบรรทัด
            const amount = lineAmount(lines[index], ingredientById)
            const used = lineBaseQty(lines[index], ingredientById)
            const units = entryUnitsFor(ingredient)
            const noPrice = row.ingredient_id && !(Number(ingredient?.last_price) > 0)
            return (
              <div key={row.id} className="rounded-xl border-2 border-gray-200 p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={row.ingredient_id}
                    onChange={(e) => changeIngredient(row.id, e.target.value)}
                    className="flex-1 min-w-0 min-h-[44px] rounded-lg border-2 border-gray-200 bg-white px-2 text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">— เลือกวัตถุดิบ —</option>
                    {activeIngredients.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                    placeholder="0"
                    className="w-20 shrink-0 min-h-[44px] rounded-lg border-2 border-orange-300 bg-orange-50 px-2 text-sm text-right font-bold focus:outline-none focus:border-orange-500"
                  />
                  {units.length > 1 ? (
                    <select
                      value={lines[index].entry_unit}
                      onChange={(e) => updateRow(row.id, 'entry_unit', e.target.value)}
                      aria-label="หน่วยที่ตวง"
                      className="w-20 shrink-0 min-h-[44px] rounded-lg border-2 border-gray-200 bg-white px-1 text-xs focus:outline-none focus:border-orange-500"
                    >
                      {units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="w-14 shrink-0 text-xs text-gray-500 truncate">{ingredient?.unit ?? ''}</span>
                  )}
                  <button type="button" onClick={() => removeRow(row.id)}
                    className="w-9 h-9 shrink-0 rounded-full bg-gray-100 text-gray-400 text-lg flex items-center justify-center"
                    aria-label="ลบบรรทัด">×</button>
                </div>

                <div className="flex items-center justify-between gap-2 pl-1">
                  <button type="button" onClick={() => ingredient && setEditIngredient(ingredient)}
                    disabled={!ingredient}
                    className="text-[11px] text-gray-400 underline decoration-dotted underline-offset-2 disabled:no-underline text-left">
                    {ingredient
                      ? ingredient.content_qty > 0 && ingredient.content_unit
                        ? `1 ${ingredient.unit} = ${trim(ingredient.content_qty)} ${ingredient.content_unit} · แก้`
                        : `ตั้งว่า 1 ${ingredient.unit} มีกี่ มล./กรัม`
                      : ''}
                  </button>
                  <span className={`text-xs font-bold ml-auto shrink-0 ${noPrice ? 'text-red-500' : 'text-gray-700'}`}>
                    {noPrice ? 'ยังไม่มีราคาซื้อ' : `${amount.toFixed(2)} ฿`}
                  </span>
                </div>

                {ingredient && used > 0 && (
                  <p className="text-[11px] text-gray-400 pl-1 -mt-1">
                    ตัดสต็อก {trim(used)} {ingredient.unit}
                    {' · '}เหลือ {trim(Math.max(0, (Number(ingredient.stock_qty) || 0) - used))} {ingredient.unit}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <button type="button" onClick={addRow}
          className="min-h-[44px] rounded-xl border-2 border-dashed border-orange-300 text-orange-600 text-sm font-bold">
          + เพิ่มวัตถุดิบ
        </button>

        {overStock.length > 0 && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 leading-relaxed">
            สูตรนี้ใช้ {overStock.map((r) => `${r.ingredient_name} ${trim(r.need)} ${r.unit} (มี ${trim(r.have)})`).join(', ')}
            <span className="block mt-0.5">
              มากกว่าที่ระบบจำไว้ — บันทึกได้ปกติ แต่ควรไปแก้สต็อกให้ตรงของจริง (กดที่หน่วยของบรรทัดนั้น)
            </span>
          </p>
        )}

        {missing.length > 0 && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            {missing.map((l) => l.ingredient_name).join(', ')} ยังไม่เคยบันทึกราคาซื้อ
            ต้นทุนหม้อนี้จะต่ำกว่าความจริง — ไปบันทึกซื้อในหน้าค่าใช้จ่ายก่อน
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">ได้กี่ {sauce?.unit ?? 'กก.'}</span>
            <input type="number" inputMode="decimal" step="any" min="0" value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)} placeholder="2"
              className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm text-right font-bold focus:outline-none focus:border-orange-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">หม้อนี้ใช้ได้กี่ชิ้น</span>
            <input type="number" inputMode="numeric" min="1" value={serves}
              onChange={(e) => setServes(e.target.value)} placeholder="300"
              className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm text-right font-bold focus:outline-none focus:border-orange-500" />
          </label>
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">
          &quot;ใช้ได้กี่ชิ้น&quot; คือหม้อนี้ราดได้กี่ไม้กี่ถุง เป็นตัวหารที่ทำให้รู้ต้นทุนน้ำจิ้มต่อชิ้น
        </p>

        <div className="rounded-xl bg-orange-50 border-2 border-orange-200 px-4 py-3">
          <p className="text-2xl font-black text-orange-600">{totals.totalCost.toFixed(2)} ฿ / หม้อ</p>
          <p className="text-xs text-gray-600 mt-0.5">
            {totals.yieldQty > 0 && `ได้ ${totals.yieldQty} ${sauce?.unit ?? 'กก.'} (${totals.costPerYield.toFixed(2)} ฿/${sauce?.unit ?? 'กก.'})`}
            {totals.serves > 0 && ` · ใช้ได้ ${totals.serves} ชิ้น → `}
            {totals.serves > 0 && <b className="text-orange-700">{totals.costPerServe.toFixed(2)} ฿ ต่อชิ้น</b>}
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">บันทึกช่วยจำ</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น พริกแพง ใส่น้อยลง"
            className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-500" />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 flex gap-2">
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="flex-1 min-h-[52px] rounded-xl bg-gray-100 text-gray-600 font-bold disabled:opacity-40">
          ยกเลิก
        </button>
        <button type="button" onClick={handleSubmit} disabled={!isValid || saving}
          className="flex-[2] min-h-[52px] rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold disabled:opacity-40">
          {saving ? 'กำลังบันทึก...' : 'บันทึก + ตัดสต็อก'}
        </button>
      </div>

      {editIngredient && (
        <IngredientModal ingredient={editIngredient} onClose={() => setEditIngredient(null)} />
      )}
    </ModalBackdrop>
  )
}

/** ตัดศูนย์ท้ายทศนิยมทิ้ง — 0.10 ขวดอ่านยากกว่า 0.1 ขวด และ 2.00 กก. ก็ควรเป็น 2 กก. */
function trim(value) {
  return Number(Number(value).toFixed(3)).toString()
}

export default SauceBatchModal
