import { useMemo, useState } from 'react'
import { eachDateInRange, formatThaiDate, getPresetRange, getPreviousRange } from '../lib/dates'
import { trim } from '../lib/format'
import { useSauceBatchesInRange } from '../lib/useSauceBatches'
import { BarChart, DeltaBadge, ShareBar } from './Charts'

/**
 * รายงานการทำน้ำจิ้ม
 *
 * ตัวเลขในหน้านี้เป็น "ของที่ใช้ไป" ไม่ใช่ "เงินที่จ่ายเพิ่ม" — ห้ามเอาไปหักกำไรซ้ำ
 * เพราะเงินก้อนนี้ถูกนับไปแล้วสองทาง ตอนซื้อวัตถุดิบ (เข้าค่าใช้จ่าย)
 * และตอนขาย (เป็นต้นทุนต่อไม้) การทำน้ำจิ้มคือการแปรรูปของที่จ่ายไปแล้ว ไม่ใช่รายจ่ายใหม่
 *
 * ที่มีค่าที่สุดในหน้านี้คือเทรนด์ต้นทุนต่อชิ้น — บอกว่าน้ำจิ้มแพงขึ้นไหมเทียบช่วงก่อน
 */

const PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7days', label: '7 วัน' },
  { key: '30days', label: '30 วัน' },
  { key: 'month', label: 'เดือนนี้' },
]

function SauceReport({ sauces }) {
  const [preset, setPreset] = useState('30days')
  const { from, to } = getPresetRange(preset)
  const prev = getPreviousRange(from, to)

  const { batches, loading } = useSauceBatchesInRange(from, to)
  const { batches: prevBatches } = useSauceBatchesInRange(prev.from, prev.to)

  const summary = useMemo(() => summarize(batches), [batches])
  const prevSummary = useMemo(() => summarize(prevBatches), [prevBatches])

  const daily = useMemo(() => {
    const byDate = new Map()
    batches.forEach((b) => {
      byDate.set(b.date, (byDate.get(b.date) ?? 0) + (Number(b.total_cost) || 0))
    })
    return eachDateInRange(from, to).map((date) => ({
      key: date,
      label: formatThaiDate(date).replace(/ \d{4}$/, ''),
      value: byDate.get(date) ?? 0,
    }))
  }, [batches, from, to])

  const bySauce = useMemo(() => {
    const map = new Map()
    batches.forEach((b) => {
      const entry = map.get(b.sauce_id) ?? { name: b.sauce_name, pots: 0, cost: 0 }
      entry.pots += 1
      entry.cost += Number(b.total_cost) || 0
      map.set(b.sauce_id, entry)
    })
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v, icon: sauces.find((s) => s.id === id)?.icon ?? '🍲' }))
      .sort((a, b) => b.cost - a.cost)
  }, [batches, sauces])

  const byIngredient = useMemo(() => {
    const map = new Map()
    batches.forEach((b) => {
      ;(b.lines ?? []).forEach((line) => {
        const entry = map.get(line.ingredient_id) ?? { name: line.ingredient_name, amount: 0 }
        entry.amount += Number(line.amount) || 0
        map.set(line.ingredient_id, entry)
      })
    })
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 6)
  }, [batches])

  const [selectedDay, setSelectedDay] = useState(null)

  return (
    <>
      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => { setPreset(p.key); setSelectedDay(null) }}
            className={`flex-1 min-h-[38px] rounded-xl text-xs font-bold transition-colors ${
              preset === p.key ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-10">กำลังโหลด...</p>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-bold text-gray-600">ช่วงนี้ยังไม่ได้ทำน้ำจิ้ม</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="ทำไป" value={`${summary.pots}`} suffix="หม้อ" />
            <Stat label="ได้" value={trim(summary.yield)} suffix="รวม" />
            <Stat label="ต้นทุนรวม" value={Math.round(summary.cost).toLocaleString()} suffix="฿" />
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ต้นทุนน้ำจิ้มต่อชิ้น</p>
              {prevSummary.pots > 0 && (
                <DeltaBadge current={summary.costPerServe} previous={prevSummary.costPerServe} invert />
              )}
            </div>
            <p className="text-3xl font-black text-orange-600 tabular-nums">
              {summary.costPerServe.toFixed(2)} <span className="text-base text-gray-400 font-bold">฿</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              เฉลี่ยจาก {summary.pots} หม้อในช่วงนี้
              {prevSummary.pots > 0 && ` · ช่วงก่อน ${prevSummary.costPerServe.toFixed(2)} ฿`}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
              ต้นทุนน้ำจิ้มรายวัน
            </p>
            <BarChart data={daily} selectedKey={selectedDay} onSelect={setSelectedDay}
              formatValue={(v) => `${Math.round(v).toLocaleString()} ฿`} />
          </div>

          {bySauce.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              <p className="px-4 pt-3 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                แยกตามสูตร
              </p>
              {bySauce.map((row) => (
                <div key={row.id} className="px-4 py-2 border-t border-gray-50 flex items-center gap-2">
                  <span className="text-lg shrink-0">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{row.name}</p>
                    <p className="text-[11px] text-gray-400">{row.pots} หม้อ</p>
                  </div>
                  <span className="text-sm font-extrabold text-gray-800 tabular-nums shrink-0">
                    {Math.round(row.cost).toLocaleString()} ฿
                  </span>
                </div>
              ))}
            </div>
          )}

          {byIngredient.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
                วัตถุดิบที่กินเงินมากสุดในน้ำจิ้ม
              </p>
              <ShareBar
                segments={byIngredient.map((i, index) => ({
                  key: i.name,
                  label: i.name,
                  value: i.amount,
                  color: SHARE_COLORS[index % SHARE_COLORS.length],
                }))}
                total={byIngredient.reduce((s, i) => s + i.amount, 0)}
              />
              <div className="mt-2 flex flex-col gap-1">
                {byIngredient.map((i, index) => (
                  <div key={i.name} className="flex items-center gap-2 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${SHARE_COLORS[index % SHARE_COLORS.length]}`} />
                    <span className="flex-1 min-w-0 truncate text-gray-600">{i.name}</span>
                    <span className="font-bold text-gray-700 tabular-nums">{Math.round(i.amount).toLocaleString()} ฿</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-800 leading-relaxed">
        ℹ️ ตัวเลขในหน้านี้คือ<b>ของที่ใช้ไป</b> ไม่ใช่เงินที่จ่ายเพิ่ม อย่าเอาไปหักกำไรซ้ำ —
        เงินก้อนนี้ถูกนับไปแล้วตอนซื้อวัตถุดิบ (ในหน้าค่าใช้จ่าย) และตอนขาย (เป็นต้นทุนต่อไม้)
        การทำน้ำจิ้มคือการแปรรูปของที่จ่ายไปแล้ว ไม่ใช่รายจ่ายใหม่
      </p>
    </>
  )
}

const SHARE_COLORS = ['bg-orange-400', 'bg-red-400', 'bg-amber-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400']

function Stat({ label, value, suffix }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 px-3 py-2.5 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-lg font-black text-gray-800 tabular-nums leading-tight">
        {value} <span className="text-[10px] font-medium text-gray-400">{suffix}</span>
      </p>
    </div>
  )
}

function summarize(batches = []) {
  const pots = batches.length
  const cost = batches.reduce((s, b) => s + (Number(b.total_cost) || 0), 0)
  const serves = batches.reduce((s, b) => s + (Number(b.serves) || 0), 0)
  return {
    pots,
    cost,
    yield: batches.reduce((s, b) => s + (Number(b.yield_qty) || 0), 0),
    serves,
    // หารด้วยจำนวนชิ้นรวม ไม่ใช่เฉลี่ยของค่าเฉลี่ยรายหม้อ
    // หม้อใหญ่กับหม้อเล็กมีน้ำหนักไม่เท่ากัน การเฉลี่ยซ้อนเฉลี่ยจะเพี้ยน
    costPerServe: serves > 0 ? cost / serves : 0,
  }
}

export default SauceReport
