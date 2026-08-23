import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import ExpenseModal from '../components/ExpenseModal'
import { db } from '../lib/firebase'
import { createExpense, EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_LABELS, toDateString } from '../lib/expenses'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'custom', label: 'กำหนดเอง' },
]

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function getMonthRange(cursor) {
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  return { from: toDateString(from), to: toDateString(to) }
}

const CATEGORY_ICONS = {
  raw_material: '🥩',
  utility_water: '💧',
  utility_electric: '⚡',
  rent: '🏠',
  labor: '👷',
  other: '📝',
}

function getPresetRange(preset) {
  const today = new Date()
  const todayStr = toDateString(today)
  if (preset === '7days' || preset === '30days') {
    const daysBack = preset === '7days' ? 6 : 29
    const from = new Date(today)
    from.setDate(from.getDate() - daysBack)
    return { from: toDateString(from), to: todayStr }
  }
  return { from: todayStr, to: todayStr }
}

function orderDateStr(order) {
  const ts = order.created_at
  if (!ts?.toDate) return null
  return toDateString(ts.toDate())
}

function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [rangePreset, setRangePreset] = useState('today')
  const [customFrom, setCustomFrom] = useState(toDateString())
  const [customTo, setCustomTo] = useState(toDateString())
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const isCurrentMonth = (() => {
    const now = new Date()
    return monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()
  })()

  const goPrevMonth = () => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  const goNextMonth = () => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))

  useEffect(() => {
    return onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.is_voided))
    })
  }, [])

  const { from, to } =
    rangePreset === 'custom' ? { from: customFrom, to: customTo }
    : rangePreset === 'month' ? getMonthRange(monthCursor)
    : getPresetRange(rangePreset)

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => e.date >= from && e.date <= to),
    [expenses, from, to],
  )

  const filteredOrders = useMemo(
    () => orders.filter((o) => { const d = orderDateStr(o); return d && d >= from && d <= to }),
    [orders, from, to],
  )

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const totalSales = filteredOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  const netProfit = totalSales - totalExpenses

  const categoryTotals = useMemo(() => {
    const totals = {}
    Object.keys(EXPENSE_CATEGORY_LABELS).forEach((key) => { totals[key] = 0 })
    filteredExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] ?? 0) + (e.amount ?? 0)
    })
    return totals
  }, [filteredExpenses])

  const visibleExpenses = useMemo(() => {
    const list = categoryFilter === 'all'
      ? filteredExpenses
      : filteredExpenses.filter((e) => e.category === categoryFilter)
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0)
    })
  }, [filteredExpenses, categoryFilter])

  const handleAddExpense = async (data) => {
    await createExpense(data)
    setModalOpen(false)
  }

  const expenseLabel = (expense) => {
    if (expense.custom_label) return expense.custom_label
    return EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category
  }

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shrink-0">
        <h1 className="font-bold text-lg">ค่าใช้จ่าย / ต้นทุน</h1>
        <button type="button" onClick={() => setModalOpen(true)}
          className="text-sm bg-white/20 px-3 py-1.5 rounded-xl font-semibold active:scale-95">
          + บันทึก
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Range presets */}
        <div className="flex flex-wrap gap-1.5">
          {RANGE_PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => setRangePreset(p.key)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-semibold transition-colors ${
                rangePreset === p.key ? 'bg-orange-500 text-white shadow' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {rangePreset === 'month' && (
          <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-2 py-2">
            <button type="button" onClick={goPrevMonth} aria-label="เดือนก่อนหน้า"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-100">
              ‹
            </button>
            <p className="font-bold text-gray-800">
              {THAI_MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear() + 543}
            </p>
            <button type="button" onClick={goNextMonth} disabled={isCurrentMonth} aria-label="เดือนถัดไป"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none">
              ›
            </button>
          </div>
        )}

        {rangePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">จาก</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 px-3" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">ถึง</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 px-3" />
            </label>
          </div>
        )}

        {/* Profit summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-green-50 border border-green-100 p-3 text-center">
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">ยอดขาย</p>
            <p className="text-base font-extrabold text-green-700 leading-tight">{totalSales.toLocaleString()}</p>
            <p className="text-[10px] text-green-500">฿</p>
          </div>
          <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-center">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">ต้นทุน</p>
            <p className="text-base font-extrabold text-red-600 leading-tight">{totalExpenses.toLocaleString()}</p>
            <p className="text-[10px] text-red-400">฿</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${netProfit >= 0 ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-gray-100'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${netProfit >= 0 ? 'text-white/80' : 'text-gray-500'}`}>กำไร</p>
            <p className={`text-base font-extrabold leading-tight ${netProfit >= 0 ? 'text-white' : 'text-red-600'}`}>
              {netProfit >= 0 ? '' : '-'}{Math.abs(netProfit).toLocaleString()}
            </p>
            <p className={`text-[10px] ${netProfit >= 0 ? 'text-white/70' : 'text-red-400'}`}>฿</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">สรุปตามหมวดหมู่</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  categoryFilter === key
                    ? 'border-orange-400 bg-orange-50'
                    : categoryTotals[key] > 0
                    ? 'bg-white border-orange-100'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <span className="text-base">{CATEGORY_ICONS[key]}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                <p className={`text-sm font-bold ${categoryTotals[key] > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                  {categoryTotals[key].toLocaleString()} ฿
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Expense list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">รายการ</p>
            {categoryFilter !== 'all' && (
              <button type="button" onClick={() => setCategoryFilter('all')}
                className="text-xs text-orange-500 font-semibold">
                ดูทั้งหมด
              </button>
            )}
          </div>

          {!loading && visibleExpenses.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">ไม่มีรายการในช่วงนี้</p>
          )}

          <div className="flex flex-col gap-2">
            {visibleExpenses.map((expense) => (
              <div key={expense.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className="shrink-0 text-2xl">{CATEGORY_ICONS[expense.category] ?? '📝'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{expenseLabel(expense)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[expense.category] ?? 'bg-gray-100 text-gray-500'}`}>
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </span>
                    <span className="text-[10px] text-gray-400">{expense.date}</span>
                    {expense.source === 'restock' && (
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5">จากสต็อก</span>
                    )}
                  </div>
                  {expense.note && <p className="text-xs text-gray-400 truncate mt-0.5">{expense.note}</p>}
                </div>
                <p className="shrink-0 font-bold text-gray-800 text-sm">{(expense.amount ?? 0).toLocaleString()} ฿</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && <ExpenseModal onClose={() => setModalOpen(false)} onSubmit={handleAddExpense} />}
    </div>
  )
}

export default ExpensesPage
