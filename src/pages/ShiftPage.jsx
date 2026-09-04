import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import ShiftSummaryModal from '../components/ShiftSummaryModal'
import { useAppData } from '../lib/appDataContext'
import { PLATFORM_CARD_COLORS, PLATFORM_ICONS } from '../lib/constants'
import { formatTime, toDateString } from '../lib/dates'
import { importDeliveryTotal } from '../lib/delivery'
import { db } from '../lib/firebase'
import { calcCashExpected, shiftCashDiff } from '../lib/shifts'
import { resetDailyStock } from '../lib/stock'
import { useOrdersForShift } from '../lib/useOrders'

function formatDate(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
}

function elapsed(ts) {
  if (!ts?.toDate) return ''
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 60000)
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`
}

function ShiftHistorySection({ shifts, onSelect }) {
  if (shifts.length === 0) return null
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">📋 ประวัติกะ</p>
        <p className="text-[10px] text-gray-300">{shifts.length} กะ</p>
      </div>
      <div className="divide-y divide-gray-50">
        {shifts.map((shift) => {
          const summary = shift.summary ?? {}
          // กะที่ปิดก่อนแก้บั๊กเก็บ cash_diff ที่คำนวณผิดไว้ — คิดใหม่จากตัวเลขดิบที่เก็บไว้ครบ
          const { diff } = shiftCashDiff(shift)
          const total = summary.total ?? 0
          const bills = summary.order_count ?? 0
          const diffColor = diff === 0 ? 'bg-green-100 text-green-700'
                          : diff > 0  ? 'bg-blue-100 text-blue-700'
                                      : 'bg-red-100 text-red-600'
          return (
            <button
              key={shift.id}
              type="button"
              onClick={() => onSelect(shift)}
              className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 leading-tight">
                  {formatDate(shift.opened_at)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatTime(shift.opened_at)} – {formatTime(shift.closed_at)} · {bills} บิล
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <div className="text-right">
                  <p className="text-sm font-extrabold text-gray-800 tabular-nums">{total.toLocaleString()} ฿</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diffColor}`}>
                    {diff >= 0 ? '+' : ''}{diff.toLocaleString()} ฿
                  </span>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ShiftPage() {
  const {
    currentShift,
    closedShifts,
    shiftsLoading,
    enabledPlatforms,
    activeProducts,
    online,
  } = useAppData()

  const [openingFloat, setOpeningFloat] = useState('500')
  const [opening, setOpening]           = useState(false)
  const [resetStock, setResetStock]     = useState(true)

  const [cashCounted, setCashCounted]       = useState('')
  const [closingNote, setClosingNote]       = useState('')
  const [closing, setClosing]               = useState(false)
  const [shiftSummary, setShiftSummary]     = useState(null)
  const [selectedHistory, setSelectedHistory] = useState(null)

  const [deliveryAmounts, setDeliveryAmounts] = useState({})
  const [importingPlatform, setImportingPlatform] = useState(null)
  const [importedPlatform, setImportedPlatform]   = useState(null)
  const [deliveryImports, setDeliveryImports] = useState([])

  const { orders: shiftOrders } = useOrdersForShift(currentShift?.id)

  // ยอดเดลิเวอรีของกะนี้ เก็บแยกจาก orders จึงต้องดึงมาบวกเอง
  useEffect(() => {
    if (!currentShift?.id) {
      setDeliveryImports([])
      return undefined
    }
    const q = query(
      collection(db, 'delivery_imports'),
      where('shift_id', '==', currentShift.id),
      limit(100),
    )
    return onSnapshot(q, (snap) => {
      setDeliveryImports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [currentShift?.id])

  const summary = useMemo(() => {
    let total = 0, cashSales = 0, promptpaySales = 0, changeTotal = 0
    shiftOrders.forEach((o) => {
      total += o.total_amount ?? 0
      ;(o.payments ?? []).forEach((p) => {
        if (p.method === 'cash') { cashSales += p.amount; changeTotal += p.change ?? 0 }
        else if (p.method === 'promptpay') promptpaySales += p.amount
      })
    })

    const deliverySales = {}
    deliveryImports.forEach((imp) => {
      const key = imp.platform ?? 'เดลิเวอรี่'
      deliverySales[key] = (deliverySales[key] ?? 0) + (imp.amount ?? 0)
    })
    const deliveryTotal = Object.values(deliverySales).reduce((s, v) => s + v, 0)

    return {
      total: total + deliveryTotal,
      storeTotal: total,
      cashSales,
      promptpaySales,
      deliverySales,
      deliveryTotal,
      changeTotal,
      cashExpected: calcCashExpected(currentShift?.opening_float, cashSales),
      orderCount: shiftOrders.length,
    }
  }, [shiftOrders, deliveryImports, currentShift])

  const cashDiff = cashCounted !== '' ? Number(cashCounted) - summary.cashExpected : null

  const handleOpenShift = async () => {
    if (currentShift || !online) return
    setOpening(true)
    try {
      await addDoc(collection(db, 'shifts'), {
        status: 'open', opened_at: serverTimestamp(), closed_at: null,
        opening_float: Number(openingFloat) || 0, cash_counted: null, summary: null,
      })
      // สินค้าที่ตั้งเป็นสต็อกรายวันต้องเริ่มนับใหม่ทุกกะ ไม่งั้นยอดค้างจากเมื่อวาน
      if (resetStock) {
        const dailyProducts = activeProducts.filter(
          (p) => p.stock_type === 'daily' && (p.stock_qty ?? 0) !== 0,
        )
        await Promise.all(dailyProducts.map((p) => resetDailyStock(p.id)))
      }
    } finally { setOpening(false) }
  }

  const handleCloseShift = async () => {
    if (!currentShift || cashCounted === '' || !online) return
    setClosing(true)
    try {
      const counted = Number(cashCounted)
      const diff    = counted - summary.cashExpected
      const closedSummary = {
        order_count: summary.orderCount, total: summary.total,
        store_total: summary.storeTotal,
        cash_sales: summary.cashSales, promptpay_sales: summary.promptpaySales,
        delivery_sales: summary.deliverySales, delivery_total: summary.deliveryTotal,
        change_total: summary.changeTotal, cash_expected: summary.cashExpected,
        cash_diff: diff, opening_float: currentShift.opening_float ?? 0,
        cash_counted: counted,
        closing_note: closingNote.trim() || null,
      }
      await updateDoc(doc(db, 'shifts', currentShift.id), {
        status: 'closed', closed_at: serverTimestamp(),
        cash_counted: counted, closing_note: closingNote.trim() || null,
        summary: closedSummary,
      })
      setShiftSummary({
        ...closedSummary,
        openedAt: currentShift.opened_at,
        closedAt: { toDate: () => new Date() },
      })
      setCashCounted(''); setClosingNote('')
    } finally { setClosing(false) }
  }

  const handleImportDelivery = async (platform) => {
    const amount = Number(deliveryAmounts[platform])
    if (!amount || amount <= 0 || !online) return
    setImportingPlatform(platform)
    try {
      await importDeliveryTotal({
        platform,
        amount,
        date: toDateString(),
        shiftId: currentShift?.id ?? null,
      })
      setDeliveryAmounts((prev) => ({ ...prev, [platform]: '' }))
      setImportedPlatform(platform)
      setTimeout(() => setImportedPlatform(null), 2000)
    } finally {
      setImportingPlatform(null)
    }
  }

  if (shiftsLoading) return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">กำลังโหลด...</p>
    </div>
  )

  if (shiftSummary) return (
    <ShiftSummaryModal
      summary={shiftSummary}
      openedAt={shiftSummary.openedAt}
      closedAt={shiftSummary.closedAt}
      onClose={() => setShiftSummary(null)}
    />
  )

  /* ─────────────── ยังไม่มีกะ ─────────────── */
  if (!currentShift) return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-3 shadow-sm flex items-center gap-2">
        <span className="text-base">🔓</span>
        <h1 className="font-bold text-lg">เปิดกะ</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Open shift card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-400" />
          <div className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">เงินทอนตั้งต้นในลิ้นชัก</p>
              <input
                type="number" inputMode="numeric"
                value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="500"
                className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-5 py-4 text-4xl font-extrabold text-gray-800 text-center focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
              />
              <div className="flex gap-2 mt-2">
                {[500, 1000, 2000].map((v) => (
                  <button key={v} type="button" onClick={() => setOpeningFloat(String(v))}
                    className="flex-1 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold active:bg-orange-100 transition-colors">
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={resetStock}
                onChange={(e) => setResetStock(e.target.checked)}
                className="w-5 h-5 accent-orange-500 shrink-0"
              />
              <span className="text-sm text-gray-600 leading-snug">
                ล้างสต็อกสินค้าที่ตั้งเป็น <span className="font-semibold">สต็อกรายวัน</span> ให้เริ่มนับใหม่
              </span>
            </label>

            <button type="button" onClick={handleOpenShift} disabled={opening || !online}
              className="w-full min-h-[60px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-xl shadow-xl shadow-orange-200 active:scale-95 transition-all">
              {opening ? 'กำลังเปิดกะ...' : online ? '🔓 เปิดกะ' : 'ออฟไลน์ — เปิดกะไม่ได้'}
            </button>
          </div>
        </div>

        <ShiftHistorySection shifts={closedShifts} onSelect={setSelectedHistory} />
      </div>

      {selectedHistory && (
        <ShiftSummaryModal
          summary={{ ...selectedHistory.summary, cash_counted: selectedHistory.cash_counted, closing_note: selectedHistory.closing_note }}
          openedAt={selectedHistory.opened_at}
          closedAt={selectedHistory.closed_at}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </div>
  )

  /* ─────────────── กะกำลังทำงาน ─────────────── */
  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">

      {/* Header — สีเขียว แสดงสถานะกะ */}
      <header className="shrink-0 bg-gradient-to-r from-green-500 to-emerald-600 px-4 pt-3 pb-4 shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">กะกำลังทำงาน</p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white font-extrabold text-2xl leading-tight">
              เปิด {formatTime(currentShift.opened_at)} น.
            </p>
            <p className="text-white/60 text-xs mt-0.5">
              {elapsed(currentShift.opened_at)} · ทอนตั้งต้น {(currentShift.opening_float ?? 0).toLocaleString()} ฿
            </p>
          </div>
          {/* Mini stats */}
          <div className="text-right">
            <p className="text-white font-extrabold text-3xl tabular-nums leading-tight">{summary.total.toLocaleString()}</p>
            <p className="text-white/60 text-xs">{summary.orderCount} บิล</p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3">

          {/* ── ยอดแยกประเภท ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ยอดขายแยกประเภท</p>
            </div>
            <div className="px-4 pb-3 mt-1 flex flex-col gap-2">
              {[
                { label: '💵 เงินสด', value: summary.cashSales, color: 'from-green-400 to-emerald-500' },
                { label: '📱 โมบายแบงค์กิ้ง', value: summary.promptpaySales, color: 'from-blue-400 to-indigo-500' },
                ...Object.entries(summary.deliverySales).map(([p, v]) => ({
                  label: `${PLATFORM_ICONS[p] ?? '🛵'} ${p}`, value: v, color: 'from-orange-400 to-red-400',
                })),
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{row.label}</span>
                    <span className="text-xs font-extrabold text-gray-800 tabular-nums">{row.value.toLocaleString()} ฿</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${row.color} rounded-full transition-all duration-500`}
                      style={{ width: summary.total > 0 ? `${Math.max((row.value / summary.total) * 100, row.value > 0 ? 3 : 0)}%` : '0%' }} />
                  </div>
                </div>
              ))}
              {summary.changeTotal > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-1">
                  <span className="text-xs text-gray-400">เงินทอนที่จ่ายไป</span>
                  <span className="text-xs font-bold text-gray-500 tabular-nums">{summary.changeTotal.toLocaleString()} ฿</span>
                </div>
              )}
            </div>
          </div>

          {/* ── นับเงินปิดกะ ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
            <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">🔒 นับเงินปิดกะ</p>

              {/* ควรมี vs นับได้ — side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-2xl px-3 py-3 text-center border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">ควรมีในลิ้นชัก</p>
                  <p className="text-orange-500 font-extrabold text-2xl tabular-nums leading-tight">
                    {summary.cashExpected.toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    ทอนตั้งต้น {(currentShift.opening_float ?? 0).toLocaleString()} + เงินสด {summary.cashSales.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-dashed border-gray-200 px-3 py-3 text-center relative">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">นับได้จริง</p>
                  <input
                    type="number" inputMode="numeric"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    placeholder={String(summary.cashExpected)}
                    className="w-full text-center bg-transparent text-gray-800 font-extrabold text-2xl tabular-nums focus:outline-none placeholder:text-gray-300"
                  />
                  <p className="text-gray-400 text-[10px] mt-0.5">฿</p>
                </div>
              </div>

              {/* ผลต่าง */}
              {cashDiff !== null && (
                <div className={`rounded-2xl px-4 py-3 flex items-center justify-between ${
                  cashDiff === 0 ? 'bg-green-50 border border-green-100' :
                  cashDiff > 0  ? 'bg-blue-50 border border-blue-100' :
                                  'bg-red-50 border border-red-100'
                }`}>
                  <span className="text-sm font-semibold text-gray-600">
                    {cashDiff === 0 ? '✅ เงินครบ' : cashDiff > 0 ? '💙 เงินเกิน' : '⚠️ เงินขาด'}
                  </span>
                  <span className={`font-extrabold text-2xl tabular-nums ${
                    cashDiff === 0 ? 'text-green-600' : cashDiff > 0 ? 'text-blue-600' : 'text-red-500'
                  }`}>
                    {cashDiff >= 0 ? '+' : ''}{cashDiff.toLocaleString()} ฿
                  </span>
                </div>
              )}

              {/* หมายเหตุ */}
              {cashDiff !== null && (
                <textarea
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder={cashDiff < 0 ? '⚠️ ระบุสาเหตุที่เงินขาด เช่น ทอนเงินผิด, ลืมบันทึกบิล...' : 'หมายเหตุปิดกะ (ถ้ามี)...'}
                  rows={2}
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none transition-all ${
                    cashDiff < 0
                      ? 'border-red-200 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-red-400'
                      : 'border-gray-200 bg-gray-50 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                  }`}
                />
              )}

              <button type="button" onClick={handleCloseShift}
                disabled={closing || cashCounted === '' || !online}
                className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-extrabold text-lg shadow-lg shadow-red-200 active:scale-95 transition-all">
                {closing ? 'กำลังปิดกะ...'
                  : !online ? 'ออฟไลน์ — ปิดกะไม่ได้'
                  : cashCounted === '' ? 'กรอกยอดเงินก่อนปิดกะ'
                  : '🔒 ยืนยันปิดกะ'}
              </button>
            </div>
          </div>

          {/* ── เดลิเวอรี่จากแอพ ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">🛵 บันทึกยอดเดลิเวอรี่จากแอพ</p>
              <p className="text-[10px] text-gray-300">กรอกยอดรวมวันนี้</p>
            </div>
            <div className="px-4 pb-4 mt-2 grid grid-cols-2 gap-2.5">
              {enabledPlatforms.map((p) => (
                <div key={p} className={`rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all ${PLATFORM_CARD_COLORS[p] ?? 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{PLATFORM_ICONS[p] ?? '🛵'}</span>
                    <span className="text-xs font-bold text-gray-700 truncate">{p}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" inputMode="numeric"
                      value={deliveryAmounts[p] ?? ''}
                      onChange={(e) => setDeliveryAmounts((prev) => ({ ...prev, [p]: e.target.value }))}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-white rounded-xl border border-white/60 px-2 py-1.5 text-sm font-extrabold text-right focus:outline-none w-full"
                    />
                    <span className="text-[10px] text-gray-500 shrink-0">฿</span>
                  </div>
                  <button type="button"
                    onClick={() => handleImportDelivery(p)}
                    disabled={!deliveryAmounts[p] || importingPlatform === p || !online}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      importedPlatform === p
                        ? 'bg-green-500 text-white'
                        : 'bg-white/70 text-gray-600 disabled:text-gray-300'
                    }`}>
                    {importingPlatform === p ? '...' : importedPlatform === p ? '✓ บันทึกแล้ว' : 'บันทึก'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── ประวัติกะ ── */}
          <ShiftHistorySection shifts={closedShifts} onSelect={setSelectedHistory} />

        </div>
      </div>

      {/* Modal ดูรายละเอียดกะ */}
      {selectedHistory && (
        <ShiftSummaryModal
          summary={{ ...selectedHistory.summary, cash_counted: selectedHistory.cash_counted, closing_note: selectedHistory.closing_note }}
          openedAt={selectedHistory.opened_at}
          closedAt={selectedHistory.closed_at}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </div>
  )
}

export default ShiftPage
