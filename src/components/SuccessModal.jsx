import { useEffect } from 'react'
import { summarizePayments } from '../lib/orders'
import ModalBackdrop from './ModalBackdrop'

function SuccessModal({ result, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const { line, changeTotal } = summarizePayments(result.payments)

  return (
    <ModalBackdrop onClose={onClose} maxWidthClass="max-w-sm">
      <div className="flex-1 min-h-0 overflow-y-auto p-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
          ✓
        </div>
        <p className="text-gray-500">ชำระเงินสำเร็จ</p>
        <p className="text-gray-500 mt-2">คิวที่</p>
        <p className="mb-4 text-5xl font-bold text-gray-800">{result.queueNo}</p>

        <p className="text-gray-600">{line}</p>
        {changeTotal > 0 && (
          <p className="mt-1 text-sm text-gray-400">เงินทอน {changeTotal.toLocaleString()} บาท</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full min-h-[56px] rounded-xl bg-orange-600 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          เสร็จสิ้น
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default SuccessModal
