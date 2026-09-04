import { ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react'
import { ShareBar } from '../components/Charts'
import { useMemo, useState } from 'react'
import ExpenseModal from '../components/ExpenseModal'
import PurchaseModal from '../components/PurchaseModal'
import { useAppData } from '../lib/appDataContext'
import {
  formatThaiDate,
  formatThaiMonth,
  getMonthRange,
  getPresetRange,
  getPreviousRange,
  toDateString,
} from '../lib/dates'
import {
  createExpense,
  deleteExpense,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ICONS,
  expenseCategoryLabel,
} from '../lib/expenses'
import { exportIngredientWorkbook, summarizePurchases } from '../lib/excelExport'
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_BAR_COLORS as CATEGORY_BAR_COLORS,
  INGREDIENT_CATEGORY_ICONS,
} from '../lib/ingredientCategories'
import { deletePurchase, seedStarterIngredients } from '../lib/ingredients'
import { useExpensesInRange, usePurchasesInRange } from '../lib/usePurchases'
import { useOrdersInRange } from '../lib/useOrders'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'month', label: 'รายเดือน' },
]

function IngredientRow({ entry, purchases, expanded, onToggle, onDeletePurchase }) {
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 active:bg-gray-50 transition-colors text-left"
      >
        <div className="min-w-0 flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5 shrink-0">
            {INGREDIENT_CATEGORY_ICONS[entry.category] ?? '📝'}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-gray-800 text-sm leading-tight truncate">{entry.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {entry.times} ครั้ง · {entry.qty.toLocaleString()} {entry.unit} · เฉลี่ย{' '}
              {entry.avgPrice.toFixed(2)} ฿/{entry.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-extrabold text-gray-800 tabular-nums text-sm">
            {Math.round(entry.total).toLocaleString()} ฿
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 -mt-1">
          <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
            {purchases.map((p, index) => {
              const prev = purchases[index + 1]
              const change = prev?.unit_price > 0
                ? ((p.unit_price - prev.unit_price) / prev.unit_price) * 100
                : 0
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {formatThaiDate(p.date)}
                      <span className="font-normal text-gray-400 ml-2">
                        {p.qty} {p.unit} × {p.unit_price.toFixed(2)} ฿
                      </span>
                    </p>
                    {(p.vendor || p.note) && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {[p.vendor, p.note].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {Math.abs(change) >= 10 && (
                      <span className={`text-[10px] font-bold ${change > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {change > 0 ? '↑แพงขึ้น' : '↓ถูกลง'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-gray-700 tabular-nums">
                      {p.total_amount.toLocaleString()} ฿
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeletePurchase(p.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      aria-label="ลบรายการนี้"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ExpensesPage() {
  const { activeIngredients, ingredientsLoading, shopName, online } = useAppData()

  const [tab, setTab] = useState('ingredients')
  const [rangePreset, setRangePreset] = useState('month')
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [expandedId, setExpandedId] = useState(null)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const { from, to } =
    rangePreset === 'month' ? getMonthRange(monthCursor) : getPresetRange(rangePreset)
  const prevRange = getPreviousRange(from, to)

  const { purchases, loading: purchasesLoading } = usePurchasesInRange(from, to)
  const { purchases: prevPurchases } = usePurchasesInRange(prevRange.from, prevRange.to)
  const { expenses } = useExpensesInRange(from, to)
  const { orders } = useOrdersInRange(from, to)

  const totalSales = useMemo(
    () => orders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
    [orders],
  )

  const summary = useMemo(() => summarizePurchases(purchases), [purchases])
  const ingredientTotal = useMemo(
    () => purchases.reduce((s, p) => s + (p.total_amount ?? 0), 0),
    [purchases],
  )
  const prevIngredientTotal = useMemo(
    () => prevPurchases.reduce((s, p) => s + (p.total_amount ?? 0), 0),
    [prevPurchases],
  )
  const ingredientChange = prevIngredientTotal > 0
    ? Math.round(((ingredientTotal - prevIngredientTotal) / prevIngredientTotal) * 100)
    : null

  const categoryTotals = useMemo(() => {
    const totals = {}
    purchases.forEach((p) => {
      const key = p.category ?? 'other'
      totals[key] = (totals[key] ?? 0) + (p.total_amount ?? 0)
    })
    return totals
  }, [purchases])

  const purchasesByIngredient = useMemo(() => {
    const map = new Map()
    purchases.forEach((p) => {
      const key = p.ingredient_id ?? p.ingredient_name
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    map.forEach((list) => list.sort((a, b) => String(b.date).localeCompare(String(a.date))))
    return map
  }, [purchases])

  /** ประวัติล่าสุดของแต่ละวัตถุดิบ ใช้เติมปุ่ม "ซื้อซ้ำครั้งก่อน" และเรียงปุ่มลัด */
  const recentByIngredient = useMemo(() => {
    const map = new Map()
    purchases.forEach((p) => {
      if (!p.ingredient_id) return
      const entry = map.get(p.ingredient_id) ?? { times: 0, last: null }
      entry.times += 1
      if (!entry.last || String(p.date) > String(entry.last.date)) entry.last = p
      map.set(p.ingredient_id, entry)
    })
    return map
  }, [purchases])

  const otherExpenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenses],
  )

  const periodLabel = rangePreset === 'month'
    ? formatThaiMonth(monthCursor)
    : `${formatThaiDate(from)} – ${formatThaiDate(to)}`

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportIngredientWorkbook({
        purchases,
        expenses,
        totalSales,
        periodLabel,
        shopName,
        filename: `วัตถุดิบ_${from}_ถึง_${to}.xlsx`,
      })
    } finally {
      setExporting(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedStarterIngredients()
    } finally {
      setSeeding(false)
    }
  }

  const isCurrentMonth = (() => {
    const now = new Date()
    return monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()
  })()

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden relative">
      {/* ── Header ── */}
      <header className="shrink-0 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="font-bold text-gray-800 text-base tracking-wide">ค่าใช้จ่าย</h1>
          {tab === 'ingredients' && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || purchases.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold px-3.5 py-1.5 active:scale-95 transition-all"
            >
              <Download size={13} />
              {exporting ? 'กำลังสร้าง...' : 'Excel'}
            </button>
          )}
        </div>

        {/* แท็บ */}
        <div className="flex gap-1 px-4 mt-2.5">
          {[
            { key: 'ingredients', label: '🥬 วัตถุดิบ' },
            { key: 'others', label: '💡 ค่าใช้จ่ายอื่น' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── ตัวเลือกช่วงเวลา ── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {RANGE_PRESETS.map((r) => (
          <button key={r.key} type="button" onClick={() => setRangePreset(r.key)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
              rangePreset === r.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
            {r.label}
          </button>
        ))}
        {rangePreset === 'month' && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setMonthCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500" aria-label="เดือนก่อนหน้า">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-gray-600 min-w-[7.5rem] text-center">
              {formatThaiMonth(monthCursor)}
            </span>
            <button type="button" disabled={isCurrentMonth}
              onClick={() => setMonthCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              className="w-7 h-7 rounded-full bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-500" aria-label="เดือนถัดไป">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ═══════════ แท็บวัตถุดิบ ═══════════ */}
        {tab === 'ingredients' && (
          <div className="p-3 max-w-3xl mx-auto w-full flex flex-col gap-2.5 pb-24">
            {/* สรุปหัวหน้า */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                ค่าวัตถุดิบ {periodLabel}
              </p>
              <div className="flex items-baseline gap-2.5 mb-3">
                <p className="font-black text-gray-800 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(2rem, 7vw, 2.6rem)' }}>
                  {Math.round(ingredientTotal).toLocaleString()}
                </p>
                <span className="text-gray-400 font-bold">฿</span>
                {ingredientChange !== null && (
                  <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${
                    ingredientChange > 0 ? 'bg-red-50 text-red-500' : ingredientChange < 0 ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {ingredientChange > 0 ? '↑' : ingredientChange < 0 ? '↓' : ''}{Math.abs(ingredientChange)}% เทียบช่วงก่อน
                  </span>
                )}
              </div>

              <ShareBar
                total={ingredientTotal}
                segments={Object.entries(INGREDIENT_CATEGORIES).map(([key, label]) => ({
                  key,
                  label,
                  value: categoryTotals[key] ?? 0,
                  color: CATEGORY_BAR_COLORS[key],
                }))}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {Object.entries(INGREDIENT_CATEGORIES).map(([key, label]) => (
                  (categoryTotals[key] ?? 0) > 0 && (
                    <span key={key} className="text-[11px] text-gray-500">
                      <span className={`inline-block w-2 h-2 rounded-sm mr-1 align-middle ${CATEGORY_BAR_COLORS[key]}`} />
                      {label} {Math.round(categoryTotals[key]).toLocaleString()}
                    </span>
                  )
                ))}
              </div>
            </div>

            {/* ยังไม่มีทะเบียนวัตถุดิบ */}
            {!ingredientsLoading && activeIngredients.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 text-center">
                <span className="text-4xl">🥬</span>
                <p className="text-sm text-gray-500 leading-relaxed">
                  ยังไม่มีทะเบียนวัตถุดิบ<br />
                  เพิ่มรายการที่ซื้อประจำไว้ก่อน จะได้กรอกเร็วตอนกลับจากตลาด
                </p>
                <button type="button" onClick={handleSeed} disabled={seeding || !online}
                  className="rounded-2xl bg-orange-500 disabled:bg-gray-300 text-white font-bold text-sm px-5 py-2.5 active:scale-95 transition-all">
                  {seeding ? 'กำลังเพิ่ม...' : 'เพิ่มรายการตั้งต้น 19 อย่าง'}
                </button>
              </div>
            )}

            {/* รายการวัตถุดิบ */}
            {summary.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                    รายการวัตถุดิบ
                  </p>
                  <p className="text-[10px] text-gray-300">{summary.length} รายการ · กดเพื่อดูประวัติ</p>
                </div>
                {summary.map((entry) => (
                  <IngredientRow
                    key={entry.key}
                    entry={entry}
                    purchases={purchasesByIngredient.get(entry.key) ?? []}
                    expanded={expandedId === entry.key}
                    onToggle={() => setExpandedId(expandedId === entry.key ? null : entry.key)}
                    onDeletePurchase={(id) => deletePurchase(id)}
                  />
                ))}
              </div>
            )}

            {!purchasesLoading && purchases.length === 0 && activeIngredients.length > 0 && (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <span className="text-4xl">🧾</span>
                <p className="text-gray-400 text-sm">ยังไม่มีการซื้อวัตถุดิบในช่วงนี้</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ แท็บค่าใช้จ่ายอื่น ═══════════ */}
        {tab === 'others' && (
          <div className="p-3 max-w-3xl mx-auto w-full flex flex-col gap-2.5 pb-24">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                ค่าใช้จ่ายอื่น {periodLabel}
              </p>
              <div className="flex items-baseline gap-2.5">
                <p className="font-black text-gray-800 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(2rem, 7vw, 2.6rem)' }}>
                  {Math.round(otherExpenseTotal).toLocaleString()}
                </p>
                <span className="text-gray-400 font-bold">฿</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                ค่าน้ำ ค่าไฟ ค่าเช่า ค่าแรง — ค่าวัตถุดิบอยู่ในแท็บวัตถุดิบ
              </p>
            </div>

            {expenses.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="text-lg shrink-0">{EXPENSE_CATEGORY_ICONS[e.category] ?? '📝'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {e.custom_label || expenseCategoryLabel(e.category)}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {formatThaiDate(e.date)}
                          {e.note ? ` · ${e.note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {expenseCategoryLabel(e.category)}
                      </span>
                      <span className="text-sm font-extrabold text-gray-800 tabular-nums">
                        {(e.amount ?? 0).toLocaleString()} ฿
                      </span>
                      <button type="button" onClick={() => deleteExpense(e.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors" aria-label="ลบรายการนี้">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expenses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <span className="text-4xl">💡</span>
                <p className="text-gray-400 text-sm">ยังไม่มีค่าใช้จ่ายอื่นในช่วงนี้</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ปุ่มลอย ── */}
      <button
        type="button"
        onClick={() => (tab === 'ingredients' ? setPurchaseModalOpen(true) : setExpenseModalOpen(true))}
        disabled={!online}
        className="absolute bottom-5 right-5 z-10 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold px-5 py-3.5 shadow-xl shadow-orange-300/50 active:scale-95 transition-all"
      >
        <Plus size={20} />
        {tab === 'ingredients' ? 'บันทึกการซื้อ' : 'เพิ่มค่าใช้จ่าย'}
      </button>

      {purchaseModalOpen && (
        <PurchaseModal
          ingredients={activeIngredients}
          recentByIngredient={recentByIngredient}
          defaultDate={toDateString()}
          onClose={() => setPurchaseModalOpen(false)}
          onSaved={() => setPurchaseModalOpen(false)}
        />
      )}

      {expenseModalOpen && (
        <ExpenseModal
          onClose={() => setExpenseModalOpen(false)}
          onSubmit={async (payload) => {
            await createExpense(payload)
            setExpenseModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default ExpensesPage
