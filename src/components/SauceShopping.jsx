import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { trim } from '../lib/format'
import { toDateString } from '../lib/dates'
import { recordPurchases } from '../lib/ingredients'
import { shoppingSuggestions } from '../lib/sauceStock'
import {
  clearList,
  listTotal,
  loadList,
  newItem,
  priceChange,
  readyItems,
  saveList,
  unitPriceOf,
} from '../lib/shoppingList'

/**
 * ซื้อของ — สามจอต่อเนื่องกันในแท็บเดียว
 *
 * เตรียมรายการที่ร้าน → ติ๊กและกรอกราคาในตลาด → ตรวจแล้วบันทึกเข้าคลัง
 *
 * ทั้งหมดทำงานในเครื่องล้วน แตะฐานข้อมูลครั้งเดียวตอนกดบันทึกเข้าคลัง
 * เพราะตลาดสดสัญญาณไม่ดี และระบบเขียนฐานข้อมูลตอนออฟไลน์ไม่ได้
 */

const STEPS = [
  { key: 'plan', label: '1 เตรียมรายการ' },
  { key: 'shop', label: '2 กำลังซื้อ' },
  { key: 'review', label: '3 ตรวจแล้วบันทึก' },
]

function SauceShopping({ onEditIngredient }) {
  const { sauces, ingredientById, activeIngredients, online } = useAppData()
  const [items, setItems] = useState(() => loadList())
  const [step, setStep] = useState(() => (loadList().length > 0 ? 'shop' : 'plan'))
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => saveList(items), [items])

  const suggestions = useMemo(
    () => shoppingSuggestions(sauces, ingredientById),
    [sauces, ingredientById],
  )

  const inList = useMemo(() => new Set(items.map((i) => i.ingredient_id).filter(Boolean)), [items])
  const ready = readyItems(items)
  const total = listTotal(items)

  const addFromSuggestion = (row) =>
    setItems((prev) => [
      ...prev,
      newItem({
        ingredient_id: row.ingredient_id,
        name: row.name,
        unit: row.unit,
        category: row.category,
        plan_qty: row.suggestQty,
        lastPrice: row.lastPrice,
      }),
    ])

  const addIngredient = (ingredient) =>
    setItems((prev) => [
      ...prev,
      newItem({
        ingredient_id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category,
        plan_qty: 0,
        lastPrice: Number(ingredient.last_price) || 0,
      }),
    ])

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key))
  const updateItem = (key, patch) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const handleSave = async () => {
    if (ready.length === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      const count = await recordPurchases(
        ready.map((i) => ({
          ingredientId: i.ingredient_id,
          ingredientName: i.name,
          category: i.category,
          unit: i.unit,
          qty: Number(i.qty),
          totalAmount: Number(i.amount),
        })),
        { date: toDateString() },
      )
      setSaved({ count, total })
      setItems([])
      clearList()
      setStep('plan')
    } catch {
      setError('บันทึกไม่สำเร็จ ของยังอยู่ในรายการครบ ตรวจสัญญาณแล้วกดใหม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {STEPS.map((s) => (
          <button key={s.key} type="button" onClick={() => setStep(s.key)}
            className={`flex-1 min-h-[38px] rounded-xl text-[11px] font-bold transition-colors ${
              step === s.key ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {saved && (
        <p className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
          ✓ บันทึกเข้าคลังแล้ว {saved.count} รายการ · {saved.total.toLocaleString()} ฿
          <span className="block text-[11px] mt-0.5">
            สต็อกเพิ่มแล้ว ราคาล่าสุดอัปเดตแล้ว และรายการนี้ไปโผล่ในหน้าค่าใช้จ่ายด้วย
          </span>
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</p>}

      {step === 'plan' && (
        <PlanStep
          suggestions={suggestions}
          inList={inList}
          items={items}
          onAdd={addFromSuggestion}
          onRemove={removeItem}
          onUpdate={updateItem}
          onEditIngredient={onEditIngredient}
          addOpen={addOpen}
          setAddOpen={setAddOpen}
          activeIngredients={activeIngredients}
          onAddIngredient={addIngredient}
          onGoShop={() => setStep('shop')}
        />
      )}

      {step === 'shop' && (
        <ShopStep items={items} total={total} onUpdate={updateItem} onRemove={removeItem}
          onDone={() => setStep('review')} />
      )}

      {step === 'review' && (
        <ReviewStep items={items} ready={ready} total={total} ingredientById={ingredientById}
          online={online} saving={saving} onRemove={removeItem}
          onBack={() => setStep('shop')} onSave={handleSave} />
      )}
    </div>
  )
}

// ─── จอที่ 1 · เตรียมรายการ ───────────────────────────────────

function PlanStep({
  suggestions, inList, items, onAdd, onRemove, onUpdate, onEditIngredient,
  addOpen, setAddOpen, activeIngredients, onAddIngredient, onGoShop,
}) {
  const notInList = activeIngredients.filter((i) => !inList.has(i.id))

  return (
    <>
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          ระบบแนะนำจากสูตรน้ำจิ้ม
        </p>
        {suggestions.length === 0 && (
          <p className="px-4 pb-3 text-xs text-gray-400">
            ยังไม่มีสูตรน้ำจิ้มที่บันทึกไว้ — ทำน้ำจิ้มสักหม้อก่อน ระบบถึงจะรู้ว่าต้องซื้ออะไร
          </p>
        )}
        {suggestions.map((row) => (
          <div key={row.ingredient_id} className="px-4 py-2 border-t border-gray-50 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{row.name}</p>
              <p className="text-[11px] text-gray-400">
                {row.tracked
                  ? `เหลือ ${trim(row.have)} ${row.unit} · ทำได้อีก ${row.pots} หม้อ`
                  : 'ยังไม่ได้นับสต็อก'}
                {row.usedBy.length > 1 && ` · ใช้ ${row.usedBy.length} สูตร`}
              </p>
            </div>
            {inList.has(row.ingredient_id) ? (
              <span className="text-[11px] font-bold text-green-600 shrink-0">อยู่ในรายการแล้ว</span>
            ) : (
              <button type="button" onClick={() => onAdd(row)}
                className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold ${
                  row.suggestQty > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
                }`}>
                {row.suggestQty > 0 ? `+ ซื้อ ${trim(row.suggestQty)} ${row.unit}` : '+ ซื้อเผื่อ'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            รายการที่จะซื้อ ({items.length})
          </p>
          <button type="button" onClick={() => setAddOpen(!addOpen)}
            className="text-[11px] font-bold text-orange-600">
            {addOpen ? 'ปิด' : '+ เพิ่มของอื่น'}
          </button>
        </div>

        {addOpen && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {notInList.length === 0 && <p className="text-[11px] text-gray-400">อยู่ในรายการครบแล้ว</p>}
            {notInList.map((i) => (
              <button key={i.id} type="button" onClick={() => onAddIngredient(i)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold">
                {i.name}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <p className="px-4 pb-3 text-xs text-gray-400">ยังไม่มีอะไรในรายการ กดปุ่ม &quot;+ ซื้อ&quot; ด้านบน</p>
        )}

        {items.map((item) => (
          <div key={item.key} className="px-4 py-2 border-t border-gray-50 flex items-center gap-2">
            <button type="button" onClick={() => onEditIngredient?.(item.ingredient_id)}
              className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
              {item.lastPrice > 0 && (
                <p className="text-[11px] text-gray-400">ครั้งก่อน {item.lastPrice.toFixed(2)} ฿/{item.unit}</p>
              )}
            </button>
            <input type="number" inputMode="decimal" step="any" min="0"
              value={item.plan_qty === 0 ? '' : item.plan_qty}
              onChange={(e) => onUpdate(item.key, { plan_qty: Number(e.target.value) || 0 })}
              placeholder="0"
              aria-label={`จะซื้อ${item.name}กี่${item.unit}`}
              className="w-16 shrink-0 min-h-[40px] rounded-lg border-2 border-gray-200 px-2 text-sm text-right font-bold focus:outline-none focus:border-orange-500" />
            <span className="w-9 shrink-0 text-[11px] text-gray-400 truncate">{item.unit}</span>
            <button type="button" onClick={() => onRemove(item.key)}
              className="w-8 h-8 shrink-0 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center"
              aria-label={`เอา${item.name}ออก`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <button type="button" onClick={onGoShop}
          className="min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold flex items-center justify-center gap-2">
          <ShoppingCart size={18} /> ไปตลาด ({items.length} รายการ)
        </button>
      )}
    </>
  )
}

// ─── จอที่ 2 · กำลังซื้อ ───────────────────────────────────────

function ShopStep({ items, total, onUpdate, onRemove, onDone }) {
  const boughtCount = items.filter((i) => i.bought).length

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-8 text-center">
        <p className="text-3xl mb-2">🛒</p>
        <p className="text-sm font-bold text-gray-600">ยังไม่มีรายการ</p>
        <p className="text-xs text-gray-400 mt-1">กลับไปขั้นที่ 1 เพื่อเตรียมรายการก่อน</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">ซื้อแล้ว {boughtCount}/{items.length} รายการ</p>
        <p className="text-lg font-black text-orange-600 tabular-nums">{total.toLocaleString()} ฿</p>
      </div>

      <p className="text-[11px] text-gray-400 px-1 -mt-1">
        ติ๊กตอนซื้อได้แล้ว กรอกจำนวนกับเงินที่จ่ายจริง — เก็บไว้ในเครื่อง เน็ตหลุดก็ไม่หาย
      </p>

      {items.map((item) => {
        const change = priceChange(item)
        return (
          <div key={item.key}
            className={`rounded-2xl border-2 p-3 flex flex-col gap-2 ${
              item.bought ? 'bg-white border-green-300' : 'bg-white border-gray-200'
            }`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onUpdate(item.key, { bought: !item.bought })}
                aria-label={item.bought ? `ยกเลิกซื้อ${item.name}` : `ซื้อ${item.name}แล้ว`}
                className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                  item.bought ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-300'
                }`}>
                <Check size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-gray-800 truncate">{item.name}</p>
                <p className="text-[11px] text-gray-400">
                  {item.plan_qty > 0 && `ตั้งใจซื้อ ${trim(item.plan_qty)} ${item.unit}`}
                  {item.lastPrice > 0 && ` · ครั้งก่อน ${item.lastPrice.toFixed(2)} ฿/${item.unit}`}
                </p>
              </div>
              <button type="button" onClick={() => onRemove(item.key)}
                className="w-8 h-8 shrink-0 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center"
                aria-label={`เอา${item.name}ออก`}>
                <Trash2 size={14} />
              </button>
            </div>

            {item.bought && (
              <>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" step="any" min="0" value={item.qty}
                    onChange={(e) => onUpdate(item.key, { qty: e.target.value })}
                    placeholder="จำนวน" autoFocus
                    aria-label={`ได้${item.name}กี่${item.unit}`}
                    className="flex-1 min-w-0 min-h-[52px] rounded-xl border-2 border-orange-300 bg-orange-50 px-3 text-base text-right font-bold focus:outline-none focus:border-orange-500" />
                  <span className="w-10 shrink-0 text-xs text-gray-500 truncate">{item.unit}</span>
                  <input type="number" inputMode="decimal" step="any" min="0" value={item.amount}
                    onChange={(e) => onUpdate(item.key, { amount: e.target.value })}
                    placeholder="จ่ายกี่บาท"
                    aria-label={`จ่ายค่า${item.name}กี่บาท`}
                    className="flex-1 min-w-0 min-h-[52px] rounded-xl border-2 border-orange-300 bg-orange-50 px-3 text-base text-right font-bold focus:outline-none focus:border-orange-500" />
                  <span className="w-5 shrink-0 text-xs text-gray-500">฿</span>
                </div>

                {change && (
                  <p className={`text-[11px] font-bold ${
                    change.suspicious ? 'text-red-600' : change.percent > 0 ? 'text-amber-700' : 'text-green-700'
                  }`}>
                    {change.now.toFixed(2)} ฿/{item.unit} · ครั้งก่อน {change.before.toFixed(2)}
                    {' '}{change.percent >= 0 ? '🔺' : '🔻'} {Math.abs(Math.round(change.percent))}%
                    {change.suspicious && ' ⚠️ ต่างจากเดิมมาก ตรวจเลขอีกที'}
                  </p>
                )}
              </>
            )}
          </div>
        )
      })}

      <button type="button" onClick={onDone}
        className="min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold">
        ตรวจก่อนบันทึก
      </button>
    </>
  )
}

// ─── จอที่ 3 · ตรวจแล้วบันทึก ─────────────────────────────────

function ReviewStep({ items, ready, total, ingredientById, online, saving, onRemove, onBack, onSave }) {
  const notReady = items.filter((i) => !ready.includes(i))

  return (
    <>
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          จะบันทึกเข้าคลัง · {toDateString()}
        </p>

        {ready.length === 0 && (
          <p className="px-4 pb-3 text-xs text-gray-400">
            ยังไม่มีรายการที่กรอกครบ ต้องติ๊กว่าซื้อแล้วและใส่ทั้งจำนวนกับเงินที่จ่าย
          </p>
        )}

        {ready.map((item) => {
          const have = Number(ingredientById.get(item.ingredient_id)?.stock_qty) || 0
          const qty = Number(item.qty)
          return (
            <div key={item.key} className="px-4 py-2.5 border-t border-gray-50 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">
                  {item.name} <span className="text-gray-400 font-medium">{trim(qty)} {item.unit}</span>
                </p>
                <p className="text-[11px] text-gray-400">
                  {unitPriceOf(item).toFixed(2)} ฿/{item.unit} · สต็อก {trim(have)} → {trim(have + qty)} {item.unit}
                </p>
              </div>
              <span className="text-sm font-extrabold text-gray-800 tabular-nums shrink-0">
                {Number(item.amount).toLocaleString()} ฿
              </span>
              <button type="button" onClick={() => onRemove(item.key)}
                className="w-7 h-7 shrink-0 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center"
                aria-label={`เอา${item.name}ออก`}>
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}

        {ready.length > 0 && (
          <div className="px-4 py-2.5 border-t-2 border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-600">รวม {ready.length} รายการ</span>
            <span className="text-lg font-black text-orange-600 tabular-nums">{total.toLocaleString()} ฿</span>
          </div>
        )}
      </div>

      {notReady.length > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
          อีก {notReady.length} รายการยังไม่ได้ซื้อหรือกรอกไม่ครบ ({notReady.map((i) => i.name).join(', ')})
          จะไม่ถูกบันทึก แต่ยังค้างอยู่ในรายการให้ซื้อรอบหน้า
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} disabled={saving}
          className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-600 font-bold disabled:opacity-40">
          กลับไปแก้
        </button>
        <button type="button" onClick={onSave} disabled={ready.length === 0 || saving || !online}
          className="flex-[2] min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          <Plus size={18} />
          {!online ? 'ออฟไลน์ — รอสัญญาณก่อน' : saving ? 'กำลังบันทึก...' : 'บันทึกเข้าคลัง'}
        </button>
      </div>

      {!online && (
        <p className="text-[11px] text-gray-400 px-1">
          รายการเก็บไว้ในเครื่องแล้ว ไม่หาย กลับถึงร้านมีสัญญาณค่อยกดบันทึกได้
        </p>
      )}
    </>
  )
}

export default SauceShopping
