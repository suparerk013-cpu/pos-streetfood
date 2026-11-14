import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { logSnapshotError } from '../lib/snapshotError'
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
  formatThaiDate,
  formatThaiMonth,
  getMonthRange,
  getPresetRange,
  getPreviousRange,
  rangeToTimestamps,
  toDateString,
} from '../lib/dates'
import { db } from '../lib/firebase'
import { summarizeDelivery, summarizeFreebies } from '../lib/deliveryReport'
import { effectiveRates } from '../lib/payoutMath'
import {
  groupByShift,
  hourlyWithinShift,
  netOfOrders,
  orderWindow,
  ordersInShiftRange,
  shiftLabel,
  shiftTimeRange,
  toDate,
  totalsFromSummaries,
} from '../lib/shiftSales'
import { useExpensesInRange, usePayouts, usePurchasesInRange } from '../lib/usePurchases'
import { useOrdersBetween, useOrdersForShift, useShiftsInRange } from '../lib/useOrders'

/**
 * หน้าแดชบอร์ดดูเป็นกะ ไม่ใช่วันในปฏิทิน
 * ร้านขายสี่โมงเย็นถึงตีหนึ่ง ถ้าแบ่งตามเที่ยงคืนรอบขายเดียวจะถูกผ่าเป็นสองวัน
 */
const RANGE_PRESETS = [
  { key: 'shift', label: 'กะนี้' },
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
    return onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      logSnapshotError('ประวัติสต็อก'),
    )
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
    gpRateFor,
    currentShift,
    shifts: recentShifts,
  } = useAppData()
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [preset, setPreset] = useState('shift')
  // กะที่กดเข้าไปดูจากกราฟหรือปุ่มกะก่อน/ถัดไป — null คือกะนี้ (หรือกะล่าสุดถ้าไม่ได้เปิด)
  const [focusShift, setFocusShift] = useState(null)
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedBar, setSelectedBar] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const isShiftView = preset === 'shift'
  const latestShift = currentShift ?? recentShifts.find((s) => s.status === 'closed') ?? null
  // กะที่ยังเปิดอยู่ต้องใช้ตัวที่ฟังสดจาก context เสมอ ตัวที่เก็บไว้ใน state จะไม่รู้ว่าปิดไปแล้ว
  const viewShift = isShiftView
    ? (focusShift && focusShift.id !== currentShift?.id ? focusShift : latestShift)
    : null

  const viewShiftDate = toDate(viewShift?.opened_at)
  const { from, to } = isShiftView
    ? (() => {
        const day = toDateString(viewShiftDate ?? new Date())
        return { from: day, to: day }
      })()
    : preset === 'month' ? getMonthRange(monthCursor) : getPresetRange(preset)

  // ── กะในช่วงที่เลือก ──
  const { shifts: rangeShifts, loading: shiftsLoading } = useShiftsInRange(
    isShiftView ? null : from,
    isShiftView ? null : to,
  )
  const openInRange = useMemo(
    () => rangeShifts.find((s) => s.status === 'open') ?? null,
    [rangeShifts],
  )

  // ── บิล ──
  // กะเดียว: ฟังสดตลอด  /  หลายกะ: ดึงย้อนหลังทีเดียวให้ครบ แล้วเอาบิลสดของกะที่ยังเปิดมาเติม
  const { orders: liveShiftOrders, loading: liveLoading } = useOrdersForShift(
    isShiftView ? viewShift?.id : openInRange?.id,
  )
  // ช่วงเวลาไม่นับกะที่ยังเปิด เพราะบิลกะนั้นมาจากตัวฟังสดอยู่แล้ว
  // ถ้าเอาเวลาตอนนี้มาเป็นขอบ ขอบจะเลื่อนทุกครั้งที่วาดจอแล้วดึงบิลย้อนหลังใหม่ไม่หยุด
  const window = useMemo(
    () => (isShiftView ? null : orderWindow(from, to, rangeShifts.filter((s) => s.status === 'closed'))),
    [isShiftView, from, to, rangeShifts],
  )
  const { orders: pastOrders, loading: pastLoading, truncated } = useOrdersBetween(window?.start, window?.end)

  const orders = useMemo(() => {
    if (isShiftView) return liveShiftOrders
    const past = openInRange ? pastOrders.filter((o) => o.shift_id !== openInRange.id) : pastOrders
    const merged = openInRange ? [...past, ...liveShiftOrders] : past
    return ordersInShiftRange(merged, rangeShifts, from, to)
  }, [isShiftView, liveShiftOrders, pastOrders, openInRange, rangeShifts, from, to])

  const loading = isShiftView ? (Boolean(viewShift) && liveLoading) : (shiftsLoading || pastLoading)

  // ── เทียบช่วงก่อน — อ่านจากสรุปที่เก็บไว้ตอนปิดกะ ถูกกว่านับบิลใหม่หลายสิบเท่า ──
  const prevRange = isShiftView ? null : getPreviousRange(from, to)
  const { shifts: prevShifts } = useShiftsInRange(prevRange?.from, prevRange?.to)
  const shiftIndex = recentShifts.findIndex((s) => s.id === viewShift?.id)
  const olderShift = shiftIndex >= 0 ? recentShifts[shiftIndex + 1] ?? null : null
  const newerShift = shiftIndex > 0 ? recentShifts[shiftIndex - 1] : null
  const prevTotals = useMemo(() => {
    if (isShiftView) {
      // กะที่ยังขายอยู่ห้ามเทียบกับกะที่ปิดแล้ว ยอดครึ่งกะเทียบยอดเต็มกะจะขึ้นลูกศรแดงลงตลอด
      // จนกว่าจะปิดร้าน ทำให้ตกใจทั้งที่ขายปกติ
      if (viewShift?.status === 'open') return null
      return olderShift ? totalsFromSummaries([olderShift]) : null
    }
    return totalsFromSummaries(prevShifts)
  }, [isShiftView, viewShift, olderShift, prevShifts])

  const payouts = usePayouts()
  const { purchases } = usePurchasesInRange(from, to)
  const { expenses } = useExpensesInRange(from, to)
  const damageLogs = useDamageLogs(from, to)

  /** อัตราที่ถูกหักจริง — ใช้จากรอบจ่ายเงินล่าสุดถ้ามี ไม่มีก็ใช้ค่าที่ตั้งไว้ */
  const rateFor = useMemo(() => effectiveRates(payouts, gpRateFor), [payouts, gpRateFor])

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
  /** เงินที่เข้ากระเป๋าจริง หลังแอปเดลิเวอรีหัก GP */
  const totalNet = useMemo(() => netOfOrders(orders, rateFor), [orders, rateFor])

  const deliveryRows = useMemo(() => summarizeDelivery(orders, { rateFor }), [orders, rateFor])
  const gpFeeTotal = useMemo(() => deliveryRows.reduce((s, r) => s + r.fee, 0), [deliveryRows])

  // นับแค่จำนวนชิ้นที่แจกไป ไม่คิดเป็นเงิน — ระบบเลิกคิดต้นทุนต่อชิ้นแล้วเพราะตัวเลขไม่ตรงของจริง
  const freebies = useMemo(
    () => summarizeFreebies(orders, { nameOf: (id) => productById.get(id)?.name }),
    [orders, productById],
  )

  const prevTotalSales = prevTotals?.gross ?? null
  const prevOrderCount = prevTotals?.count ?? null

  // รายจ่ายคือเงินที่จดไว้จริงในหน้าค่าใช้จ่าย ไม่ใช่ต้นทุนที่ระบบเดาจากสูตร
  // ของเก่าที่บันทึกแบบซื้อวัตถุดิบยังอยู่ในอีก collection หนึ่ง ต้องรวมด้วยไม่งั้นรายจ่ายย้อนหลังหาย
  const recordedExpense = useMemo(
    () =>
      purchases.reduce((s, p) => s + (p.total_amount ?? 0), 0) +
      expenses.reduce((s, e) => s + (e.amount ?? 0), 0),
    [purchases, expenses],
  )
  // เงินเหลือต้องหักค่า GP ที่แพลตฟอร์มกินไปด้วย ไม่งั้นตัวเลขสูงเกินจริง
  const totalCost = recordedExpense + gpFeeTotal
  const netProfit = totalSales - totalCost
  const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0

  const orderCount = orders.length
  const avgOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0

  const shiftRows = useMemo(
    () => (isShiftView ? [] : groupByShift(orders, rangeShifts, { rateFor })),
    [isShiftView, orders, rangeShifts, rateFor],
  )

  const chartData = useMemo(() => {
    if (isShiftView) return viewShift ? hourlyWithinShift(orders, viewShift) : []
    return shiftRows.map((r) => ({
      key: r.key,
      label: `${r.label} ${r.timeRange}`,
      shortLabel: r.label,
      value: r.gross,
      muted: r.isOutside,
    }))
  }, [isShiftView, viewShift, orders, shiftRows])

  const sparklineValues = useMemo(() => chartData.map((d) => d.value), [chartData])

  const selectedDetail = useMemo(() => {
    if (!selectedBar) return null
    if (isShiftView) {
      const point = chartData.find((d) => d.key === selectedBar)
      return point ? { label: point.label, gross: point.value, count: point.count ?? null } : null
    }
    const row = shiftRows.find((r) => r.key === selectedBar)
    if (!row) return null
    return {
      label: row.isOutside ? 'นอกกะ' : `กะ ${row.label} · ${row.timeRange}`,
      gross: row.gross,
      net: row.net,
      count: row.count,
      shift: row.shiftId ? rangeShifts.find((s) => s.id === row.shiftId) ?? null : null,
      isOutside: row.isOutside,
    }
  }, [selectedBar, isShiftView, chartData, shiftRows, rangeShifts])

  /** เปิดดูกะที่เลือกเต็ม ๆ — ตอบเรื่อง "ดูยอดของวันที่แล้วไม่ได้" */
  const openShift = (shift) => {
    setFocusShift(shift)
    setPreset('shift')
    setSelectedBar(null)
  }

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

  const periodLabel = isShiftView
    ? (viewShift ? `กะ ${shiftLabel(viewShift)} · ${shiftTimeRange(viewShift)}` : 'ยังไม่เคยเปิดกะ')
    : preset === 'month' ? formatThaiMonth(monthCursor) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`

  const isCurrentMonth = (() => {
    const now = new Date()
    return monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()
  })()

  const hasData = totalSales > 0 || totalCost > 0

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 bg-orange-500 text-white px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/75 font-semibold truncate">
              {isShiftView ? 'ดูทีละกะ' : `${shiftRows.filter((r) => !r.isOutside).length} กะในช่วงนี้`}
            </p>
            <h1 className="text-xl font-black leading-tight">รายงาน</h1>
          </div>
          <div className="flex items-center gap-2 relative">
            <button type="button" onClick={() => setExportOpen((v) => !v)}
              className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition-all"
              aria-label="ส่งออกข้อมูล">
              <Download size={18} />
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
                  ไฟล์ Excel รายจ่ายอยู่ที่หน้ารายจ่าย
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {RANGE_PRESETS.map((r) => (
            <button key={r.key} type="button"
              onClick={() => { setPreset(r.key); setSelectedBar(null); setFocusShift(null) }}
              className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-bold transition-colors ${
                preset === r.key ? 'bg-white text-orange-600' : 'bg-white/20 text-white'
              }`}>
              {r.key === 'shift' && !currentShift ? 'กะล่าสุด' : r.label}
            </button>
          ))}
        </div>
      </header>

      {((isShiftView && viewShift) || preset === 'month') && (
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2">

        {isShiftView && viewShift && (
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={!olderShift}
              onClick={() => { setFocusShift(olderShift); setSelectedBar(null) }}
              className="min-h-[40px] px-3 rounded-full bg-gray-100 disabled:opacity-30 flex items-center gap-1 text-xs font-bold text-gray-600"
              aria-label="กะก่อนหน้า">
              <ChevronLeft size={15} /> กะก่อน
            </button>
            <span className="text-xs font-bold text-gray-600 text-center min-w-0 truncate">
              {viewShift.id === currentShift?.id && <span className="text-emerald-600">● เปิดอยู่ · </span>}
              {shiftLabel(viewShift)} · {shiftTimeRange(viewShift)}
            </span>
            <button type="button" disabled={!newerShift}
              onClick={() => { setFocusShift(newerShift); setSelectedBar(null) }}
              className="min-h-[40px] px-3 rounded-full bg-gray-100 disabled:opacity-30 flex items-center gap-1 text-xs font-bold text-gray-600"
              aria-label="กะถัดไป">
              กะถัดไป <ChevronRight size={15} />
            </button>
          </div>
        )}

        {preset === 'month' && (
          <div className="flex items-center justify-end gap-1">
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
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 max-w-5xl mx-auto w-full grid gap-2.5 lg:grid-cols-2 items-start">

          {/* ── กำไรสุทธิ + กราฟ ── */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5">
                เหลือหลังหักรายจ่าย · {periodLabel}
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
              <StatCell label="เงินเข้าจริง" value={Math.round(totalNet).toLocaleString()}
                current={totalNet} previous={null} />
              <StatCell label="รายจ่าย" value={Math.round(totalCost).toLocaleString()}
                current={totalCost} previous={null} invert />
              <StatCell label="หน้าร้าน" value={Math.round(storeSales).toLocaleString()}
                current={storeSales} previous={null} />
              <StatCell label="เดลิเวอรี" value={Math.round(deliveryTotal).toLocaleString()}
                current={deliveryTotal} previous={null} />
              <StatCell label={`บิล · เฉลี่ย ${avgOrder.toLocaleString()} ฿`} value={orderCount.toLocaleString()}
                current={orderCount} previous={prevOrderCount} />
            </div>
          </div>

          {/* ── บิลไม่ครบ — เกินเพดานที่ดึงได้ ต้องบอก ไม่ใช่โชว์ยอดต่ำกว่าจริงเงียบ ๆ ── */}
          {truncated && (
            <p className="lg:col-span-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
              ช่วงนี้มีบิลมากเกินกว่าที่ดึงมาได้ในครั้งเดียว ตัวเลขอาจต่ำกว่าความจริง — ลองเลือกช่วงที่สั้นลง
            </p>
          )}

          {/* ── กราฟยอดขาย — หลายวันเป็นแท่งละกะ วันเดียวเป็นรายชั่วโมงในกะนั้น ── */}
          {hasData && (
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  {isShiftView ? 'ยอดขายรายชั่วโมงในกะ' : 'ยอดขายรายกะ'}
                </p>
                {!selectedDetail && (
                  <p className="text-[10px] text-gray-300">แตะแท่งเพื่อดูรายละเอียด</p>
                )}
              </div>
              <BarChart
                data={chartData}
                selectedKey={selectedBar}
                onSelect={setSelectedBar}
                formatValue={(v) => `${Math.round(v).toLocaleString()} ฿`}
              />

              {selectedDetail && (
                <div className={`mt-3 rounded-xl px-3 py-2.5 ${
                  selectedDetail.isOutside ? 'bg-gray-50 border border-gray-200' : 'bg-orange-50 border border-orange-100'
                }`}>
                  <p className="text-xs font-bold text-gray-700">{selectedDetail.label}</p>
                  <p className="text-lg font-black text-gray-800 tabular-nums">
                    {Math.round(selectedDetail.gross).toLocaleString()} ฿
                    {selectedDetail.count != null && (
                      <span className="text-xs font-semibold text-gray-400 ml-1.5">{selectedDetail.count} บิล</span>
                    )}
                  </p>
                  {selectedDetail.net != null && Math.round(selectedDetail.net) !== Math.round(selectedDetail.gross) && (
                    <p className="text-[11px] text-gray-500">
                      เงินเข้าจริงหลังหัก GP {Math.round(selectedDetail.net).toLocaleString()} ฿
                    </p>
                  )}
                  {selectedDetail.isOutside && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      บิลที่ขายตอนไม่ได้เปิดกะ — เปิดกะก่อนขายทุกครั้ง ยอดจะได้เข้าวันที่ถูกต้อง
                    </p>
                  )}
                  {selectedDetail.shift && (
                    <button type="button" onClick={() => openShift(selectedDetail.shift)}
                      className="mt-2 w-full min-h-[44px] rounded-xl bg-white border border-orange-200 text-sm font-bold text-orange-600 active:bg-orange-100">
                      ดูกะนี้ทั้งหมด ›
                    </button>
                  )}
                </div>
              )}

              {/* รายการกะ — ยอดขายคู่กับเงินเข้าจริง แตะแถวเพื่อเปิดดูกะนั้น */}
              {!isShiftView && shiftRows.length > 0 && (
                <div className="mt-3 border-t border-gray-100 divide-y divide-gray-50">
                  {[...shiftRows].reverse().map((row) => {
                    const shift = row.shiftId ? rangeShifts.find((x) => x.id === row.shiftId) : null
                    return (
                      <button key={row.key} type="button" disabled={!shift}
                        onClick={() => shift && openShift(shift)}
                        className="w-full flex items-center gap-2 py-2 text-left disabled:cursor-default">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${row.isOutside ? 'text-gray-500' : 'text-gray-800'}`}>
                            {row.isOpen && <span className="text-emerald-600">● </span>}
                            {row.isOutside ? 'นอกกะ' : `กะ ${row.label}`}
                            <span className="text-[11px] font-medium text-gray-400 ml-1.5">{row.timeRange}</span>
                          </p>
                          {Math.round(row.net) !== Math.round(row.gross) && (
                            <p className="text-[11px] text-gray-400">
                              เงินเข้าจริง {Math.round(row.net).toLocaleString()} ฿
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-extrabold text-gray-800 tabular-nums shrink-0">
                          {Math.round(row.gross).toLocaleString()} ฿
                        </span>
                        {shift && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── รายจ่ายแยกส่วน — เงินที่จดไว้จริง กับค่า GP ที่แอปหัก ── */}
          {totalCost > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">รายจ่ายแยกส่วน</p>
              <ShareBar
                total={totalCost}
                segments={[
                  { key: 'recorded', label: 'รายจ่ายที่จดไว้', value: recordedExpense, color: 'bg-orange-400' },
                  { key: 'gp', label: 'ค่า GP เดลิเวอรี', value: gpFeeTotal, color: 'bg-red-400' },
                ]}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                <span className="text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1 align-middle" />
                  รายจ่ายที่จดไว้ {Math.round(recordedExpense).toLocaleString()} ฿
                </span>
                {gpFeeTotal > 0 && (
                  <span className="text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1 align-middle" />
                    ค่า GP {Math.round(gpFeeTotal).toLocaleString()} ฿
                  </span>
                )}
              </div>
            </div>
          )}
          {totalSales > 0 && recordedExpense === 0 && (
            <p className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[11px] text-amber-700">
              ยังไม่ได้จดรายจ่ายในช่วงนี้ — ตัวเลขเหลือหลังหักรายจ่ายจึงสูงกว่าความจริง
            </p>
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
                <table className="w-full min-w-[20rem] text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="text-left font-medium pb-1.5">แอป</th>
                      <th className="text-right font-medium pb-1.5">ยอดขาย</th>
                      <th className="text-right font-medium pb-1.5">หัก GP</th>
                      <th className="text-right font-medium pb-1.5">เงินเข้า</th>
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
                        <td className="py-1.5 text-right tabular-nums font-bold text-gray-800">
                          {Math.round(row.net).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ของแถม ── */}
          {freebies.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ของแถมที่ให้ไป</p>
              </div>
              <div className="flex flex-col gap-1">
                {freebies.map((f) => (
                  <div key={f.productId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">🎁 {f.name}</span>
                    <span className="font-semibold text-gray-700 tabular-nums shrink-0">
                      {f.qty} ชิ้น
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
              <p className="text-gray-400 text-sm font-medium">
                {loading ? 'กำลังโหลด...' : isShiftView && !viewShift ? 'ยังไม่เคยเปิดกะ' : 'ไม่มีข้อมูลในช่วงนี้'}
              </p>
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
