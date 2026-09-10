import { useState } from 'react'
import {
  COMMON_UNITS,
  CONTENT_UNITS,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_ICONS,
  setIngredientStock,
  updateIngredient,
} from '../lib/ingredients'
import ModalBackdrop from './ModalBackdrop'
import { fromReorderValue, toReorderPayload } from '../lib/reorder'
import ReorderField from './ReorderField'

/**
 * แก้ทะเบียนวัตถุดิบ 1 รายการ
 *
 * หน่วยนับสำคัญกว่าที่คิด เพราะทุกอย่างผูกกับมัน — ราคาต่อหน่วย ปริมาณในสูตรน้ำจิ้ม
 * และสต็อกคงเหลือ ตั้งพลาดตั้งแต่ตอนสร้าง (เช่นพริกเป็น "ขีด" ทั้งที่ซื้อเป็นกิโล)
 * แล้วแก้ไม่ได้ ต้นทุนจะเพี้ยนไปสิบเท่าโดยหาสาเหตุไม่เจอ
 *
 * เปลี่ยนหน่วยแล้วราคาล่าสุดกับสต็อกยังเป็นตัวเลขเดิม เพราะระบบไม่รู้ว่าของจริงคือเท่าไหร่
 * จึงเตือนให้แก้ทั้งสองอย่างเองในหน้าเดียวกันนี้
 */
function IngredientModal({ ingredient, onClose }) {
  const [name, setName] = useState(ingredient?.name ?? '')
  const [unit, setUnit] = useState(ingredient?.unit ?? 'ชิ้น')
  const [category, setCategory] = useState(ingredient?.category ?? 'other')
  const [stock, setStock] = useState(String(ingredient?.stock_qty ?? 0))
  const [contentQty, setContentQty] = useState(
    ingredient?.content_qty != null ? String(ingredient.content_qty) : '',
  )
  const [contentUnit, setContentUnit] = useState(ingredient?.content_unit ?? '')
  const [reorder, setReorder] = useState(() => fromReorderValue(ingredient))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const originalUnit = ingredient?.unit ?? 'ชิ้น'
  const unitChanged = unit.trim() !== originalUnit
  const lastPrice = Number(ingredient?.last_price) || 0

  const isValid = name.trim() !== '' && unit.trim() !== ''
  const canClose = !saving

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const qty = Number(contentQty) || 0
      const hasContent = qty > 0 && contentUnit.trim() !== ''
      const draft = {
        ...ingredient,
        unit: unit.trim(),
        content_qty: hasContent ? qty : null,
        content_unit: hasContent ? contentUnit.trim() : null,
      }
      await updateIngredient(ingredient.id, {
        name: name.trim(),
        unit: unit.trim(),
        category,
        content_qty: hasContent ? qty : null,
        content_unit: hasContent ? contentUnit.trim() : null,
        ...toReorderPayload(draft, reorder.qty, reorder.unit),
      })
      await setIngredientStock(ingredient.id, Number(stock) || 0)
      onClose()
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 shrink-0">
        <h2 className="text-base font-bold text-white">แก้ไขวัตถุดิบ</h2>
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="w-10 h-10 shrink-0 rounded-full bg-white/20 text-white text-xl flex items-center justify-center disabled:opacity-40"
          aria-label="ปิด">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">ชื่อวัตถุดิบ</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-500" />
        </label>

        <div>
          <span className="text-xs font-medium text-gray-500">หน่วยนับ</span>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
            placeholder="กก. ขีด กำ ขวด"
            aria-label="หน่วยนับ"
            className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-orange-300 bg-orange-50 px-3 text-sm font-bold focus:outline-none focus:border-orange-500" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMMON_UNITS.map((u) => (
              <button key={u} type="button" onClick={() => setUnit(u)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  unit === u ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {unitChanged && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 leading-relaxed">
            เปลี่ยนหน่วยจาก &ldquo;{originalUnit}&rdquo; เป็น &ldquo;{unit.trim()}&rdquo;
            {lastPrice > 0 && (
              <> — ราคาล่าสุดยังเป็น {lastPrice.toFixed(2)} ฿ ต่อ 1 {originalUnit} อยู่</>
            )}
            <span className="block mt-1">
              ระบบไม่รู้ว่าของจริงคือเท่าไหร่ในหน่วยใหม่ ให้แก้สต็อกด้านล่างให้ตรง
              แล้วบันทึกซื้อครั้งถัดไปด้วยหน่วยใหม่ ราคาต่อหน่วยจะถูกต้องเอง
            </span>
          </p>
        )}

        <div>
          <span className="text-xs font-medium text-gray-500">หมวดหมู่</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {Object.entries(INGREDIENT_CATEGORIES).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setCategory(key)}
                className={`min-h-[48px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  category === key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 bg-white'
                }`}>
                <span className="text-base">{INGREDIENT_CATEGORY_ICONS[key]}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500">
            1 {unit.trim() || 'หน่วย'} มีปริมาณเท่าไหร่ <span className="text-gray-300">(ไม่ใส่ก็ได้)</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2 leading-relaxed">
            ใส่ไว้แล้วตอนทำน้ำจิ้มจะกรอกเป็นหน่วยย่อยได้เลย เช่นน้ำปลาขวดละ 700 มล.
            ตวงไป 70 มล. ระบบตัดสต็อกให้ 0.1 ขวด และคิดเงินตามนั้น
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">1 {unit.trim() || 'หน่วย'} =</span>
            <input
              type="number" inputMode="decimal" step="any" min="0"
              value={contentQty}
              onChange={(e) => setContentQty(e.target.value)}
              placeholder="700"
              aria-label="ปริมาณต่อหน่วย"
              className="w-24 min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm text-right font-bold focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              value={contentUnit}
              onChange={(e) => setContentUnit(e.target.value)}
              placeholder="มล."
              aria-label="หน่วยย่อย"
              className="flex-1 min-w-0 min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_UNITS.map((u) => (
              <button key={u} type="button" onClick={() => setContentUnit(u)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  contentUnit === u ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                {u}
              </button>
            ))}
            {contentUnit !== '' && (
              <button type="button" onClick={() => { setContentUnit(''); setContentQty('') }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-400">
                ไม่ใช้
              </button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">
            สต็อกคงเหลือ ({unit.trim() || 'หน่วย'})
          </span>
          <input type="number" inputMode="decimal" step="any" min="0" value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="mt-1 w-full min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm text-right font-bold focus:outline-none focus:border-orange-500" />
          <span className="text-[11px] text-gray-400">
            ใส่จำนวนที่นับได้จริง ไม่ใช่จำนวนที่ต้องบวกลบ — ซื้อเพิ่มกับทำน้ำจิ้มระบบขยับให้เอง
          </span>
        </label>

        <ReorderField
          ingredient={{
            unit: unit.trim(),
            content_qty: Number(contentQty) || 0,
            content_unit: contentUnit.trim(),
          }}
          qty={reorder.qty}
          unit={reorder.unit}
          onChange={(qty, u) => setReorder({ qty, unit: u })}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 flex gap-2">
        <button type="button" onClick={() => canClose && onClose()} disabled={!canClose}
          className="flex-1 min-h-[52px] rounded-xl bg-gray-100 text-gray-600 font-bold disabled:opacity-40">
          ยกเลิก
        </button>
        <button type="button" onClick={handleSubmit} disabled={!isValid || saving}
          className="flex-[2] min-h-[52px] rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold disabled:opacity-40">
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default IngredientModal
