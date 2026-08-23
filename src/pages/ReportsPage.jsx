import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import { toDateString } from '../lib/expenses'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
]

const LOW_STOCK_THRESHOLD = 5
const METHOD_LABELS = { cash: 'เงินสด', promptpay: 'โมบายแบงค์กิ้ง', delivery: 'เดลิเวอรี่' }

function getRange(preset) {
  const today = new Date()
  const todayStr = toDateString(today)
  if (preset === '7days') {
    const from = new Date(today); from.setDate(from.getDate() - 6)
    return { from: toDateString(from), to: todayStr }
  }
  if (preset === '30days') {
    const from = new Date(today); from.setDate(from.getDate() - 29)
    return { from: toDateString(from), to: todayStr }
  }
  return { from: todayStr, to: todayStr }
}

function orderDateStr(order) {
  const ts = order.created_at
  if (!ts?.toDate) return null
  return toDateString(ts.toDate())
}

function exportCSV(orders, from, to) {
  const headers = ['วันที่', 'เลขบิล', 'รายการ', 'ราคาก่อนลด (฿)', 'ส่วนลด (฿)', 'ยอดรวม (฿)', 'ช่องทางชำระ']
  const rows = orders.map((o) => {
    const dateStr = (() => { const ts = o.created_at; if (!ts?.toDate) return ''; return toDateString(ts.toDate()) })()
    const items = (o.items ?? []).map((i) => `${i.name} x${i.qty}`).join(' | ')
    const payStr = (o.payments ?? []).map((p) => `${p.platform ?? METHOD_LABELS[p.method] ?? p.method} ${p.amount}`).join('+')
    return [dateStr, o.queue_no ?? '', items, o.subtotal ?? o.total_amount ?? 0, o.discount ?? 0, o.total_amount ?? 0, payStr]
  })
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `ยอดขาย_${from}_ถึง_${to}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function ReportsPage() {
  const [orders, setOrders]         = useState([])
  const [expenses, setExpenses]     = useState([])
  const [products, setProducts]     = useState([])
  const [damageLogs, setDamageLogs] = useState([])
  const [preset, setPreset]         = useState('today')

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.is_voided))
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'stock_logs'), orderBy('created_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setDamageLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.type === 'damage'))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.is_active))
    })
  }, [])

  const { from, to } = getRange(preset)

  const filtered = useMemo(
    () => orders.filter((o) => { const d = orderDateStr(o); return d && d >= from && d <= to }),
    [orders, from, to],
  )

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => { const d = e.date ?? null; return d && d >= from && d <= to }),
    [expenses, from, to],
  )

  const totalSales    = useMemo(() => filtered.reduce((s, o) => s + (o.total_amount ?? 0), 0), [filtered])
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0), [filteredExpenses])
  const netProfit     = totalSales - totalExpenses
  const profitMargin  = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0
  const totalOrders   = filtered.length
  const avgOrder      = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0

  const paymentBreakdown = useMemo(() => {
    const map = {}
    filtered.forEach((o) => {
      ;(o.payments ?? []).forEach((p) => {
        const key = p.platform ?? METHOD_LABELS[p.method] ?? p.method
        map[key] = (map[key] ?? 0) + p.amount
      })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const topItems = useMemo(() => {
    const map = {}
    filtered.forEach((o) => {
      ;(o.items ?? []).forEach((item) => {
        if (!map[item.name]) map[item.name] = { qty: 0, total: 0 }
        map[item.name].qty   += item.qty
        map[item.name].total += item.line_total ?? 0
      })
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, qty: d.qty, total: d.total }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [filtered])

  const lowStock = useMemo(
    () => products
      .filter((p) => (p.stock_qty ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0)),
    [products],
  )

  const maxItemQty = topItems[0]?.qty ?? 1

  const filteredDamage = useMemo(
    () => damageLogs.filter((l) => { const d = orderDateStr(l); return d && d >= from && d <= to }),
    [damageLogs, from, to],
  )

  const damageSummary = useMemo(() => {
    const map = {}
    filteredDamage.forEach((log) => {
      const product = products.find((p) => p.id === log.product_id)
      const name  = product?.name ?? 'สินค้าที่ถูกลบแล้ว'
      const price = product?.price ?? 0
      const qty   = Math.abs(log.qty_change)
      if (!map[log.product_id]) map[log.product_id] = { name, qty: 0, value: 0, reasons: new Set() }
      map[log.product_id].qty   += qty
      map[log.product_id].value += qty * price
      if (log.note) map[log.product_id].reasons.add(log.note)
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  }, [filteredDamage, products])

  const totalDamageQty   = useMemo(() => filteredDamage.reduce((s, l) => s + Math.abs(l.qty_change), 0), [filteredDamage])
  const totalDamageValue = useMemo(() => damageSummary.reduce((s, d) => s + d.value, 0), [damageSummary])

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 bg-white px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
        <h1 className="font-bold text-gray-800 text-base tracking-wide">แดชบอร์ด</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => exportCSV(filtered, from, to)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 transition-all">
            <Download size={14} />
          </button>
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {RANGE_PRESETS.map((r) => (
              <button key={r.key} type="button" onClick={() => setPreset(r.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  preset === r.key ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3">

          {/* ── Hero: กำไร + ยอดขาย + ต้นทุน ── */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Top bar */}
            <div className={`h-1.5 w-full ${netProfit > 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : netProfit < 0 ? 'bg-gradient-to-r from-red-400 to-rose-500' : 'bg-gray-200'}`} />
            <div className="px-5 pt-4 pb-5">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">กำไรสุทธิ</p>
              <div className="flex items-baseline gap-2 mb-4">
                <p className={`font-black tabular-nums leading-none ${netProfit > 0 ? 'text-emerald-500' : netProfit < 0 ? 'text-red-500' : 'text-gray-400'}`}
                  style={{ fontSize: 'clamp(2.4rem, 9vw, 3.5rem)' }}>
                  {netProfit > 0 ? '+' : ''}{netProfit.toLocaleString()}
                </p>
                <span className="text-gray-400 font-bold text-xl">฿</span>
                {totalSales > 0 && (
                  <span className={`ml-auto text-sm font-bold px-2.5 py-1 rounded-full ${
                    profitMargin > 0 ? 'bg-emerald-50 text-emerald-600' : profitMargin < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {profitMargin > 0 ? '+' : ''}{profitMargin}%
                  </span>
                )}
              </div>

              {/* Sales vs Expenses bar */}
              {totalSales > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                    <span>ยอดขาย</span>
                    <span>ต้นทุน</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-700"
                      style={{ width: `${100}%` }} />
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex mt-1">
                    <div className="h-full bg-gray-300 rounded-full transition-all duration-700"
                      style={{ width: `${totalSales > 0 ? Math.min((totalExpenses / totalSales) * 100, 100) : 0}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-emerald-50 rounded-2xl px-4 py-3">
                  <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">ยอดขาย</p>
                  <p className="text-emerald-600 font-extrabold text-xl tabular-nums leading-tight">
                    {totalSales.toLocaleString()} <span className="text-sm font-normal">฿</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">ต้นทุน</p>
                  <p className="text-gray-600 font-extrabold text-xl tabular-nums leading-tight">
                    {totalExpenses.toLocaleString()} <span className="text-sm font-normal">฿</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3 Stats ── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'บิลทั้งหมด', value: totalOrders.toLocaleString(), unit: 'บิล', color: 'text-blue-500', bar: 'from-blue-400 to-blue-500' },
              { label: 'เฉลี่ย/บิล', value: avgOrder.toLocaleString(), unit: '฿', color: 'text-pink-500', bar: 'from-pink-400 to-rose-400' },
              {
                label: 'กำไร %',
                value: profitMargin,
                unit: '%',
                color: profitMargin > 0 ? 'text-emerald-500' : profitMargin < 0 ? 'text-red-500' : 'text-gray-400',
                bar: profitMargin > 0 ? 'from-emerald-400 to-teal-400' : profitMargin < 0 ? 'from-red-400 to-rose-500' : 'from-gray-300 to-gray-300',
              },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className={`h-1 bg-gradient-to-r ${s.bar}`} />
                <div className="p-3 text-center">
                  <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider mb-1.5 leading-tight">{s.label}</p>
                  <p className={`font-black text-xl leading-none tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-gray-300 text-[9px] mt-1">{s.unit}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── สินค้าเสียหาย/เครม ── */}
          {damageSummary.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
              <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">สินค้าเสียหาย/เครม</p>
                <p className="text-xs font-bold text-red-500">{totalDamageQty} ชิ้น</p>
              </div>
              <div className="px-4 pb-3 flex flex-col gap-2.5 mt-2">
                {damageSummary.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{d.name}</p>
                      {d.reasons.size > 0 && (
                        <p className="text-[11px] text-gray-400 truncate">{[...d.reasons].join(', ')}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-500">{d.qty} ชิ้น</p>
                      {d.value > 0 && <p className="text-[11px] text-gray-400 tabular-nums">~{d.value.toLocaleString()} ฿</p>}
                    </div>
                  </div>
                ))}
              </div>
              {totalDamageValue > 0 && (
                <div className="px-4 pb-3 pt-2 border-t border-red-50">
                  <p className="text-xs text-gray-400">
                    มูลค่ารวม (ตามราคาขาย) <span className="font-bold text-red-500">{totalDamageValue.toLocaleString()} ฿</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {/* ── สินค้าขายดี ── */}
              {topItems.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">สินค้าขายดี</p>
                    <p className="text-[10px] text-gray-300">จำนวน / ยอดขาย</p>
                  </div>
                  <div className="px-4 pb-4 flex flex-col gap-2.5 mt-2">
                    {topItems.map((item, idx) => {
                      const barPct = Math.round((item.qty / maxItemQty) * 100)
                      const medals = ['🥇', '🥈', '🥉']
                      return (
                        <div key={item.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm shrink-0">{medals[idx] ?? `${idx + 1}.`}</span>
                              <span className="text-sm font-semibold text-gray-700 truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0 ml-2">
                              <span className="text-xs font-bold text-pink-500">{item.qty} ชิ้น</span>
                              <span className="text-xs text-gray-400 tabular-nums">{item.total.toLocaleString()} ฿</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500"
                              style={{ width: `${Math.max(barPct, 4)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── ช่องทางชำระ ── */}
              {paymentBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ช่องทางชำระเงิน</p>
                  </div>
                  <div className="px-4 pb-4 flex flex-col gap-3 mt-3">
                    {paymentBreakdown.map(([label, amount]) => {
                      const pct = totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-gray-700 truncate max-w-[10rem]">{label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold text-gray-800 tabular-nums">{amount.toLocaleString()} ฿</span>
                              <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-500"
                              style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── สินค้าใกล้หมด ── */}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-2.5">⚠ สินค้าใกล้หมด</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lowStock.map((p) => (
                        <span key={p.id}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            (p.stock_qty ?? 0) === 0
                              ? 'bg-red-500 text-white'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          {p.name} {(p.stock_qty ?? 0) === 0 ? '(หมด)' : `${p.stock_qty}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Empty ── */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl">📊</div>
              <p className="text-gray-400 text-sm font-medium">ไม่มีข้อมูลยอดขายในช่วงนี้</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default ReportsPage
