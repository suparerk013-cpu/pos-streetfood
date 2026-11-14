import { useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { openShift, ShiftAlreadyOpenError, shiftErrorMessage } from '../lib/shiftActions'
import ModalBackdrop from './ModalBackdrop'

function OpenShiftModal({ onClose }) {
  const [openingFloat, setOpeningFloat] = useState('500')
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState(null)
  const { activeProducts } = useAppData()

  // เปิดเหมือนหน้ากะทุกอย่าง รวมถึงล้างสต็อกสินค้ารายวัน
  const handleOpen = async () => {
    setOpening(true)
    setError(null)
    try {
      await openShift({ openingFloat, products: activeProducts })
      onClose()
    } catch (err) {
      // อีกเครื่องเปิดไว้แล้ว ไม่ต้องทำอะไร ปิดหน้าต่างแล้วขายต่อในกะนั้นได้เลย
      if (err instanceof ShiftAlreadyOpenError) {
        onClose()
        return
      }
      setError(shiftErrorMessage(err, 'เปิดกะ'))
    } finally {
      setOpening(false)
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={!opening} maxWidthClass="max-w-sm">
      <div className="p-6 flex flex-col gap-5">
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl shadow-md">
            🔓
          </div>
          <div>
            <p className="font-extrabold text-gray-800 text-xl leading-tight">เปิดกะ</p>
            <p className="text-xs text-gray-400 mt-0.5">ใส่เงินทอนตั้งต้นในลิ้นชัก</p>
          </div>
        </div>

        {/* Opening float input */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            เงินทอนเริ่มต้น (฿)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value.replace(/\D/g, ''))}
            placeholder="500"
            disabled={opening}
            className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-5 py-4 text-3xl font-extrabold text-gray-800 text-center focus:outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all"
          />
          {/* Quick amounts */}
          <div className="flex gap-2 mt-2">
            {[500, 1000, 2000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setOpeningFloat(String(v))}
                disabled={opening}
                className="flex-1 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold active:bg-orange-100 transition-colors"
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{error}</p>}

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={opening}
            className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
          >
            ข้ามก่อน
          </button>
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="flex-[2] min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold text-base shadow-lg shadow-orange-200 active:scale-95 transition-all"
          >
            {opening ? 'กำลังเปิดกะ...' : '🔓 เปิดกะ'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default OpenShiftModal
