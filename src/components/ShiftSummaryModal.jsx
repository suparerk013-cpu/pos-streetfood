import { useRef, useState } from 'react'
import { PLATFORM_ICONS } from '../lib/constants'
import { calcCashExpected } from '../lib/shifts'
import ModalBackdrop from './ModalBackdrop'

function Row({ label, value, valueColor = 'text-gray-800', bold = false }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-extrabold' : 'font-semibold'} ${valueColor}`}>{value}</span>
    </div>
  )
}

function ShiftSummaryModal({ summary, openedAt, closedAt, shopName = 'หมึกย่าง หอยแมลงภู่', onClose }) {
  const [copied, setCopied] = useState(false)
  const printRef = useRef(null)

  // คิดใหม่จากตัวเลขดิบเสมอ กะที่ปิดก่อนแก้บั๊กเก็บ cash_expected/cash_diff ที่ผิดไว้
  const cashExpected = calcCashExpected(summary.opening_float, summary.cash_sales)
  const diff     = (summary.cash_counted ?? 0) - cashExpected
  const diffColor = diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-500'
  const diffLabel = diff === 0 ? '✅ เงินครบ' : diff > 0 ? '💙 เงินเกิน' : '⚠️ เงินขาด'

  const fmt = (n) => (n ?? 0).toLocaleString()
  const fmtTime = (ts) => {
    if (!ts?.toDate) return '--:--'
    return ts.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }
  const fmtDate = (ts) => {
    if (!ts?.toDate) return ''
    return ts.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  const handleCopy = () => {
    const lines = [
      `🏪 ${shopName}`,
      `📅 ${fmtDate(openedAt)}  ${fmtTime(openedAt)} – ${fmtTime(closedAt)}`,
      `──────────────────`,
      `📊 ยอดขายรวม    ${fmt(summary.total)} ฿`,
      `🧾 บิลทั้งหมด   ${summary.order_count} บิล`,
      `──────────────────`,
      `💵 เงินสด       ${fmt(summary.cash_sales)} ฿`,
      `📱 โมบาย        ${fmt(summary.promptpay_sales)} ฿`,
      ...Object.entries(summary.delivery_sales ?? {}).map(([p, v]) =>
        `${PLATFORM_ICONS[p] ?? '🛵'} ${p.padEnd(12)} ${fmt(v)} ฿`
      ),
      `──────────────────`,
      `🏦 ควรมีในลิ้นชัก  ${fmt(cashExpected)} ฿`,
      `🔢 นับได้จริง       ${fmt(summary.cash_counted)} ฿`,
      `${diffLabel}         ${diff >= 0 ? '+' : ''}${fmt(diff)} ฿`,
      summary.stock_count?.waste_qty > 0
        ? `🗑️ ของเหลือทิ้ง    ${summary.stock_count.waste_qty} ชิ้น (${fmt(summary.stock_count.waste_cost)} ฿)`
        : '',
      summary.stock_count?.missing_qty > 0
        ? `⚠️ ของหายไม่มีบิล  ${summary.stock_count.missing_qty} ชิ้น (${fmt(summary.stock_count.missing_cost)} ฿)`
        : '',
      summary.closing_note ? `📝 หมายเหตุ: ${summary.closing_note}` : '',
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=400,height=700')
    win.document.write(`
      <html><head><title>สรุปกะ — ${shopName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: sans-serif; padding: 20px; font-size: 13px; color: #222; }
        h2 { font-size: 18px; font-weight: 900; margin-bottom: 2px; }
        .sub { color: #888; font-size: 11px; margin-bottom: 12px; }
        .divider { border: none; border-top: 1px solid #eee; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
        .label { color: #666; }
        .value { font-weight: 700; }
        .big { font-size: 20px; font-weight: 900; color: #ea580c; }
        .green { color: #16a34a; } .red { color: #dc2626; } .blue { color: #2563eb; }
        .hero { background: #fff7ed; border-radius: 12px; padding: 12px; margin: 10px 0; text-align: center; }
        .note { background: #f9fafb; border-radius: 8px; padding: 8px 12px; margin-top: 8px; font-size: 11px; color: #555; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h2>🏪 ${shopName}</h2>
      <p class="sub">📅 ${fmtDate(openedAt)} &nbsp; ${fmtTime(openedAt)} – ${fmtTime(closedAt)}</p>
      <div class="hero">
        <p style="font-size:11px;color:#999;margin-bottom:4px;">ยอดขายรวม</p>
        <p class="big">${fmt(summary.total)} ฿</p>
        <p style="font-size:11px;color:#999;margin-top:4px;">${summary.order_count} บิล</p>
      </div>
      <hr class="divider"/>
      <div class="row"><span class="label">💵 เงินสด</span><span class="value">${fmt(summary.cash_sales)} ฿</span></div>
      <div class="row"><span class="label">📱 โมบายแบงค์กิ้ง</span><span class="value">${fmt(summary.promptpay_sales)} ฿</span></div>
      ${Object.entries(summary.delivery_sales ?? {}).map(([p, v]) =>
        `<div class="row"><span class="label">${PLATFORM_ICONS[p] ?? '🛵'} ${p}</span><span class="value">${fmt(v)} ฿</span></div>`
      ).join('')}
      <hr class="divider"/>
      <div class="row"><span class="label">ทอนตั้งต้น</span><span class="value">${fmt(summary.opening_float)} ฿</span></div>
      <div class="row"><span class="label">ควรมีในลิ้นชัก</span><span class="value">${fmt(cashExpected)} ฿</span></div>
      <div class="row"><span class="label">นับได้จริง</span><span class="value">${fmt(summary.cash_counted)} ฿</span></div>
      <div class="row">
        <span class="label">${diffLabel}</span>
        <span class="value ${diff === 0 ? 'green' : diff > 0 ? 'blue' : 'red'}">${diff >= 0 ? '+' : ''}${fmt(diff)} ฿</span>
      </div>
      ${summary.stock_count?.waste_qty > 0
        ? `<div class="row"><span class="label">🗑️ ของเหลือทิ้ง</span><span class="value">${summary.stock_count.waste_qty} ชิ้น · ${fmt(summary.stock_count.waste_cost)} ฿</span></div>`
        : ''}
      ${summary.stock_count?.missing_qty > 0
        ? `<div class="row"><span class="label">⚠️ ของหายไม่มีบิล</span><span class="value">${summary.stock_count.missing_qty} ชิ้น · ${fmt(summary.stock_count.missing_cost)} ฿</span></div>`
        : ''}
      ${summary.closing_note ? `<div class="note">📝 ${summary.closing_note}</div>` : ''}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={true} maxWidthClass="max-w-sm">
      <div ref={printRef} className="flex-1 min-h-0 overflow-y-auto">

        {/* Hero */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-5 py-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl mx-auto mb-2">🔒</div>
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">ปิดกะเรียบร้อย</p>
          <p className="text-white font-extrabold text-4xl tabular-nums leading-none">{fmt(summary.total)}</p>
          <p className="text-white/70 text-sm mt-1">฿ · {summary.order_count} บิล</p>
          <p className="text-white/50 text-xs mt-2">
            {fmtDate(openedAt)} &nbsp;·&nbsp; {fmtTime(openedAt)} – {fmtTime(closedAt)}
          </p>
        </div>

        <div className="p-4 flex flex-col gap-3">

          {/* ยอดแยกประเภท */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">ยอดขายแยกประเภท</p>
            <Row label="💵 เงินสด"          value={`${fmt(summary.cash_sales)} ฿`} />
            <Row label="📱 โมบายแบงค์กิ้ง" value={`${fmt(summary.promptpay_sales)} ฿`} />
            {Object.entries(summary.delivery_sales ?? {}).map(([p, v]) => (
              <Row key={p} label={`${PLATFORM_ICONS[p] ?? '🛵'} ${p}`} value={`${fmt(v)} ฿`} />
            ))}
          </div>

          {/* เงินสด reconcile */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">ตรวจเงินลิ้นชัก</p>
            <Row label="ทอนตั้งต้น"       value={`${fmt(summary.opening_float)} ฿`} />
            <Row label="ควรมีในลิ้นชัก"   value={`${fmt(cashExpected)} ฿`} />
            <Row label="นับได้จริง"        value={`${fmt(summary.cash_counted)} ฿`} bold />
            <Row label={diffLabel}         value={`${diff >= 0 ? '+' : ''}${fmt(diff)} ฿`} valueColor={diffColor} bold />
          </div>

          {/* ของเหลือ */}
          {summary.stock_count && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">ตรวจของเหลือ</p>
              {(summary.stock_count.rows ?? []).map((r) => (
                <Row
                  key={r.product_id}
                  label={r.name}
                  value={`${r.counted}/${r.expected} ${r.unit}`}
                  valueColor={r.diff === 0 ? undefined : r.diff > 0 ? 'text-blue-600' : 'text-red-500'}
                />
              ))}
              {summary.stock_count.waste_qty > 0 && (
                <Row label="🗑️ ของเหลือทิ้ง"
                  value={`${summary.stock_count.waste_qty} ชิ้น · ${fmt(summary.stock_count.waste_cost)} ฿`}
                  valueColor="text-amber-600" bold />
              )}
              {summary.stock_count.missing_qty > 0 && (
                <Row label="⚠️ หายไปไม่มีบิล"
                  value={`${summary.stock_count.missing_qty} ชิ้น · ${fmt(summary.stock_count.missing_cost)} ฿`}
                  valueColor="text-red-500" bold />
              )}
            </div>
          )}

          {/* หมายเหตุ */}
          {summary.closing_note && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1">หมายเหตุ</p>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.closing_note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCopy}
              className={`flex-1 min-h-[48px] rounded-2xl font-bold text-sm active:scale-95 transition-all ${
                copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
              {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอก LINE'}
            </button>
            <button type="button" onClick={handlePrint}
              className="flex-1 min-h-[48px] rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95 transition-all">
              🖨️ พิมพ์ / PDF
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold active:scale-95 transition-all">
            เสร็จสิ้น
          </button>

        </div>
      </div>
    </ModalBackdrop>
  )
}

export default ShiftSummaryModal
