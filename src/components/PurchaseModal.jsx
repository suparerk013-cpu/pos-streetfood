import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  COMMON_UNITS,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_ICONS,
} from '../lib/ingredientCategories'
import { addIngredient, recordPurchase } from '../lib/ingredients'
import { toDateString } from '../lib/dates'
import ModalBackdrop from './ModalBackdrop'

/**
 * บันทึกการซื้อวัตถุดิบ 1 ครั้ง
 *
 * ออกแบบให้กรอกเร็วที่สุด เพราะเจ้าของร้านจะกรอกวันละหลายรายการหลังกลับจากตลาด:
 * ปุ่มลัดของที่ซื้อบ่อย, กรอกยอดรวมแล้วระบบหารราคาต่อหน่วยให้เอง,
 * และปุ่ม "ซื้อซ้ำครั้งก่อน" ที่เติมจำนวนกับราคาเดิมให้ทันที
 */
function PurchaseModal({ ingredients, recentByIngredient, defaultDate, onClose, onSaved }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateString())
  const [qty, setQty] = useState('')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // สร้างวัตถุดิบใหม่
  const [creatingName, setCreatingName] = useState(null)
  const [newUnit, setNewUnit] = useState('กก.')
  const [newCategory, setNewCategory] = useState('fresh')

  const frequent = useMemo(() => {
    return [...ingredients]
      .filter((i) => recentByIngredient?.has(i.id))
      .sort((a, b) => (recentByIngredient.get(b.id)?.times ?? 0) - (recentByIngredient.get(a.id)?.times ?? 0))
      .slice(0, 6)
  }, [ingredients, recentByIngredient])

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return ingredients.filter((i) => i.name.toLowerCase().includes(term)).slice(0, 8)
  }, [ingredients, search])

  const exactMatch = useMemo(
    () => ingredients.some((i) => i.name.trim().toLowerCase() === search.trim().toLowerCase()),
    [ingredients, search],
  )

  const qtyNum = Number(qty) || 0
  const amountNum = Number(amount) || 0
  const unitPrice = qtyNum > 0 ? amountNum / qtyNum : 0
  const lastPrice = selected?.last_price ?? null

  const priceHint = (() => {
    if (!selected || unitPrice <= 0) return null
    if (lastPrice == null || lastPrice <= 0) return `= ${unitPrice.toFixed(2)} ฿/${selected.unit}`
    const change = ((unitPrice - lastPrice) / lastPrice) * 100
    if (Math.abs(change) < 1) return `= ${unitPrice.toFixed(2)} ฿/${selected.unit} · เท่าครั้งก่อน`
    const arrow = change > 0 ? '↑ แพงขึ้น' : '↓ ถูกลง'
    return `= ${unitPrice.toFixed(2)} ฿/${selected.unit} · ${arrow} ${Math.abs(change).toFixed(0)}% (ครั้งก่อน ${lastPrice.toFixed(2)})`
  })()

  const priceHintTone = (() => {
    if (!selected || unitPrice <= 0 || lastPrice == null || lastPrice <= 0) return 'text-gray-400'
    const change = ((unitPrice - lastPrice) / lastPrice) * 100
    if (Math.abs(change) < 1) return 'text-gray-400'
    return change > 0 ? 'text-red-500' : 'text-green-600'
  })()

  const handlePickIngredient = (ingredient) => {
    setSelected(ingredient)
    setSearch('')
    setCreatingName(null)
    setError(null)
  }

  const handleCreate = async () => {
    const name = creatingName?.trim()
    if (!name) return
    setSaving(true)
    try {
      const id = await addIngredient({ name, unit: newUnit, category: newCategory })
      setSelected({ id, name, unit: newUnit, category: newCategory, last_price: null })
      setCreatingName(null)
      setSearch('')
    } catch {
      setError('เพิ่มวัตถุดิบไม่สำเร็จ ลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const handleRepeatLast = () => {
    const last = recentByIngredient?.get(selected?.id)?.last
    if (!last) return
    setQty(String(last.qty))
    setAmount(String(last.total_amount))
  }

  const canSave = selected && qtyNum > 0 && amountNum > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await recordPurchase({
        ingredientId: selected.id,
        ingredientName: selected.name,
        category: selected.category ?? 'other',
        unit: selected.unit ?? 'ชิ้น',
        qty: qtyNum,
        totalAmount: amountNum,
        date,
        vendor,
        note,
      })
      onSaved?.()
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่')
      setSaving(false)
    }
  }

  const lastPurchase = recentByIngredient?.get(selected?.id)?.last

  return (
    <ModalBackdrop onClose={onClose} canClose={!saving} maxWidthClass="max-w-md">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 flex items-center justify-between">
          <h2 className="font-extrabold text-white text-lg">บันทึกการซื้อ</h2>
          <button type="button" onClick={onClose} disabled={saving}
            className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-40"
            aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* ── เลือกวัตถุดิบ ── */}
          {!selected && (
            <>
              {frequent.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ซื้อบ่อย</p>
                  <div className="grid grid-cols-3 gap-2">
                    {frequent.map((i) => (
                      <button key={i.id} type="button" onClick={() => handlePickIngredient(i)}
                        className="rounded-2xl border-2 border-orange-100 bg-orange-50 px-2 py-2.5 text-center active:scale-95 transition-all">
                        <span className="block text-lg leading-none mb-1">
                          {INGREDIENT_CATEGORY_ICONS[i.category] ?? '📝'}
                        </span>
                        <span className="block text-xs font-bold text-gray-700 truncate">{i.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ค้นหาวัตถุดิบ</p>
                <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3.5 py-2.5">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อ เช่น ผักชี..."
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                  />
                </div>

                {matches.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {matches.map((i) => (
                      <button key={i.id} type="button" onClick={() => handlePickIngredient(i)}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5 active:bg-orange-50 transition-colors text-left">
                        <span className="text-sm font-semibold text-gray-700">
                          {INGREDIENT_CATEGORY_ICONS[i.category] ?? '📝'} {i.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {i.last_price ? `${i.last_price.toFixed(2)} ฿/${i.unit}` : i.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {search.trim() && !exactMatch && creatingName === null && (
                  <button type="button" onClick={() => setCreatingName(search.trim())}
                    className="mt-2 w-full rounded-xl border-2 border-dashed border-orange-300 text-orange-600 font-bold text-sm py-2.5 active:scale-95 transition-transform">
                    + เพิ่ม “{search.trim()}” เป็นวัตถุดิบใหม่
                  </button>
                )}
              </div>

              {/* ฟอร์มสร้างวัตถุดิบใหม่ */}
              {creatingName !== null && (
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 flex flex-col gap-3">
                  <p className="font-bold text-gray-800">วัตถุดิบใหม่: {creatingName}</p>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">หน่วยนับ</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_UNITS.map((u) => (
                        <button key={u} type="button" onClick={() => setNewUnit(u)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                            newUnit === u ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
                          }`}>
                          {u}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      หน่วยจะล็อกไว้กับวัตถุดิบนี้ตลอด เพื่อให้รวมปริมาณรายเดือนได้
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">หมวด</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(INGREDIENT_CATEGORIES).map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setNewCategory(key)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                            newCategory === key ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
                          }`}>
                          {INGREDIENT_CATEGORY_ICONS[key]} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCreatingName(null)}
                      className="flex-1 min-h-[48px] rounded-2xl bg-white border border-gray-200 text-gray-500 font-bold text-sm">
                      ยกเลิก
                    </button>
                    <button type="button" onClick={handleCreate} disabled={saving}
                      className="flex-[2] min-h-[48px] rounded-2xl bg-orange-500 disabled:bg-gray-300 text-white font-bold">
                      {saving ? 'กำลังเพิ่ม...' : 'เพิ่มแล้วบันทึกการซื้อ'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── กรอกรายละเอียดการซื้อ ── */}
          {selected && (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-gray-800 text-lg leading-tight truncate">
                    {INGREDIENT_CATEGORY_ICONS[selected.category] ?? '📝'} {selected.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    หน่วย: {selected.unit}
                    {lastPrice ? ` · ครั้งก่อน ${lastPrice.toFixed(2)} ฿/${selected.unit}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)}
                  className="shrink-0 text-xs font-bold text-orange-600 bg-white rounded-xl px-3 py-1.5 border border-orange-200">
                  เปลี่ยน
                </button>
              </div>

              <div>
                <label htmlFor="purchase-date" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  วันที่ซื้อ
                </label>
                <input
                  id="purchase-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 font-semibold focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-qty" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    จำนวน ({selected.unit})
                  </label>
                  <input
                    id="purchase-qty"
                    type="number" inputMode="decimal" step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-2xl font-extrabold text-gray-800 text-center focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-amount" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    ราคารวม (฿)
                  </label>
                  <input
                    id="purchase-amount"
                    type="number" inputMode="decimal" step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-2xl font-extrabold text-gray-800 text-center focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {priceHint && (
                <p className={`text-center text-sm font-semibold ${priceHintTone}`}>{priceHint}</p>
              )}

              <div>
                <label htmlFor="purchase-vendor" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  ร้านที่ซื้อ (ไม่บังคับ)
                </label>
                <input
                  id="purchase-vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="เช่น ตลาดสี่มุมเมือง"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-orange-400 transition-all"
                />
              </div>

              <div>
                <label htmlFor="purchase-note" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  id="purchase-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น ของสดมาก"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-orange-400 transition-all"
                />
              </div>

              {error && (
                <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 text-center">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                {lastPurchase && (
                  <button type="button" onClick={handleRepeatLast}
                    className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all">
                    ⟳ ซื้อซ้ำครั้งก่อน
                    <span className="block text-[10px] font-normal text-gray-400">
                      {lastPurchase.qty} {selected.unit} · {lastPurchase.total_amount.toLocaleString()} ฿
                    </span>
                  </button>
                )}
                <button type="button" onClick={handleSave} disabled={!canSave}
                  className="flex-[2] min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Check size={20} />
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default PurchaseModal
