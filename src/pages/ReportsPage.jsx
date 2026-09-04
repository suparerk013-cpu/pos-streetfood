import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { BarChart, DeltaBadge, ShareBar, Sparkline } from '../components/Charts'
import PayoutModal from '../components/PayoutModal'
import { useAppData } from '../lib/appDataContext'
import {
  CRITICAL_STOCK_THRESHOLD,
  LOW_STOCK_THRESHOLD,
  paymentLabel,
} from '../lib/constants'
import {
  docDateStr,
  eachDateInRange,
  formatThaiDate,
  formatThaiMonth,
  getMonthRange,
  getPresetRange,
  getPreviousRange,
  rangeToTimestamps,
} from '../lib/dates'
import { db } from '../lib/firebase'
import { orderCost, summarizeDelivery, summarizeFreebies } from '../lib/deliveryReport'
import { effectiveRates } from '../lib/payoutMath'
import { unitCost } from '../lib/pricing'
import { useExpensesInRange, usePayouts, usePurchasesInRange } from '../lib/usePurchases'
import { useOrdersInRange } from '../lib/useOrders'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'month', label: 'เดือน' },
]

const PAYMENT_BAR_COLORS = ['bg-emerald-400', 'bg-blue-400', 'bg-orange-400', 'bg-purple-400', 'bg-pink-400', 'bg-gray-300']

function exportSalesCSV(orders, from, to) {
  const headers = ['วันที่', 'เลขบิล', 'รายการ', 'ราคาก่อนลด (฿)', 'ส่วนลด (฿)', 'ยอดรวม (฿)', 'ช่องทางชำระ']
  const rows = orders.map((o) => {
    const items = (o.items ?? []).map((i) => `${i.name} x${i.qty}`).join(' | ')
    const payStr = (o.payments ?? []).map((p) => `${paymentLabel(p)} ${p.amount}`).join('+')
    return [docDateStr(o) ?? '', o.queue_no ?? '', items, o.subtotal ?? o.total_amount ?? 0, o.discount ?? 0, o.total_amount ?? 0, payStr]
  })
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ยอดขาย_${from}_ถึง_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** ของเสียหายในช่วงที่เลือก — กรอง type ที่ฝั่งเซิร์ฟเวอร์ ไม่ดึง stock_logs ทั้ง collection */
function useDamageLogs(from, to) {
  const [logs, setLogs] = useState([])
  useEffect(() => {
    if (!from || !to) return undefined
    const { start, end } = rangeToTimestamps(from, to)
    const q = query(
      collection(db, 'stock_logs'),
      where('type', '==', 'damage'),
      where('created_at', '>=', start),
      where('created_at', '<=', end),
      orderBy('created_at', 'desc'),
      limit(500),
    )
    return onSnapshot(q, (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [from, to])
  return logs
}

function StatCell({ label, value, current, previous, invert }) {
  return (
    <div className="flex-1 min-w-0 px-3 py-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className="font-extrabold text-gray-800 tabular-nums text-base leading-tight mt-0.5">{value}</p>
      <DeltaBadge current={current} previous={previous} invert={invert} suffix="" />
    </div>
  )
}

function ReportsPage() {
  const {
    activeProducts,
    productById,
    ingredientById,
    consumableCost,
    packagingCost,
    gpRateFor,
  } = useAppData()
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [preset, setPreset] = useState('today')
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedBar, setSelectedBar] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const { from, to } = preset === 'month' ? getMonthRange(monthCursor) : getPresetRange(preset)
  const prevRange = getPreviousRange(from, to)

  const { orders } = useOrdersInRange(from, to)
  const { orders: prevOrders } = useOrdersInRange(prevRange.from, prevRange.to)
  const payouts = usePayouts()
  const { purchases } = usePurchasesInRange(from, to)
  const { expenses } = useExpensesInRange(from, to)
  const damageLogs = useDamageLogs(from, to)

  /** อัตราที่ถูกหักจริง — ใช้จากรอบจ่ายเงินล่าสุดถ้ามี ไม่มีก็ใช้ค่าที่ตั้งไว้ */
  const rateFor = useMemo(() => effectiveRates(payouts, gpRateFor), [payouts, gpRateFor])

  const costByProduct = useMemo(() => {
    const map = new Map()
    productById.forEach((product, id) => {
      map.set(id, unitCost(product, { ingredientById, consumableCost }))
    })
    return map
  }, [productById, ingredientById, consumableCost])
  const unitCostOf = useMemo(() => (id) => costByProduct.get(id) ?? 0, [costByProduct])

  const deliveryOrders = useMemo(() => orders.filter((o) => o.channel === 'delivery'), [orders])
  const storeOrders = useMemo(() => orders.filter((o) => o.channel !== 'delivery'), [orders])

  const storeSales = useMemo(
    () => storeOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
    [storeOrders],
  )
  const deliveryTotal = useMemo(
    () => deliveryOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
    [deliveryOrders],
  )
  const totalSales = storeSales + deliveryTotal

  /** ค่า GP ที่แพลตฟอร์มหักไป — เป็นต้นทุนจริงที่เดิมไม่เคยถูกนับ */
  const deliveryRows = useMemo(
    () =>
      summarizeDelivery(orders, {
        rateFor,
        costOfOrder: (o) => orderCost(o, { unitCostOf, packagingCost }),
      }),
    [orders, rateFor, unitCostOf, packagingCost],
  )
  const gpFeeTotal = useMemo(() => deliveryRows.reduce((s, r) => s + r.fee, 0), [deliveryRows])

  const freebies = useMemo(
    () => summarizeFreebies(orders, { unitCostOf, nameOf: (id) => productById.get(id)?.name }),
    [orders, unitCostOf, productById],
  )
  const freebieCost = useMemo(() => freebies.reduce((s, f) => s + f.cost, 0), [freebies])

  const prevTotalSales = useMemo(
    () => prevOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
    [prevOrders],
  )

  const ingredientCost = useMemo(
    () => purchases.reduce((s, p) => s + (p.total_amount ?? 0), 0),
    [purchases],
  )
  const otherCost = useMemo(() => expenses.reduce((s, e) => s + (e.amount ?? 0), 0), [expenses])
  // กำไรต้องหักค่า GP ที่แพลตฟอร์มกินไปด้วย ไม่งั้นตัวเลขสูงเกินจริง
  const totalCost = ingredientCost + otherCost + gpFeeTotal
  const netProfit = totalSales - totalCost
  const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0

  // จำนวนบิลนับเฉพาะบิลหน้าร้าน ยอดเดลิเวอรีเป็นยอดรวมทั้งวันไม่ใช่บิลเดียว
  const orderCount = orders.length
  const prevOrderCount = prevOrders.length
  const avgOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0
  const prevAvgOrder = prevOrderCount > 0 ? Math.round(prevTotalSales / prevOrderCount) : 0

  /** วันนี้ดูเป็นรายชั่วโมง ช่วงยาวกว่านั้นดูเป็นรายวัน */
  const isSingleDay = from === to

  const chartData = useMemo(() => {
    if (isSingleDay) {
      const byHour = new Array(24).fill(0)
      orders.forEach((o) => {
        const d = o.created_at?.toDate?.()
        if (d) byHour[d.getHours()] += o.total_amount ?? 0
      })
      // ร้านริมทางไม่ได้ขายตอนตี 3 — ตัดชั่วโมงที่ไม่มียอดหัวท้ายทิ้ง
      const active = byHour.map((v, h) => ({ v, h })).filter((x) => x.v > 0)
      const startHour = active.length > 0 ? Math.max(0, Math.min(...active.map((x) => x.h)) - 1) : 8
      const endHour = active.length > 0 ? Math.min(23, Math.max(...active.map((x) => x.h)) + 1) : 22
      return byHour.slice(startHour, endHour + 1).map((value, i) => ({
        key: String(startHour + i),
        label: `${startHour + i}:00 น.`,
        shortLabel: `${startHour + i}`,
        value,
      }))
    }
    const byDate = {}
    orders.forEach((o) => {
      const d = docDateStr(o)
      if (d) byDate[d] = (byDate[d] ?? 0) + (o.total_amount ?? 0)
    })
    return eachDateInRange(from, to).map((date) => ({
      key: date,
      label: formatThaiDate(date),
      shortLabel: String(Number(date.slice(8, 10))),
      value: byDate[date] ?? 0,
    }))
  }, [orders, from, to, isSingleDay])

  const sparklineValues = useMemo(() => chartData.map((d) => d.value), [chartData])

  const selectedDetail = useMemo(() => {
    if (!selectedBar) return null
    const point = chartData.find((d) => d.key === selectedBar)
    if (!point) return null
    const count = isSingleDay
      ? orders.filter((o) => String(o.created_at?.toDate?.().getHours()) === selectedBar).length
      : orders.filter((o) => docDateStr(o) === selectedBar).length
    return { ...point, count }
  }, [selectedBar, chartData, orders, isSingleDay])

  const paymentBreakdown = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      ;(o.payments ?? []).forEach((p) => {
        const key = paymentLabel(p)
        map[key] = (map[key] ?? 0) + p.amount
      })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [orders])

  const topItems = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      ;(o.items ?? []).forEach((item) => {
        const key = item.product_id ?? item.name
        if (!map[key]) map[key] = { name: item.name, productId: item.product_id, qty: 0, total: 0 }
        map[key].qty += item.qty
        map[key].total += item.line_total ?? 0
      })
    })
    return Object.values(map)
      .map((d) => ({ ...d, unit: productById.get(d.productId)?.unit ?? 'ชิ้น' }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [orders, productById])

  const maxItemQty = topItems[0]?.qty ?? 1

  const lowStock = useMemo(
    () => activeProducts
      .filter((p) => (p.stock_qty ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0)),
    [activeProducts],
  )

  const damageSummary = useMemo(() => {
    const map = {}
    damageLogs.forEach((log) => {
      const product = productById.get(log.product_id)
      const name = product?.name ?? 'สินค้าที่ถูกลบแล้ว'
      const unit = product?.unit ?? 'ชิ้น'
      const price = product?.price ?? 0
      const qty = Math.abs(log.qty_change)
      if (!map[log.product_id]) map[log.product_id] = { name, unit, qty: 0, value: 0, reasons: new Set() }
      map[log.product_id].qty += qty
      map[log.product_id].value += qty * price
      if (log.note) map[log.product_id].reasons.add(log.note)
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  }, [damageLogs, productById])

  const totalDamageValue = damageSummary.reduce((s, d) => s + d.value, 0)
  const totalDamageQty = damageSummary.reduce((s, d) => s + d.qty, 0)

  const periodLabel = preset === 'month'
    ? formatThaiMonth(monthCursor)
    : isSingleDay ? 'วันนี้' : `${formatThaiDate(from)} – ${formatThaiDate(to)}`

  const isCurrentMonth = (() => {
    const now = new Date()
    return monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()
  })()

  const hasData = totalSales > 0 || totalCost > 0

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 bg-white px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-bold text-gray-800 text-base tracking-wide">แดชบอร์ด</h1>
          <div className="flex items-center gap-2 relative">
            <button type="button" onClick={() => setExportOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 transition-all"
              aria-label="ส่งออกข้อมูล">
              <Download size={14} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-10 z-20 w-52 rounded-2xl bg-white border border-gray-100 shadow-xl overflow-hidden">
                <button type="button"
                  onClick={() => { exportSalesCSV(orders, from, to); setExportOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50">
                  📄 ยอดขาย (CSV)
                </button>
                <button type="button"
                  onClick={() => { setPayoutOpen(true); setExportOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50 border-t border-gray-100">
                  💰 บันทึกรอบจ่ายเงินเดลิเวอรี
                </button>
                <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 leading-snug">
                  รายงานวัตถุดิบแบบ Excel อยู่ที่หน้าค่าใช้จ่าย
                </p>
              </div>
            )}
            <div className="flex bg-gray-100 rounded-full p-0.5">
              {RANGE_PRESETS.map((r) => (
                <button key={r.key} type="button"
                  onClick={() => { setPreset(r.key); setSelectedBar(null) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    preset === r.key ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {preset === 'month' && (
          <div className="flex items-center justify-end gap-1 mt-2">
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
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 max-w-5xl mx-auto w-full grid gap-2.5 lg:grid-cols-2 items-start">

          {/* ── กำไรสุทธิ + กราฟ ── */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5">
                กำไรสุทธิ · {periodLabel}
              </p>
              <div className="flex items-baseline gap-2">
                <p className={`font-black tabular-nums leading-none ${
                  netProfit > 0 ? 'text-emerald-600' : netProfit < 0 ? 'text-red-500' : 'text-gray-400'
                }`} style={{ fontSize: 'clamp(2.1rem, 8vw, 2.9rem)' }}>
                  {netProfit > 0 ? '+' : ''}{Math.round(netProfit).toLocaleString()}
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
              <div className="mt-1 -mx-1">
                <Sparkline values={sparklineValues} stroke={netProfit >= 0 ? '#10b981' : '#ef4444'} />
              </div>
            </div>

            {/* แถวตัวเลขรอง — ไม่ทำเป็นการ์ด เพื่อไม่แย่งความสำคัญกับกำไร */}
            <div className="grid grid-cols-3 border-t border-gray-100 divide-x divide-y divide-gray-100">
              <StatCell label="ยอดขายรวม" value={Math.round(totalSales).toLocaleString()}
                current={totalSales} previous={prevTotalSales} />
              <StatCell label="หน้าร้าน" value={Math.round(storeSales).toLocaleString()}
                current={storeSales} previous={null} />
              <StatCell label="เดลิเวอรี" value={Math.round(deliveryTotal).toLocaleString()}
                current={deliveryTotal} previous={null} />
              <StatCell label="ต้นทุนรวม" value={Math.round(totalCost).toLocaleString()}
                current={totalCost} previous={null} invert />
              <StatCell label="บิล" value={orderCount.toLocaleString()}
                current={orderCount} previous={prevOrderCount} />
              <StatCell label="เฉลี่ย/บิล" value={avgOrder.toLocaleString()}
                current={avgOrder} previous={prevAvgOrder} />
            </div>
          </div>

          {/* ── กราฟยอดขาย ── */}
          {hasData && (
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  {isSingleDay ? 'ยอดขายรายชั่วโมง' : 'ยอดขายรายวัน'}
                </p>
                {selectedDetail ? (
                  <p className="text-[11px] font-bold text-orange-600">
                    {selectedDetail.label} · {Math.round(selectedDetail.value).toLocaleString()} ฿
                    {selectedDetail.count > 0 ? ` · ${selectedDetail.count} บิล` : ''}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-300">แตะแท่งเพื่อดูรายละเอียด</p>
                )}
              </div>
              <BarChart
                data={chartData}
                selectedKey={selectedBar}
                onSelect={setSelectedBar}
                formatValue={(v) => `${Math.round(v).toLocaleString()} ฿`}
              />
            </div>
          )}

          {/* ── ต้นทุนแยกส่วน ── */}
          {totalCost > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">ต้นทุนแยกส่วน</p>
              <ShareBar
                total={totalCost}
                segments={[
                  { key: 'ingredient', label: 'วัตถุดิบ', value: ingredientCost, color: 'bg-orange-400' },
                  { key: 'gp', label: 'ค่า GP เดลิเวอรี', value: gpFeeTotal, color: 'bg-red-400' },
                  { key: 'other', label: 'ค่าใช้จ่ายอื่น', value: otherCost, color: 'bg-slate-400' },
                ]}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                <span className="text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1 align-middle" />
                  วัตถุดิบ {Math.round(ingredientCost).toLocaleString()} ฿
                </span>
                {gpFeeTotal > 0 && (
                  <span className="text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1 align-middle" />
                    ค่า GP {Math.round(gpFeeTotal).toLocaleString()} ฿
                  </span>
                )}
                <span className="text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1 align-middle" />
                  อื่น ๆ {Math.round(otherCost).toLocaleString()} ฿
                </span>
              </div>
              {ingredientCost === 0 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-2">
                  ยังไม่ได้บันทึกค่าวัตถุดิบในช่วงนี้ — กำไรที่แสดงจึงสูงกว่าความจริง
                </p>
              )}
            </div>
          )}

          {/* ── เดลิเวอรีแยกแอป ── */}
          {deliveryRows.length > 0 && (
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">เดลิเวอรีแยกแอป</p>
                <button type="button" onClick={() => setPayoutOpen(true)}
                  className="text-[11px] font-bold text-orange-600">
                  บันทึกรอบจ่ายเงิน
                </button>
              </div>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="text-left font-medium pb-1.5">แอป</th>
                      <th className="text-right font-medium pb-1.5">ยอดขาย</th>
                      <th className="text-right font-medium pb-1.5">หัก GP</th>
                      <th className="text-right font-medium pb-1.5">เงินเข้า</th>
                      <th className="text-right font-medium pb-1.5">กำไร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {deliveryRows.map((row) => (
                      <tr key={row.platform}>
                        <td className="py-1.5 pr-2">
                          <span className="font-semibold text-gray-700">{row.platform}</span>
                          <span className="block text-[10px] text-gray-400">
                            {row.orders} บิล · หัก {(row.rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">
                          {Math.round(row.gross).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-red-500">
                          −{Math.round(row.fee).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">
                          {Math.round(row.net).toLocaleString()}
                        </td>
                        <td className={`py-1.5 text-right tabular-nums font-bold ${
                          row.profit >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {Math.round(row.profit).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                กำไรหักทั้งค่า GP ค่าบรรจุภัณฑ์ และต้นทุนวัตถุดิบแล้ว
              </p>
            </div>
          )}

          {/* ── ของแถม ── */}
          {freebies.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ของแถมที่ให้ไป</p>
                <p className="text-xs font-bold text-amber-600 tabular-nums">
                  ต้นทุน {Math.round(freebieCost).toLocaleString()} ฿
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {freebies.map((f) => (
                  <div key={f.productId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">🎁 {f.name}</span>
                    <span className="font-semibold text-gray-700 tabular-nums shrink-0">
                      {f.qty} ชิ้น · {Math.round(f.cost).toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── สินค้าขายดี ── */}
          {topItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2.5">สินค้าขายดี</p>
              <div className="flex flex-col gap-2">
                {topItems.map((item, idx) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-semibold text-gray-700 truncate min-w-0">
                        <span className="mr-1.5">{['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}.`}</span>
                        {item.name}
                      </span>
                      <span className="text-xs shrink-0 tabular-nums">
                        <span className="font-bold text-gray-800">{item.qty} {item.unit}</span>
                        <span className="text-gray-400 ml-2">{item.total.toLocaleString()} ฿</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full"
                        style={{ width: `${Math.max((item.qty / maxItemQty) * 100, 3)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ช่องทางชำระ ── */}
          {paymentBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">ช่องทางชำระเงิน</p>
              <ShareBar
                total={paymentBreakdown.reduce((s, [, v]) => s + v, 0)}
                segments={paymentBreakdown.map(([label, value], i) => ({
                  key: label, label, value, color: PAYMENT_BAR_COLORS[i] ?? 'bg-gray-300',
                }))}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {paymentBreakdown.map(([label, value], i) => (
                  <span key={label} className="text-[11px] text-gray-500">
                    <span className={`inline-block w-2 h-2 rounded-sm mr-1 align-middle ${PAYMENT_BAR_COLORS[i] ?? 'bg-gray-300'}`} />
                    {label} {value.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── แถบเตือน — บาง ไม่ใช่การ์ดเต็ม ── */}
          {damageSummary.length > 0 && (
            <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <summary className="px-4 py-2.5 flex items-center gap-2 cursor-pointer list-none">
                <span className="w-1 h-8 rounded-full bg-red-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-700">ของเสียหาย/เครม</span>
                <span className="ml-auto text-xs font-bold text-red-500 tabular-nums">
                  {totalDamageQty} รายการ{totalDamageValue > 0 ? ` · ~${Math.round(totalDamageValue).toLocaleString()} ฿` : ''}
                </span>
              </summary>
              <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5 border-t border-gray-50">
                {damageSummary.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-600 truncate min-w-0">
                      {d.name}
                      {d.reasons.size > 0 && (
                        <span className="text-[11px] text-gray-400 ml-1.5">{[...d.reasons].join(', ')}</span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-red-500 shrink-0 tabular-nums">{d.qty} {d.unit}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {lowStock.length > 0 && (
            <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <summary className="px-4 py-2.5 flex items-center gap-2 cursor-pointer list-none">
                <span className="w-1 h-8 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-700">สินค้าใกล้หมด</span>
                <span className="ml-auto text-xs font-bold text-amber-600 tabular-nums">
                  {lowStock.length} รายการ
                </span>
              </summary>
              <div className="px-4 pb-3 pt-2 flex flex-wrap gap-1.5 border-t border-gray-50">
                {lowStock.map((p) => (
                  <span key={p.id}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      (p.stock_qty ?? 0) === 0
                        ? 'bg-red-500 text-white'
                        : (p.stock_qty ?? 0) <= CRITICAL_STOCK_THRESHOLD
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                    {p.name} {(p.stock_qty ?? 0) === 0 ? '(หมด)' : p.stock_qty}
                  </span>
                ))}
              </div>
            </details>
          )}

          {/* ── ว่าง ── */}
          {!hasData && (
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-3xl">📊</div>
              <p className="text-gray-400 text-sm font-medium">ไม่มีข้อมูลในช่วงนี้</p>
            </div>
          )}

        </div>
      </div>

      {payoutOpen && (
        <PayoutModal
          defaultGross={deliveryTotal}
          defaultFrom={from}
          defaultTo={to}
          onClose={() => setPayoutOpen(false)}
          onSaved={() => setPayoutOpen(false)}
        />
      )}
    </div>
  )
}

export default ReportsPage
