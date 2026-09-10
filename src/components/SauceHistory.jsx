import { ChevronDown, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate } from '../lib/dates'
import { trim } from '../lib/format'
import { useRecentSauceBatches } from '../lib/useSauceBatches'

/**
 * ประวัติการทำน้ำจิ้มทุกหม้อ
 *
 * เดิมประวัติซ่อนอยู่หลังปุ่มเล็ก ๆ ในการ์ดของแต่ละสูตร ต้องรู้ก่อนว่ามีถึงจะกดเจอ
 * แยกออกมาเป็นแท็บของตัวเองแล้วเลื่อนดูได้ทีเดียวทุกสูตร เทียบหม้อต่อหม้อได้ว่าแพงขึ้นไหม
 */
function SauceHistory({ sauces, onDeleteBatch, busy }) {
  const { batches, loading, atLimit } = useRecentSauceBatches()
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  const shown = useMemo(
    () => (filter === 'all' ? batches : batches.filter((b) => b.sauce_id === filter)),
    [batches, filter],
  )

  if (loading) return <p className="text-center text-gray-400 text-sm py-10">กำลังโหลด...</p>

  if (batches.length === 0) {
    return (
      <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-8 text-center">
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm font-bold text-gray-600">ยังไม่เคยบันทึกทำน้ำจิ้ม</p>
        <p className="text-xs text-gray-400 mt-1">บันทึกหม้อแรกที่แท็บ &quot;สูตร&quot;</p>
      </div>
    )
  }

  return (
    <>
      {sauces.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="ทุกสูตร" />
          {sauces.map((s) => (
            <FilterChip key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)}
              label={`${s.icon ?? '🍲'} ${s.name}`} />
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        {shown.map((batch) => {
          const open = openId === batch.id
          return (
            <div key={batch.id} className="border-b border-gray-50 last:border-0">
              <button type="button" onClick={() => setOpenId(open ? null : batch.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {batch.sauce_name}
                    <span className="text-gray-400 font-medium"> · {Number(batch.total_cost ?? 0).toFixed(2)} ฿</span>
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {formatDate(batch.created_at)} · ได้ {trim(batch.yield_qty)} · {batch.serves} ชิ้น
                    <span className="text-orange-600 font-bold"> ({Number(batch.cost_per_serve ?? 0).toFixed(2)} ฿/ชิ้น)</span>
                    {batch.note && ` · ${batch.note}`}
                  </p>
                </div>
                <ChevronDown size={15} className={`shrink-0 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="px-4 pb-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                    {(batch.lines ?? []).map((line, index) => (
                      <div key={`${line.ingredient_id}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <span className="text-xs text-gray-600 truncate">{line.ingredient_name}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {trim(line.qty)} {line.entry_unit ?? line.unit}
                          {line.base_qty != null && line.entry_unit !== line.unit && ` (${trim(line.base_qty)} ${line.unit})`}
                        </span>
                        <span className="text-xs font-bold text-gray-700 tabular-nums shrink-0 w-16 text-right">
                          {Number(line.amount ?? 0).toFixed(2)} ฿
                        </span>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => onDeleteBatch(batch)} disabled={busy}
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-red-500 disabled:opacity-40">
                    <Trash2 size={12} /> ลบหม้อนี้
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {atLimit && (
        <p className="text-[11px] text-gray-400 px-1">
          แสดง 100 หม้อล่าสุด — ดูสรุปย้อนหลังไกลกว่านี้ได้ที่แท็บรายงาน
        </p>
      )}
    </>
  )
}

function FilterChip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
        active ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-500'
      }`}>
      {label}
    </button>
  )
}

export default SauceHistory
