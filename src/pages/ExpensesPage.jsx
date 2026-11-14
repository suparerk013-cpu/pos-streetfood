import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import ExpenseModal from '../components/ExpenseModal'
import { useAppData } from '../lib/appDataContext'
import { formatThaiDate, formatThaiMonth, getMonthRange, getPresetRange } from '../lib/dates'
import {
  createExpense,
  deleteEntry,
  mergeEntries,
  summarizeByName,
  totalOf,
  updateExpense,
} from '../lib/expenses'
import { exportExpenseWorkbook } from '../lib/excelExport'
import { useShiftSales } from '../lib/useShiftSales'
import { useExpensesInRange, usePurchasesInRange, useRecentEntries } from '../lib/usePurchases'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'month', label: 'รายเดือน' },
]

const TABS = [
  { key: 'list', label: '📝 รายการ' },
  { key: 'compare', label: '⚖️ รับ-จ่าย' },
]

const baht = (n) => Math.round(n).toLocaleString()

function EntryRow({ entry, onEdit, onDelete }) {
  const legacy = entry.source === 'purchases'
  const detail = [
    entry.qty ? `${Number(entry.qty.toFixed(3)).toLocaleString()} ${entry.unit ?? ''}`.trim() : entry.unit,
    entry.note,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <button type="button" onClick={() => !legacy && onEdit(entry)} disabled={legacy}
        className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left min-h-[44px]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{entry.name}</p>
          {(detail || legacy) && (
            <p className="text-[11px] text-gray-400 truncate">
              {detail}
              {legacy && <span className="ml-1 text-gray-300">{detail ? '· ' : ''}รายการแบบเก่า</span>}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-extrabold text-gray-800 tabular-nums">
          {entry.amount.toLocaleString()} ฿
        </span>
      </button>
      <button type="button" onClick={() => onDelete(entry)}
        className="shrink-0 w-10 h-10 -mr-2 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
        aria-label={`ลบ ${entry.name}`}>
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function CompareRow({ label, value, sign = '', strong = false, muted = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'text-gray-800' : muted ? 'text-gray-400' : 'text-gray-600'}`}>
      <span className={strong ? 'text-sm font-bold' : 'text-sm'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-lg font-extrabold' : 'text-sm font-bold'}`}>
        {sign}{baht(value)} ฿
      </span>
    </div>
  )
}

function ExpensesPage() {
  const { shopName, online } = useAppData()

  const [tab, setTab] = useState('list')
  const [rangePreset, setRangePreset] = useState('month')
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // null = ปิด · {} = จดใหม่ · entry = แก้รายการเดิม
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [exporting, setExporting] = useState(false)

  const { from, to } =
    rangePreset === 'month' ? getMonthRange(monthCursor) : getPresetRange(rangePreset)

  const { purchases, loading: purchasesLoading } = usePurchasesInRange(from, to)
  const { expenses, loading: expensesLoading } = useExpensesInRange(from, to)
  const sales = useShiftSales(from, to)
  const recent = useRecentEntries(editing !== null)

  const entries = useMemo(() => mergeEntries(purchases, expenses), [purchases, expenses])
  const recentEntries = useMemo(
    () => mergeEntries(recent.purchases, recent.expenses),
    [recent.purchases, recent.expenses],
  )
  const total = useMemo(() => totalOf(entries), [entries])
  const byName = useMemo(() => summarizeByName(entries), [entries])
  const byDate = useMemo(() => {
    const groups = []
    entries.forEach((e) => {
      const last = groups[groups.length - 1]
      if (last && last.date === e.date) last.items.push(e)
      else groups.push({ date: e.date, items: [e] })
    })
    return groups.map((g) => ({ ...g, total: totalOf(g.items) }))
  }, [entries])

  const left = sales.net - total
  const expenseShare = sales.net > 0 ? Math.round((total / sales.net) * 100) : null
  const loading = purchasesLoading || expensesLoading

  const periodLabel = rangePreset === 'month'
    ? formatThaiMonth(monthCursor)
    : from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`

  const isCurrentMonth = (() => {
    const now = new Date()
    return monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()
  })()

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportExpenseWorkbook({
        entries,
        sales,
        periodLabel,
        shopName,
        filename: `รายจ่าย_${from}_ถึง_${to}.xlsx`,
      })
    } finally {
      setExporting(false)
    }
  }

  const handleSubmit = async (payload) => {
    if (editing?.id) await updateExpense(editing.id, payload)
    else await createExpense(payload)
    setEditing(null)
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden relative">
      {/* ── หัว ── */}
      <header className="shrink-0 bg-orange-500 text-white">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="text-xs text-white/75 font-semibold truncate">{periodLabel}</p>
            <h1 className="text-xl font-black leading-tight">รายจ่าย</h1>
          </div>
          <button type="button" onClick={handleExport} disabled={exporting || entries.length === 0}
            className="shrink-0 min-h-[44px] flex items-center gap-1.5 rounded-xl bg-white/20 disabled:opacity-50 text-white text-sm font-bold px-3.5 active:bg-white/30 transition-all">
            <Download size={15} />
            {exporting ? 'กำลังสร้าง...' : 'Excel'}
          </button>
        </div>
        <div className="flex gap-1 px-4 mt-2.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-bold border-b-[3px] transition-colors ${
                tab === t.key ? 'border-white text-white' : 'border-transparent text-white/65'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── ช่วงเวลา ── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex flex-wrap items-center gap-2">
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
            <span className="text-xs font-bold text-gray-600 min-w-[7.5rem] text-center">{formatThaiMonth(monthCursor)}</span>
            <button type="button" disabled={isCurrentMonth}
              onClick={() => setMonthCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              className="w-7 h-7 rounded-full bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-500" aria-label="เดือนถัดไป">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 max-w-3xl mx-auto w-full flex flex-col gap-2.5 pb-24">
          {/* ═══════════ รายการ ═══════════ */}
          {tab === 'list' && (
            <>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">รายจ่าย {periodLabel}</p>
                <div className="flex items-baseline gap-2.5">
                  <p className="font-black text-gray-800 tabular-nums leading-none" style={{ fontSize: 'clamp(2rem, 7vw, 2.6rem)' }}>
                    {baht(total)}
                  </p>
                  <span className="text-gray-400 font-bold">฿</span>
                  <span className="ml-auto text-xs text-gray-400">{entries.length} รายการ</span>
                </div>
                {byName.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-2 truncate">
                    จ่ายเยอะสุด: {byName.slice(0, 3).map((r) => `${r.name} ${baht(r.total)}`).join(' · ')}
                  </p>
                )}
              </div>

              {byDate.map((group) => (
                <div key={group.date} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500">{formatThaiDate(group.date)}</p>
                    <p className="text-xs font-bold text-gray-400 tabular-nums">{baht(group.total)} ฿</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.items.map((e) => (
                      <EntryRow key={`${e.source}-${e.id}`} entry={e} onEdit={setEditing} onDelete={setConfirmDelete} />
                    ))}
                  </div>
                </div>
              ))}

              {!loading && entries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                  <span className="text-4xl">🧾</span>
                  <p className="text-gray-400 text-sm">ยังไม่ได้จดรายจ่ายในช่วงนี้</p>
                  <p className="text-gray-300 text-xs">กดปุ่ม “จดรายจ่าย” มุมขวาล่าง</p>
                </div>
              )}
            </>
          )}

          {/* ═══════════ รับ-จ่าย ═══════════ */}
          {tab === 'compare' && (
            <>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 pt-4 pb-4">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">เหลือ {periodLabel}</p>
                <div className="flex items-baseline gap-2.5 mb-1">
                  <p className={`font-black tabular-nums leading-none ${left >= 0 ? 'text-green-600' : 'text-red-500'}`}
                    style={{ fontSize: 'clamp(2rem, 7vw, 2.6rem)' }}>
                    {left >= 0 ? '+' : '−'}{baht(Math.abs(left))}
                  </p>
                  <span className="text-gray-400 font-bold">฿</span>
                </div>
                <p className="text-[11px] text-gray-400 mb-4">
                  เงินเข้าจริง ลบ รายจ่ายที่จดไว้
                  {sales.shiftCount > 0 && ` · จาก ${sales.shiftCount} กะ`}
                </p>

                {/* แถบเทียบ — ยาวเท่ากันทั้งคู่ถ้าจ่ายเท่ากับที่ได้ */}
                <div className="flex flex-col gap-2 mb-4">
                  {[
                    { label: 'รับ', value: sales.net, color: 'bg-green-500' },
                    { label: 'จ่าย', value: total, color: 'bg-red-400' },
                  ].map((bar) => {
                    const max = Math.max(sales.net, total, 1)
                    return (
                      <div key={bar.label} className="flex items-center gap-2">
                        <span className="w-8 text-xs font-bold text-gray-500">{bar.label}</span>
                        <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.value / max) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs font-bold text-gray-700 tabular-nums">{baht(bar.value)}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                  <CompareRow label="ขายได้" value={sales.gross} />
                  {sales.gpFee > 0 && <CompareRow label="หัก ค่า GP เดลิเวอรี" value={sales.gpFee} sign="−" muted />}
                  <CompareRow label="เงินเข้าจริง" value={sales.net} strong />
                  <CompareRow label="หัก รายจ่ายที่จดไว้" value={total} sign="−" />
                  <div className="border-t border-dashed border-gray-200 mt-1 pt-2">
                    <CompareRow label="เหลือ" value={left} strong />
                  </div>
                </div>
                {expenseShare !== null && (
                  <p className="text-[11px] text-gray-400 mt-3">
                    เงินเข้ามา 100 บาท จ่ายออกไป {expenseShare} บาท
                  </p>
                )}
                {sales.truncated && (
                  <p className="text-[11px] text-amber-600 mt-2">บิลในช่วงนี้เยอะเกินที่ดึงได้ ยอดขายอาจขาด ลองเลือกช่วงสั้นลง</p>
                )}
                {sales.loading && <p className="text-[11px] text-gray-400 mt-2">กำลังโหลดยอดขาย...</p>}
              </div>

              {byName.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <p className="px-4 pt-3 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                    จ่ายไปกับอะไรบ้าง
                  </p>
                  <div className="divide-y divide-gray-50">
                    {byName.map((row) => (
                      <div key={row.key} className="px-4 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-bold text-gray-800 truncate">{row.name}</p>
                          <p className="text-sm font-extrabold text-gray-800 tabular-nums shrink-0">{baht(row.total)} ฿</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-orange-400" style={{ width: `${total > 0 ? (row.total / total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {row.times} ครั้ง{row.qty > 0 ? ` · ${Number(row.qty.toFixed(3)).toLocaleString()} ${row.unit ?? ''}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── ปุ่มลอย ── */}
      <button type="button" onClick={() => setEditing({})} disabled={!online}
        className="absolute bottom-5 right-5 z-10 min-h-[60px] flex items-center gap-2 rounded-2xl bg-gray-900 disabled:bg-gray-300 text-white font-black text-lg px-6 shadow-xl active:scale-95 transition-transform">
        <Plus size={20} />
        จดรายจ่าย
      </button>

      {editing !== null && (
        <ExpenseModal
          entry={editing.id ? editing : null}
          recentEntries={recentEntries}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-base font-bold text-gray-800">ลบ “{confirmDelete.name}”?</p>
            <p className="text-sm text-gray-500">
              {formatThaiDate(confirmDelete.date)} · {confirmDelete.amount.toLocaleString()} ฿
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="min-h-[48px] rounded-xl bg-gray-100 text-gray-600 font-bold">ไม่ลบ</button>
              <button type="button"
                onClick={async () => {
                  const target = confirmDelete
                  setConfirmDelete(null)
                  await deleteEntry(target)
                }}
                className="min-h-[48px] rounded-xl bg-red-500 text-white font-bold">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpensesPage
