import { useState } from 'react'
import { voidOrder } from '../lib/orders'

const METHOD_LABELS = { cash: 'เงินสด', promptpay: 'โมบายแบงค์กิ้ง', delivery: 'เดลิเวอรี่' }

function formatTime(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function BillModal({ order, onClose, onVoided }) {
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [voiding, setVoiding]         = useState(false)
  const [voidError, setVoidError]     = useState(null)

  if (!order) return null

  const payLine = (order.payments ?? [])
    .map((p) => `${p.platform ?? METHOD_LABELS[p.method] ?? p.method} ${p.amount.toLocaleString()}`)
    .join(' + ')

  const hasDiscount = (order.discount ?? 0) > 0

  const handleVoid = async () => {
    setVoiding(true); setVoidError(null)
    try {
      await voidOrder(order.id, order.items ?? [])
      onVoided?.()
      onClose()
    } catch (e) {
      setVoiding(false)
      setVoidError(e.message ?? 'ยกเลิกไม่สำเร็จ')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${order.is_voided ? 'bg-gray-400' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                {order.queue_no}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold">{formatTime(order.created_at)} น.</p>
                  {order.is_voided && (
                    <span className="text-[10px] font-bold bg-white/30 text-white rounded-full px-2 py-0.5 uppercase tracking-wide">
                      ยกเลิกแล้ว
                    </span>
                  )}
                </div>
                <p className="text-white/70 text-xs">{formatDate(order.created_at)}</p>
              </div>
            </div>
            <p className="text-white/80 text-xs mt-1">{payLine || '-'}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
            ×
          </button>
        </div>

        {/* Items */}
        <div className="px-5 py-4 flex flex-col gap-2.5 max-h-64 overflow-y-auto">
          {(order.items ?? []).length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">ไม่มีข้อมูลรายการ</p>
          )}
          {(order.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className={`font-semibold text-sm ${order.is_voided ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {item.name}
                </p>
                <p className="text-gray-400 text-xs">× {item.qty} ชิ้น</p>
              </div>
              <span className={`font-bold ${order.is_voided ? 'text-gray-400' : 'text-orange-600'}`}>
                {item.line_total.toLocaleString()} ฿
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-gray-100 px-5 py-3 flex flex-col gap-1.5">
          {hasDiscount && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>ราคาสินค้า</span>
                <span>{(order.subtotal ?? order.total_amount).toLocaleString()} ฿</span>
              </div>
              <div className="flex items-center justify-between text-sm text-green-600 font-semibold">
                <span>🏷️ ส่วนลด</span>
                <span>-{order.discount.toLocaleString()} ฿</span>
              </div>
              <div className="h-px bg-gray-100 my-0.5" />
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium text-sm">ยอดรวม</span>
            <span className={`text-2xl font-extrabold ${order.is_voided ? 'text-gray-400 line-through' : 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent'}`}>
              {(order.total_amount ?? 0).toLocaleString()} ฿
            </span>
          </div>
        </div>

        {/* Void section */}
        {order.is_voided ? (
          <div className="border-t border-gray-100 px-5 py-3 text-center bg-gray-50">
            <p className="text-xs font-bold text-gray-400">บิลนี้ถูกยกเลิกแล้ว — สต็อกได้รับการคืนแล้ว</p>
          </div>
        ) : (
          <div className="border-t border-gray-100 px-5 py-3">
            {voidError && (
              <p className="text-xs text-red-500 text-center mb-2">{voidError}</p>
            )}
            {!confirmVoid ? (
              <button type="button" onClick={() => setConfirmVoid(true)}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold active:bg-red-50 transition-all">
                ยกเลิกบิลนี้
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-600 text-center font-medium">
                  สต็อกสินค้าจะถูกคืน และยอดขายจะถูกตัดออก
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmVoid(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:scale-95 transition-all">
                    ไม่ยกเลิก
                  </button>
                  <button type="button" onClick={handleVoid} disabled={voiding}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 disabled:bg-red-300 text-white text-sm font-bold active:scale-95 transition-all">
                    {voiding ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default BillModal
