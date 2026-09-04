import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import BillModal from '../components/BillModal'
import { paymentLabel } from '../lib/constants'
import { docDateStr, formatDate, formatTime, getPresetRange } from '../lib/dates'
import { useOrdersInRange } from '../lib/useOrders'

const RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
]

const orderDateStr = (order) => docDateStr(order)

function DocumentsPage() {
  const [search, setSearch]           = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showVoided, setShowVoided]   = useState(false)
  const [preset, setPreset]           = useState('7days')

  const { from, to } = getPresetRange(preset)
  const { orders, loading } = useOrdersInRange(from, to, { includeVoided: true })

  const activeOrders  = useMemo(() => orders.filter((o) => !o.is_voided), [orders])
  const voidedOrders  = useMemo(() => orders.filter((o) => o.is_voided), [orders])
  const baseOrders    = showVoided ? orders : activeOrders

  const displayed = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return baseOrders
    return baseOrders.filter((o) => {
      if (String(o.queue_no).includes(term)) return true
      const date = orderDateStr(o) ?? ''
      if (date.includes(term)) return true
      const payLine = (o.payments ?? []).map(paymentLabel).join(' ').toLowerCase()
      if (payLine.includes(term)) return true
      const itemNames = (o.items ?? []).map((i) => i.name).join(' ').toLowerCase()
      if (itemNames.includes(term)) return true
      return false
    })
  }, [baseOrders, search])

  const grouped = useMemo(() => {
    const groups = []
    let lastDate = null
    displayed.forEach((o) => {
      const date = orderDateStr(o)
      if (date !== lastDate) {
        groups.push({ type: 'date', date })
        lastDate = date
      }
      groups.push({ type: 'order', order: o })
    })
    return groups
  }, [displayed])

  const handleVoided = () => setSelectedOrder(null)

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">เอกสาร / บิล</h1>
          {!loading && (
            <span className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 font-medium">
              {activeOrders.length} บิล
            </span>
          )}
        </div>
        <div className="flex gap-1.5 mt-2">
          {RANGE_PRESETS.map((r) => (
            <button key={r.key} type="button" onClick={() => setPreset(r.key)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                preset === r.key ? 'bg-white text-orange-600' : 'bg-white/20 text-white/80'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Search + filter bar */}
      <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-100 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3.5 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="search"
            inputMode="search"
            placeholder="ค้นหา เลขบิล สินค้า วิธีชำระ วันที่..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="text-gray-400 hover:text-gray-600 shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          {search ? (
            <p className="text-xs text-gray-400">พบ {displayed.length} บิล จาก {baseOrders.length}</p>
          ) : <span />}
          {voidedOrders.length > 0 && (
            <button type="button" onClick={() => setShowVoided((v) => !v)}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                showVoided
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
              {showVoided ? '✕ ซ่อนบิลที่ยกเลิก' : `แสดงบิลที่ยกเลิก (${voidedOrders.length})`}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">กำลังโหลด...</p>
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
            <span className="text-5xl">🗂️</span>
            <p className="text-gray-400 text-sm">
              {search ? 'ไม่พบบิลที่ค้นหา' : 'ไม่มีบิลในช่วงเวลานี้'}
            </p>
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="text-orange-500 text-sm font-semibold">
                ล้างการค้นหา
              </button>
            )}
          </div>
        )}

        {!loading && displayed.length > 0 && (
          <div className="p-3 flex flex-col gap-1">
            {grouped.map((row, i) => {
              if (row.type === 'date') {
                return (
                  <div key={`date-${row.date}-${i}`} className="px-2 pt-3 pb-1 first:pt-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{row.date}</p>
                  </div>
                )
              }
              const o = row.order
              const isVoided = o.is_voided
              const payLine = (o.payments ?? []).map(paymentLabel).join(' · ')
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrder(o)}
                  className={`w-full rounded-2xl px-4 py-3 flex items-center justify-between border shadow-sm active:scale-[0.98] transition-all text-left group ${
                    isVoided
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : 'bg-white border-gray-100 active:bg-orange-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm ${
                      isVoided ? 'bg-gray-400' : 'bg-gradient-to-br from-orange-400 to-red-400'
                    }`}>
                      {o.queue_no}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-bold ${isVoided ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {formatTime(o.created_at)} น.
                          <span className="font-normal ml-2">{formatDate(o.created_at)}</span>
                        </p>
                        {isVoided && (
                          <span className="text-[9px] font-bold bg-red-100 text-red-500 rounded-full px-1.5 py-0.5">ยกเลิก</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {payLine || '-'} · {(o.items ?? []).length} รายการ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className={`font-extrabold text-sm ${isVoided ? 'text-gray-400 line-through' : 'text-orange-600'}`}>
                      {(o.total_amount ?? 0).toLocaleString()} ฿
                    </span>
                    <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BillModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onVoided={handleVoided} />
    </div>
  )
}

export default DocumentsPage
