import { X } from 'lucide-react'
import { useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { PLATFORM_ICONS } from '../lib/constants'
import { toDateString } from '../lib/dates'
import { actualRate, recordPayout } from '../lib/payouts'
import ModalBackdrop from './ModalBackdrop'

/**
 * บันทึกเงินที่แพลตฟอร์มโอนเข้าบัญชีจริง
 * ระบบคำนวณ % ที่ถูกหักจริง (GP + ภาษี + ค่าธรรมเนียม) ย้อนกลับให้เอง
 */
function PayoutModal({ defaultGross = 0, defaultFrom, defaultTo, onClose, onSaved }) {
  const { enabledPlatforms } = useAppData()
  const [platform, setPlatform] = useState(enabledPlatforms[0] ?? '')
  const [from, setFrom] = useState(defaultFrom ?? toDateString())
  const [to, setTo] = useState(defaultTo ?? toDateString())
  const [gross, setGross] = useState(String(Math.round(defaultGross) || ''))
  const [net, setNet] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const grossNum = Number(gross) || 0
  const netNum = Number(net) || 0
  const rate = actualRate(grossNum, netNum)
  const canSave = platform && grossNum > 0 && netNum > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await recordPayout({ platform, from, to, grossAmount: grossNum, netReceived: netNum })
      onSaved?.()
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่')
      setSaving(false)
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={!saving} maxWidthClass="max-w-sm">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 flex items-center justify-between">
          <h2 className="font-extrabold text-white text-lg">บันทึกรอบจ่ายเงิน</h2>
          <button type="button" onClick={onClose} disabled={saving}
            className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-40"
            aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">แอป</p>
            <div className="flex flex-wrap gap-1.5">
              {enabledPlatforms.map((p) => (
                <button key={p} type="button" onClick={() => setPlatform(p)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                    platform === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {PLATFORM_ICONS[p] ?? '🛵'} {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="payout-from" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                ตั้งแต่
              </label>
              <input id="payout-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label htmlFor="payout-to" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                ถึง
              </label>
              <input id="payout-to" type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            </div>
          </div>

          <div>
            <label htmlFor="payout-gross" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              ยอดขายในระบบ (฿)
            </label>
            <input id="payout-gross" type="number" inputMode="decimal" step="any"
              value={gross} onChange={(e) => setGross(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-xl font-extrabold text-center tabular-nums focus:outline-none focus:border-orange-400 focus:bg-white" />
          </div>

          <div>
            <label htmlFor="payout-net" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              เงินเข้าบัญชีจริง (฿)
            </label>
            <input id="payout-net" type="number" inputMode="decimal" step="any"
              value={net} onChange={(e) => setNet(e.target.value)}
              placeholder="ดูจากสลิป/แอป"
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-xl font-extrabold text-center tabular-nums focus:outline-none focus:border-orange-400 focus:bg-white" />
          </div>

          {netNum > 0 && grossNum > 0 && (
            <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3 text-center">
              <p className="text-xs text-gray-500">ถูกหักจริง</p>
              <p className="text-3xl font-black text-orange-600 tabular-nums">
                {(rate * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                รวม GP + ภาษี + ค่าธรรมเนียมทั้งหมด · {(grossNum - netNum).toLocaleString()} ฿
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          <button type="button" onClick={handleSave} disabled={!canSave}
            className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all">
            {saving ? 'กำลังบันทึก...' : 'บันทึกและใช้อัตรานี้'}
          </button>
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            อัตรานี้จะถูกใช้คำนวณกำไรของแอปนี้ต่อไป แทนค่าที่ตั้งไว้ในหน้าตั้งค่า
          </p>
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default PayoutModal
