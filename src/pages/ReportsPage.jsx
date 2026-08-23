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
        const key = item.product_id ?? item.name
        if (!map[key]) map[key] = { name: item.name, productId: item.product_id, qty: 0, total: 0 }
        map[key].qty   += item.qty
        map[key].total += item.line_total ?? 0
      })
    })
    return Object.values(map)
      .map((d) => ({ ...d, unit: products.find((p) => p.id === d.productId)?.unit ?? 'ชิ้น' }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [filtered, products])

  const lowStock = useMemo(
    () => products
      .filter((p) => (p.stock_qty ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0)),
    [products],
  )

  const filteredDamage = useMemo(
    () => damageLogs.filter((l) => { const d = orderDateStr(l); return d && d >= from && d <= to }),
    [damageLogs, from, to],
  )

  const damageSummary = useMemo(() => {
    const map = {}
    filteredDamage.forEach((log) => {
      const product = products.find((p) => p.id === log.product_id)
      const name  = product?.name ?? 'สินค้าที่ถูกลบแล้ว'
      const unit  = product?.unit ?? 'ชิ้น'
      const price = product?.price ?? 0
      const qty   = Math.abs(log.qty_change)
      if (!map[log.product_id]) map[log.product_id] = { name, unit, qty: 0, value: 0, reasons: new Set() }
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
        <div className="p-3 flex flex-col gap-2.5">

          {/* ── Hero: กำไร + ยอดขาย/ต้นทุน/บิล/เฉลี่ย ── */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Top bar */}
            <div className={`h-1.5 w-full ${netProfit > 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : netProfit < 0 ? 'bg-gradient-to-r from-red-400 to-rose-500' : 'bg-gray-200'}`} />
            <div className="px-5 pt-4 pb-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">กำไรสุทธิ</p>
              <div className="flex items-baseline gap-2 mb-4">
                <p className={`font-black tabular-nums leading-none ${netProfit > 0 ? 'text-emerald-500' : netProfit < 0 ? 'text-red-500' : 'text-gray-400'}`}
                  style={{ fontSize: 'clamp(2.2rem, 8vw, 3rem)' }}>
                  {netProfit > 0 ? '+' : ''}{netProfit.toLocaleString()}
                </p>
                <span className="text-gray-400 font-bold text-lg">฿</span>
                {totalSales > 0 && (
                  <span className={`ml-auto text-sm font-bold px-2.5 py-1 rounded-full ${
                    profitMargin > 0 ? 'bg-emerald-50 text-emerald-600' : profitMargin < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {profitMargin > 0 ? '+' : ''}{profitMargin}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'ยอดขาย', value: `${totalSales.toLocaleString()} ฿`, color: 'text-emerald-600', bg: 'bg-emerald-50', labelColor: 'text-emerald-500' },
                  { label: 'ต้นทุน', value: `${totalExpenses.toLocaleString()} ฿`, color: 'text-gray-600', bg: 'bg-gray-50', labelColor: 'text-gray-400' },
                  { label: 'บิลทั้งหมด', value: `${totalOrders.toLocaleString()} บิล`, color: 'text-blue-600', bg: 'bg-blue-50', labelColor: 'text-blue-400' },
                  { label: 'เฉลี่ย/บิล', value: `${avgOrder.toLocaleString()} ฿`, color: 'text-pink-600', bg: 'bg-pink-50', labelColor: 'text-pink-400' },
                ].map((m) => (
                  <div key={m.label} className={`${m.bg} rounded-2xl px-3.5 py-2.5`}>
                    <p className={`${m.labelColor} text-[9px] font-bold uppercase tracking-wider mb-0.5`}>{m.label}</p>
                    <p className={`${m.color} font-extrabold text-base tabular-nums leading-tight`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── สินค้าเสียหาย/เครม ── */}
          {damageSummary.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">สินค้าเสียหาย/เครม</p>
                <p className="text-xs font-bold text-red-500 tabular-nums">
                  {totalDamageQty} รายการ{totalDamageValue > 0 ? ` · ~${totalDamageValue.toLocaleString()} ฿` : ''}
                </p>
              </div>
              <div className="px-4 pb-3 flex flex-col gap-1.5 mt-1">
                {damageSummary.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-gray-700 truncate">{d.name}</span>
                      {d.reasons.size > 0 && (
                        <span className="text-[11px] text-gray-400 truncate">{[...d.reasons].join(', ')}</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-red-500 shrink-0 tabular-nums">{d.qty} {d.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {/* ── สินค้าขายดี ── */}
              {topItems.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">สินค้าขายดี</p>
                    <p className="text-[10px] text-gray-300">จำนวน / ยอดขาย</p>
                  </div>
                  <div className="px-4 pb-3 flex flex-col gap-1.5 mt-1">
                    {topItems.map((item, idx) => {
                      const medals = ['🥇', '🥈', '🥉']
                      return (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">{medals[idx] ?? `${idx + 1}.`}</span>
                            <span className="text-sm font-semibold text-gray-700 truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 ml-2">
                            <span className="text-xs font-bold text-pink-500 tabular-nums">{item.qty} {item.unit}</span>
                            <span className="text-xs text-gray-400 tabular-nums">{item.total.toLocaleString()} ฿</span>
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
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ช่องทางชำระเงิน</p>
                  </div>
                  <div className="px-4 pb-3 flex flex-col gap-1.5 mt-1">
                    {paymentBreakdown.map(([label, amount]) => {
                      const pct = totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0
                      return (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700 truncate max-w-[10rem]">{label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-gray-800 tabular-nums">{amount.toLocaleString()} ฿</span>
                            <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
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
                  <div className="px-4 pt-3 pb-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-2">⚠ สินค้าใกล้หมด</p>
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
