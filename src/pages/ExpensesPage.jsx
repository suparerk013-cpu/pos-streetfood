import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import ExpenseModal from '../components/ExpenseModal'
import { db } from '../lib/firebase'
import { createExpense, EXPENSE_CATEGORY_LABELS, toDateString } from '../lib/expenses'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'custom', label: 'กำหนดเอง' },
]

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

function orderDateString(order) {
  const timestamp = order.created_at
  if (!timestamp?.toDate) return null
  return toDateString(timestamp.toDate())
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

  useEffect(() => {
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
      setLoading(false)
    })
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    })
    return () => {
      unsubExpenses()
      unsubOrders()
    }
  }, [])

  const { from, to } =
    rangePreset === 'custom' ? { from: customFrom, to: customTo } : getPresetRange(rangePreset)

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => expense.date >= from && expense.date <= to),
    [expenses, from, to],
  )

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.is_voided) return false
        const dateStr = orderDateString(order)
        return dateStr !== null && dateStr >= from && dateStr <= to
      }),
    [orders, from, to],
  )

  const totalSales = filteredOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0)
  const netProfit = totalSales - totalExpenses

  const categoryTotals = useMemo(() => {
    const totals = {}
    Object.keys(EXPENSE_CATEGORY_LABELS).forEach((key) => {
      totals[key] = 0
    })
    filteredExpenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + (expense.amount ?? 0)
    })
    return totals
  }, [filteredExpenses])

  const visibleExpenses = useMemo(() => {
    const list =
      categoryFilter === 'all'
        ? filteredExpenses
        : filteredExpenses.filter((expense) => expense.category === categoryFilter)

    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      const aTime = a.created_at?.toMillis?.() ?? 0
      const bTime = b.created_at?.toMillis?.() ?? 0
      return bTime - aTime
    })
  }, [filteredExpenses, categoryFilter])

  const handleAddExpense = async (data) => {
    await createExpense(data)
    setModalOpen(false)
  }

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        <h1 className="font-bold text-lg">ค่าใช้จ่าย</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mb-4 w-full min-h-[52px] rounded-2xl bg-orange-600 text-white font-bold active:scale-95 transition-transform"
        >
          + บันทึกค่าใช้จ่าย
        </button>

        <div className="mb-3 flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setRangePreset(preset.key)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-semibold transition-colors ${
                rangePreset === preset.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {rangePreset === 'custom' && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">จาก</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 px-3"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">ถึง</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 px-3"
              />
            </label>
          </div>
        )}

        <div className="mb-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white border border-gray-100 p-3">
            <p className="text-xs text-gray-400">ยอดขายรวม</p>
            <p className="text-2xl font-bold text-gray-800">{totalSales.toLocaleString()} ฿</p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-100 p-3">
            <p className="text-xs text-gray-400">ค่าใช้จ่ายรวม</p>
            <p className="text-2xl font-bold text-gray-800">{totalExpenses.toLocaleString()} ฿</p>
          </div>
          <div
            className={`rounded-2xl border p-3 ${
              netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
            }`}
          >
            <p className={`text-xs ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              กำไรสุทธิโดยประมาณ
            </p>
            <p
              className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {netProfit.toLocaleString()} ฿
            </p>
          </div>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          * เป็นตัวเลขประมาณการ ไม่รวมต้นทุนที่ยังไม่ได้บันทึก
        </p>

        <div className="mb-4">
          <p className="mb-2 text-sm font-bold text-gray-700">สรุปค่าใช้จ่ายตามหมวดหมู่</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
              <div
                key={key}
                className={`rounded-xl border p-3 ${
                  categoryTotals[key] > 0
                    ? 'bg-white border-orange-100'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <p className="text-xs text-gray-400">{label}</p>
                <p
                  className={`text-lg font-bold ${
                    categoryTotals[key] > 0 ? 'text-gray-800' : 'text-gray-300'
                  }`}
                >
                  {categoryTotals[key].toLocaleString()} ฿
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-700">รายการค่าใช้จ่าย</p>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="text-sm rounded-lg border border-gray-200 px-2 py-2.5 min-h-[44px]"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {!loading && visibleExpenses.length === 0 && (
            <p className="text-center text-gray-400 py-8">ไม่มีรายการค่าใช้จ่ายในช่วงนี้</p>
          )}

          <div className="space-y-2">
            {visibleExpenses.map((expense) => (
              <div key={expense.id} className="rounded-xl bg-white border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">
                        {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
                      </span>
                      {expense.source === 'restock' && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 whitespace-nowrap">
                          จากนำเข้าสต็อก
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{expense.date}</p>
                    {expense.note && (
                      <p className="text-sm text-gray-500 truncate">{expense.note}</p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold text-gray-800">
                    {(expense.amount ?? 0).toLocaleString()} ฿
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ExpenseModal onClose={() => setModalOpen(false)} onSubmit={handleAddExpense} />
      )}
    </div>
  )
}

export default ExpensesPage
