import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { trim } from '../lib/format'

/**
 * เตือนว่าของจะหมด — พาดหัวบอกจำนวนหม้อ กางออกเห็นทีละตัวว่าใครเหลือเท่าไหร่
 *
 * ของหมดไม่พร้อมกัน การบอกแค่ "ทำได้อีก 1 หม้อ" จึงไม่พอ ต้องเห็นด้วยว่า
 * ตัวไหนคือตัวที่ฉุดอยู่ และตัวอื่นเหลือเท่าไหร่ จะได้ตัดสินใจได้ว่าไปตลาดรอบเดียวซื้ออะไรบ้าง
 */

const TONE = {
  out: { box: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: '🔴' },
  low: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: '🟡' },
  ok: { box: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500', label: '🟢' },
  unknown: { box: 'bg-gray-50 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-300', label: '⚪' },
}

function headline(stock) {
  if (!stock.hasRecipe) return 'ยังไม่มีสูตร — บันทึกหม้อแรกก่อน ระบบถึงจะรู้ว่าใช้อะไรเท่าไหร่'
  if (stock.blocking.length > 0) {
    return `ทำหม้อถัดไปไม่ได้ — ${stock.blocking.map((l) => l.name).join(', ')}ไม่พอ`
  }
  if (stock.pots == null) return 'ยังไม่ได้นับสต็อกวัตถุดิบของสูตรนี้'
  if (stock.low.length > 0) return `ทำได้อีก ${stock.pots} หม้อ — ${stock.low[0].name}จะหมดก่อน`
  return `ทำได้อีก ${stock.pots} หม้อ`
}

function SauceStockAlert({ stock, onEditIngredient }) {
  const [open, setOpen] = useState(stock.level === 'out')
  const tone = TONE[stock.level] ?? TONE.unknown

  return (
    <div className={`rounded-xl border ${tone.box} overflow-hidden`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left">
        {stock.level === 'out'
          ? <AlertTriangle size={15} className="text-red-500 shrink-0" />
          : <span className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />}
        <span className={`flex-1 min-w-0 text-xs font-bold ${tone.text}`}>{headline(stock)}</span>
        {stock.lines.length > 0 && (
          <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && stock.lines.length > 0 && (
        <div className="px-3 pb-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left font-medium pb-1">วัตถุดิบ</th>
                <th className="text-right font-medium pb-1">ใช้/หม้อ</th>
                <th className="text-right font-medium pb-1">เหลือ</th>
                <th className="text-right font-medium pb-1">ทำได้อีก</th>
              </tr>
            </thead>
            <tbody>
              {stock.lines.map((line) => {
                const lineTone = TONE[line.level] ?? TONE.unknown
                return (
                  <tr key={line.ingredient_id} className="border-t border-black/5">
                    <td className="py-1">
                      <button type="button" onClick={() => onEditIngredient?.(line.ingredient_id)}
                        className="text-gray-700 underline decoration-dotted underline-offset-2">
                        {line.name}
                      </button>
                    </td>
                    <td className="text-right tabular-nums text-gray-500">{trim(line.need)} {line.unit}</td>
                    <td className="text-right tabular-nums text-gray-500">
                      {line.tracked ? `${trim(line.have)} ${line.unit}` : '—'}
                    </td>
                    <td className={`text-right tabular-nums font-bold ${lineTone.text}`}>
                      {line.tracked ? `${lineTone.label} ${line.pots} หม้อ` : '⚪ ยังไม่นับ'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {stock.unknown.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-1.5">
              แตะชื่อวัตถุดิบเพื่อใส่จำนวนที่เหลือ ตัวที่ยังไม่ได้นับจะไม่ถูกนับว่าของหมด
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default SauceStockAlert
