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
import { logSnapshotError } from '../lib/snapshotError'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ModalBackdrop from '../components/ModalBackdrop'
import Numpad from '../components/Numpad'
import ShiftSummaryModal from '../components/ShiftSummaryModal'
import { useAppData } from '../lib/appDataContext'
import { PLATFORM_CARD_COLORS, PLATFORM_ICONS } from '../lib/constants'
import { formatTime, toDateString } from '../lib/dates'
import { deleteDeliveryImport, importDeliveryTotal } from '../lib/delivery'
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
  // นาฬิกาเครื่องเพี้ยนทำให้ค่าติดลบได้ ปัดขึ้นเป็น 0 แทนที่จะโชว์ "-26 นาที"
  const diff = Math.max(0, Math.floor((Date.now() - ts.toDate().getTime()) / 60000))
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
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [showBills, setShowBills] = useState(false)
  const [countingOpen, setCountingOpen] = useState(false)
  const [countDraft, setCountDraft] = useState('0')

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
    }, logSnapshotError('ยอดเดลิเวอรีที่บันทึกไว้'))
  }, [currentShift?.id])

  const summary = useMemo(() => {
    let total = 0, storeTotal = 0, cashSales = 0, promptpaySales = 0, changeTotal = 0
    const deliverySales = {}

    shiftOrders.forEach((o) => {
      const amount = o.total_amount ?? 0
      total += amount
      if (o.channel === 'delivery') {
        const key = o.platform ?? 'เดลิเวอรี่'
        deliverySales[key] = (deliverySales[key] ?? 0) + amount
      } else {
        storeTotal += amount
      }
      ;(o.payments ?? []).forEach((pay) => {
        if (pay.method === 'cash') { cashSales += pay.amount; changeTotal += pay.change ?? 0 }
        else if (pay.method === 'promptpay') promptpaySales += pay.amount
      })
    })

    const deliveryTotal = Object.values(deliverySales).reduce((sum, v) => sum + v, 0)

    return {
      total,
      storeTotal,
      cashSales,
      promptpaySales,
      deliverySales,
      deliveryTotal,
      changeTotal,
      cashExpected: calcCashExpected(currentShift?.opening_float, cashSales),
      orderCount: shiftOrders.length,
    }
  }, [shiftOrders, currentShift])

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
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-black tabular-nums leading-none"
              style={{ fontSize: 'clamp(2.1rem, 9vw, 3rem)' }}>
              {summary.total.toLocaleString()}
              <span className="text-lg font-bold opacity-70 ml-1.5">฿</span>
            </p>
            <p className="text-white/70 text-xs mt-1">
              {summary.orderCount} บิล · เปิด {formatTime(currentShift.opened_at)} น. · {elapsed(currentShift.opened_at)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white/60 text-[10px] uppercase tracking-wider">ทอนตั้งต้น</p>
            <p className="text-white font-bold tabular-nums">
              {(currentShift.opening_float ?? 0).toLocaleString()} ฿
            </p>
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
                <button type="button" onClick={() => setCountingOpen(true)}
                  className="rounded-2xl border-2 border-dashed border-gray-300 px-3 py-3 text-center active:bg-gray-50 transition-colors">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">นับได้จริง</p>
                  <p className={`font-extrabold text-2xl tabular-nums leading-tight ${
                    cashCounted === '' ? 'text-gray-300' : 'text-gray-800'
                  }`}>
                    {cashCounted === '' ? 'แตะเพื่อกรอก' : Number(cashCounted).toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">฿</p>
                </button>
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

              {cashCounted === '' ? (
                <p className="text-center text-sm text-gray-400 py-2">
                  นับเงินในลิ้นชักแล้วกรอกยอดด้านบนก่อนปิดกะ
                </p>
              ) : (
                <button type="button" onClick={handleCloseShift}
                  disabled={closing || !online}
                  className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-extrabold text-lg shadow-lg shadow-red-200 active:scale-95 transition-all">
                  {closing ? 'กำลังปิดกะ...' : !online ? 'ออฟไลน์ — ปิดกะไม่ได้' : '🔒 ยืนยันปิดกะ'}
                </button>
              )}
            </div>
          </div>

          {/* ── เทียบยอดเดลิเวอรีกับแอป ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button type="button" onClick={() => setDeliveryOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left">
              <span className="text-base shrink-0">🛵</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 leading-tight">เทียบยอดเดลิเวอรี</p>
                <p className="text-[11px] text-gray-400 leading-tight">
                  {summary.deliveryTotal > 0
                    ? `POS บันทึกไว้ ${summary.deliveryTotal.toLocaleString()} ฿`
                    : 'ยังไม่มีออเดอร์เดลิเวอรีในกะนี้'}
                </p>
              </div>
              <ChevronDown size={16}
                className={`text-gray-300 shrink-0 transition-transform ${deliveryOpen ? 'rotate-180' : ''}`} />
            </button>

            {deliveryOpen && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3 flex flex-col gap-2.5">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  กรอกยอดที่แอปแจ้งเพื่อเช็คว่าลืมคีย์ออเดอร์ไหนหรือเปล่า
                  ยอดขายจริงมาจากบิลที่คิดเงินในระบบ ไม่ได้มาจากช่องนี้
                </p>

                {enabledPlatforms.map((p) => {
                  const posAmount = summary.deliverySales[p] ?? 0
                  const entered = Number(deliveryAmounts[p])
                  const diff = entered > 0 ? entered - posAmount : null
                  return (
                    <div key={p} className={`rounded-2xl border-2 p-3 flex flex-col gap-2 ${PLATFORM_CARD_COLORS[p] ?? 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base">{PLATFORM_ICONS[p] ?? '🛵'}</span>
                          <span className="text-xs font-bold text-gray-700 truncate">{p}</span>
                        </span>
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">
                          POS {posAmount.toLocaleString()} ฿
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" inputMode="numeric"
                          value={deliveryAmounts[p] ?? ''}
                          onChange={(e) => setDeliveryAmounts((prev) => ({ ...prev, [p]: e.target.value }))}
                          placeholder="ยอดจากแอป"
                          aria-label={`ยอดจากแอป ${p}`}
                          className="flex-1 min-w-0 bg-white rounded-xl border border-white/60 px-2 py-1.5 text-sm font-extrabold text-right focus:outline-none"
                        />
                        <button type="button"
                          onClick={() => handleImportDelivery(p)}
                          disabled={!deliveryAmounts[p] || importingPlatform === p || !online}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            importedPlatform === p ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-600 disabled:text-gray-300'
                          }`}>
                          {importingPlatform === p ? '...' : importedPlatform === p ? '✓ บันทึก' : 'บันทึก'}
                        </button>
                      </div>

                      {diff !== null && (
                        <p className={`text-[11px] font-semibold ${
                          diff === 0 ? 'text-green-600' : 'text-amber-700'
                        }`}>
                          {diff === 0
                            ? '✓ ตรงกัน'
                            : diff > 0
                              ? `ต่าง +${diff.toLocaleString()} ฿ — อาจมีออเดอร์ที่ลืมคีย์`
                              : `ต่าง ${diff.toLocaleString()} ฿ — POS มากกว่าที่แอปแจ้ง`}
                        </p>
                      )}
                    </div>
                  )
                })}

                {/* รายการที่บันทึกไปแล้ว — เดิมกดซ้ำได้โดยไม่มีที่ให้ดูหรือลบ ยอดเลยเบิ้ลได้ */}
                {deliveryImports.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      บันทึกไว้แล้วในกะนี้
                    </p>
                    {deliveryImports.map((imp) => (
                      <div key={imp.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-xs text-gray-600 truncate">
                          {PLATFORM_ICONS[imp.platform] ?? '🛵'} {imp.platform}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-gray-700 tabular-nums">
                            {(imp.amount ?? 0).toLocaleString()} ฿
                          </span>
                          <button type="button" onClick={() => deleteDeliveryImport(imp.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            aria-label={`ลบยอด ${imp.platform}`}>
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── บิลของกะนี้ ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button type="button" onClick={() => setShowBills((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left">
              <span className="text-base shrink-0">🧾</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 leading-tight">บิลของกะนี้</p>
                <p className="text-[11px] text-gray-400 leading-tight">{shiftOrders.length} ใบ · ใช้ไล่ดูตอนเงินไม่ตรง</p>
              </div>
              <ChevronDown size={16}
                className={`text-gray-300 shrink-0 transition-transform ${showBills ? 'rotate-180' : ''}`} />
            </button>
            {showBills && (
              <div className="border-t border-gray-50 divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {shiftOrders.length === 0 && (
                  <p className="px-4 py-4 text-sm text-gray-400 text-center">ยังไม่มีบิลในกะนี้</p>
                )}
                {shiftOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="text-sm font-bold text-gray-700">#{o.queue_no}</span>
                      <span className="text-[11px] text-gray-400 ml-2">
                        {formatTime(o.created_at)} น.
                        {o.channel === 'delivery' ? ` · ${PLATFORM_ICONS[o.platform] ?? '🛵'} ${o.platform ?? ''}` : ''}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-gray-800 tabular-nums shrink-0">
                      {(o.total_amount ?? 0).toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── ประวัติกะ ── */}
          <ShiftHistorySection shifts={closedShifts} onSelect={setSelectedHistory} />

        </div>
      </div>

      {countingOpen && (
        <ModalBackdrop onClose={() => setCountingOpen(false)} maxWidthClass="max-w-sm">
          <div className="p-5 flex flex-col gap-3">
            <div>
              <p className="font-extrabold text-gray-800 text-lg leading-tight">นับเงินในลิ้นชัก</p>
              <p className="text-xs text-gray-400 mt-0.5">
                นับให้ครบก่อนกรอก อย่าดูยอดที่ระบบคำนวณไว้
              </p>
            </div>
            <Numpad
              value={countDraft}
              onChangeValue={setCountDraft}
              quickAmounts={[500, 1000, 2000]}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setCountingOpen(false)}
                className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm">
                ยกเลิก
              </button>
              <button type="button"
                onClick={() => { setCashCounted(countDraft === '0' ? '0' : countDraft); setCountingOpen(false) }}
                className="flex-[2] min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-extrabold">
                ยืนยันยอดที่นับได้
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

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
