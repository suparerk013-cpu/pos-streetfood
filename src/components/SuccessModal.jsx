import { useEffect } from 'react'
import ModalBackdrop from './ModalBackdrop'

function SuccessModal({ result, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <ModalBackdrop onClose={onClose} maxWidthClass="max-w-sm">
      <div className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-4xl text-white shadow-lg">
          ✓
        </div>
        <p className="text-2xl font-extrabold text-gray-800 mb-1">เสร็จสิ้น</p>
        <p className="text-sm text-gray-400 mb-6">คิวที่ {result.queueNo}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all"
        >
          ปิด
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default SuccessModal
