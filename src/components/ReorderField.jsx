import { entryUnitsFor } from '../lib/sauceCost'
import { trim } from '../lib/format'

/**
 * ช่องตั้งจุดสั่งซื้อ — "เหลือน้อยกว่าเท่านี้ต้องซื้อ"
 *
 * ใช้ทั้งตอนเพิ่มวัตถุดิบใหม่ในหน้าค่าใช้จ่ายและตอนแก้ทะเบียนทีหลัง จะได้ตั้งได้ตั้งแต่
 * ครั้งแรกที่บันทึกซื้อ ไม่ต้องจำว่าต้องกลับมาตั้งอีกที
 *
 * กรอกเป็นหน่วยย่อยได้ถ้าวัตถุดิบตั้งขนาดบรรจุไว้ — น้ำปลาซื้อเป็นขวดแต่ตั้งเตือนที่
 * 200 มล. ได้ เพราะเวลามองขวดที่เหลืออยู่คนคิดเป็นมิลลิลิตร ไม่ได้คิดเป็นเศษขวด
 */
function ReorderField({ ingredient, qty, unit, onChange, label = 'เตือนเมื่อเหลือน้อยกว่า' }) {
  const units = entryUnitsFor(ingredient)
  const buyUnit = ingredient?.unit ?? 'หน่วย'
  const active = unit && unit !== buyUnit
  const divisor = Number(ingredient?.content_qty) || 0
  const inBuyUnit = active && divisor > 0 ? (Number(qty) || 0) / divisor : Number(qty) || 0

  return (
    <div>
      <span className="text-xs font-medium text-gray-500">
        {label} <span className="text-gray-300">(ไม่ใส่ก็ได้)</span>
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number" inputMode="decimal" step="any" min="0"
          value={qty}
          onChange={(e) => onChange(e.target.value, unit || buyUnit)}
          placeholder="0"
          aria-label={label}
          className="flex-1 min-w-0 min-h-[48px] rounded-xl border-2 border-gray-200 px-3 text-sm text-right font-bold focus:outline-none focus:border-orange-500"
        />
        {units.length > 1 ? (
          <select
            value={unit || buyUnit}
            onChange={(e) => onChange(qty, e.target.value)}
            aria-label="หน่วยของจุดสั่งซื้อ"
            className="w-20 shrink-0 min-h-[48px] rounded-xl border-2 border-gray-200 bg-white px-1 text-xs focus:outline-none focus:border-orange-500"
          >
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : (
          <span className="w-14 shrink-0 text-xs text-gray-500 truncate">{buyUnit}</span>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        {Number(qty) > 0 ? (
          <>
            เหลือน้อยกว่า {trim(qty)} {unit || buyUnit}
            {active && divisor > 0 && ` (${trim(inBuyUnit)} ${buyUnit})`} เมื่อไหร่ จะขึ้นในรายการซื้อของ
          </>
        ) : (
          'ไม่ใส่ก็ได้ — ระบบจะเตือนจากสูตรน้ำจิ้มให้เองว่าเหลือทำได้อีกกี่หม้อ'
        )}
      </p>
    </div>
  )
}

export default ReorderField
