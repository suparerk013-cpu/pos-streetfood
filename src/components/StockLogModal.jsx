import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

const TYPE_CONFIG = {
  sale:       { label: 'ขายออก',    icon: '🛒', color: 'text-red-500',    bg: 'bg-red-50'    },
  restock:    { label: 'นำเข้า',    icon: '📦', color: 'text-green-600',  bg: 'bg-green-50'  },
  adjustment: { label: 'ปรับสต็อก', icon: '✏️', color: 'text-blue-500',   bg: 'bg-blue-50'   },
  void:       { label: 'คืนสต็อก',  icon: '↩️', color: 'text-purple-500', bg: 'bg-purple-50' },
}

function formatDateTime(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function StockLogModal({ product, onClose }) {
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'stock_logs'),
      where('product_id', '==', product.id),
      orderBy('created_at', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [product.id])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">ประวัติสต็อก</p>
            <p className="text-white font-bold text-base leading-tight">{product.name}</p>
            <p className="text-white/70 text-xs mt-0.5">คงเหลือ {product.stock_qty ?? 0} หน่วย</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
            ×
          </button>
        </div>

        {/* Logs */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-4xl">📋</span>
              <p className="text-gray-400 text-sm">ยังไม่มีประวัติสต็อก</p>
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="p-4 flex flex-col gap-2">
              {logs.map((log) => {
                const cfg = TYPE_CONFIG[log.type] ?? { label: log.type, icon: '•', color: 'text-gray-500', bg: 'bg-gray-50' }
                const isPositive = log.qty_change > 0
                return (
                  <div key={log.id} className={`rounded-2xl px-4 py-3 flex items-center justify-between ${cfg.bg} border border-white`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(log.created_at)}</p>
                        {log.note && (
                          <p className="text-xs text-gray-500 mt-0.5">{log.note}</p>
                        )}
                      </div>
                    </div>
                    <p className={`font-extrabold text-lg tabular-nums ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{log.qty_change}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StockLogModal
