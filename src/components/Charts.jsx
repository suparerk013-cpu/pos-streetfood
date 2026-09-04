import { useId } from 'react'

/**
 * กราฟแท่งยอดขาย — วาดด้วย div ไม่ใช้ไลบรารีกราฟ
 * แอปนี้ต้องเบาเพราะรันบนมือถือหน้าร้าน กราฟที่ใช้จริงมีแค่ 3 แบบจึงวาดเองคุ้มกว่า
 */
export function BarChart({ data, selectedKey, onSelect, height = 128, formatValue }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const nonZero = data.filter((d) => d.value > 0)
  const average = nonZero.length > 0
    ? nonZero.reduce((s, d) => s + d.value, 0) / nonZero.length
    : 0
  const averagePct = max > 0 ? (average / max) * 100 : 0
  // ป้ายกำกับแกนนอนจะทับกันถ้าแท่งเยอะ จึงเว้นระยะตามจำนวนแท่ง
  const labelStep = data.length > 20 ? 5 : data.length > 10 ? 2 : 1

  return (
    <div>
      <div className="relative" style={{ height }}>
        {average > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-gray-300 z-0"
            style={{ bottom: `${averagePct}%` }}
          >
            <span className="absolute right-0 -top-4 text-[9px] font-semibold text-gray-400 bg-white px-1">
              เฉลี่ย {Math.round(average).toLocaleString()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0
            const isSelected = selectedKey === d.key
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onSelect?.(isSelected ? null : d.key)}
                title={`${d.label} · ${formatValue ? formatValue(d.value) : d.value.toLocaleString()}`}
                className="relative flex-1 min-w-0 h-full flex items-end group"
                aria-label={`${d.label} ${d.value.toLocaleString()}`}
              >
                <span
                  className={`w-full rounded-t-[3px] transition-all ${
                    isSelected
                      ? 'bg-gradient-to-t from-red-500 to-orange-400'
                      : d.value > 0
                      ? 'bg-orange-300 group-hover:bg-orange-400'
                      : 'bg-gray-100'
                  }`}
                  style={{ height: `${Math.max(pct, d.value > 0 ? 2 : 1)}%` }}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 min-w-0 text-center text-[9px] text-gray-400 tabular-nums truncate"
          >
            {i % labelStep === 0 ? d.shortLabel ?? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** เส้นแนวโน้มเล็ก ๆ ใต้ตัวเลขสรุป */
export function Sparkline({ values, stroke = '#f97316', height = 34 }) {
  const gradientId = useId()
  // ยังไม่มียอดขายเลย เส้นแบนติดขอบล่างจะดูเหมือนเส้นขีดหลงมา — ไม่ต้องวาดดีกว่า
  if (values.length < 2 || values.every((v) => v === 0)) return <div style={{ height }} />

  const max = Math.max(...values)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const stepX = 100 / (values.length - 1)

  const points = values.map((v, i) => [i * stepX, 100 - ((v - min) / span) * 100])
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L100,100 L0,100 Z`
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height, width: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** แถบเดียวแบ่งสัดส่วน ใช้แทนการไล่การ์ดทีละหมวด */
export function ShareBar({ segments, total, height = 'h-2.5' }) {
  if (total <= 0) return null
  return (
    <div className={`flex ${height} rounded-full overflow-hidden bg-gray-100`}>
      {segments.map((s) => (
        s.value > 0 ? (
          <div
            key={s.key}
            className={s.color}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label} ${s.value.toLocaleString()} ฿`}
          />
        ) : null
      ))}
    </div>
  )
}

/** ตัวเลขสรุปพร้อมลูกศรเทียบช่วงก่อนหน้า */
export function DeltaBadge({ current, previous, invert = false, suffix = 'เทียบช่วงก่อน' }) {
  if (previous == null || previous === 0) return null
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (change === 0) {
    return <span className="text-[11px] font-bold text-gray-400">เท่าเดิม</span>
  }
  const isGood = invert ? change < 0 : change > 0
  return (
    <span className={`text-[11px] font-bold ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
      {change > 0 ? '↑' : '↓'}{Math.abs(change)}% <span className="font-medium text-gray-400">{suffix}</span>
    </span>
  )
}
