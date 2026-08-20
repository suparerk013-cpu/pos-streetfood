import { useState } from 'react'
import { calcCartTotal } from '../lib/cart'
import { createOrder, InsufficientStockError, PAYMENT_METHOD_LABELS } from '../lib/orders'
import ModalBackdrop from './ModalBackdrop'
import Numpad from './Numpad'

function CheckoutModal({ cart, onClose, onSuccess }) {
  const total = calcCartTotal(cart)
  const [payments, setPayments] = useState([])
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [numpadValue, setNumpadValue] = useState('0')
  const [changePopup, setChangePopup] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(total - paidSoFar, 0)
  const entered = Number(numpadValue) || 0

  const quickAmounts = [
    { label: 'พอดี', value: remaining },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '500', value: 500 },
    { label: '1000', value: 1000 },
  ]

  const openMethod = (method) => {
    setSelectedMethod(method)
    setNumpadValue('0')
  }

  const confirmPaymentDisabled =
    entered <= 0 || (selectedMethod === 'promptpay' && entered > remaining)

  const finalizeOrder = async (finalPayments) => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setPending(false)
    const pendingTimer = setTimeout(() => setPending(true), 6000)

    try {
      const result = await createOrder({ cart, payments: finalPayments, total })
      clearTimeout(pendingTimer)
      setSaving(false)
      onSuccess(result)
    } catch (err) {
      clearTimeout(pendingTimer)
      setSaving(false)
      setPending(false)
      if (err instanceof InsufficientStockError) {
        setSaveError(`${err.message} — กรุณาปิดหน้านี้แล้วปรับจำนวนในตะกร้าก่อนลองใหม่`)
      } else {
        setSaveError(
          'บันทึกบิลไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง — ยอดชำระที่กรอกไว้ยังอยู่ครบ กดปุ่มด้านล่างเพื่อลองบันทึกอีกครั้ง',
        )
      }
    }
  }

  const handleConfirmPayment = () => {
    if (confirmPaymentDisabled) return

    const newPayment =
      selectedMethod === 'cash'
        ? (() => {
            const appliedAmount = Math.min(entered, remaining)
            return {
              method: 'cash',
              amount: appliedAmount,
              cash_received: entered,
              change: entered - appliedAmount,
            }
          })()
        : { method: 'promptpay', amount: entered }

    const updatedPayments = [...payments, newPayment]
    const newRemaining = Math.max(total - updatedPayments.reduce((sum, p) => sum + p.amount, 0), 0)

    setPayments(updatedPayments)
    setSelectedMethod(null)
    setNumpadValue('0')

    if (newPayment.change > 0) {
      setChangePopup({ amount: newPayment.change, shouldFinalize: newRemaining === 0, finalPayments: updatedPayments })
    } else if (newRemaining === 0) {
      finalizeOrder(updatedPayments)
    }
  }

  const handleChangePopupDone = () => {
    const { shouldFinalize, finalPayments } = changePopup
    setChangePopup(null)
    if (shouldFinalize) {
      finalizeOrder(finalPayments)
    }
  }

  const canClose = !saving

  return (
    <>
      <ModalBackdrop onClose={onClose} canClose={canClose}>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">ชำระเงิน</h2>
            <button
              type="button"
              onClick={() => canClose && onClose()}
              disabled={!canClose}
              className="w-11 h-11 shrink-0 rounded-full bg-gray-100 text-gray-500 text-lg flex items-center justify-center disabled:opacity-40"
              aria-label="ปิด"
            >
              ×
            </button>
          </div>

          <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-400">ยอดรวม</p>
              <p className="text-xl font-bold text-gray-800">{total.toLocaleString()} ฿</p>
            </div>
            <div className="rounded-xl bg-orange-50 px-3 py-2">
              <p className="text-xs text-orange-500">ยอดค้างจ่าย</p>
              <p className="text-xl font-bold text-orange-700">
                {remaining.toLocaleString()} ฿
              </p>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="mb-3 rounded-xl border border-gray-100 divide-y divide-gray-50">
              {payments.map((p, index) => (
                <div key={index} className="px-3 py-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-600">{PAYMENT_METHOD_LABELS[p.method]}</span>
                  <span className="font-medium text-gray-800">
                    {p.amount.toLocaleString()} ฿
                    {p.change > 0 && (
                      <span className="text-gray-400"> (ทอน {p.change.toLocaleString()})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedMethod ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">
                  ระบุยอด{PAYMENT_METHOD_LABELS[selectedMethod]}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedMethod(null)}
                  className="text-sm text-gray-400"
                >
                  ย้อนกลับ
                </button>
              </div>

              <Numpad
                value={numpadValue}
                onChangeValue={setNumpadValue}
                quickAmounts={quickAmounts}
              />

              {selectedMethod === 'promptpay' && entered > remaining && (
                <p className="mt-2 text-center text-sm font-medium text-red-500">
                  ยอดโอนต้องไม่เกินยอดค้างจ่าย
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openMethod('cash')}
                  disabled={remaining <= 0}
                  className="min-h-[52px] rounded-xl bg-white border-2 border-orange-200 disabled:opacity-40 font-bold text-gray-700 active:scale-95 transition-transform"
                >
                  เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => openMethod('promptpay')}
                  disabled={remaining <= 0}
                  className="min-h-[52px] rounded-xl bg-white border-2 border-orange-200 disabled:opacity-40 font-bold text-gray-700 active:scale-95 transition-transform"
                >
                  โอน (PromptPay)
                </button>
              </div>

              {saveError && (
                <p className="mb-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {saveError}
                </p>
              )}
              {pending && !saveError && (
                <p className="mb-2 rounded-xl bg-yellow-50 px-4 py-2.5 text-sm text-yellow-700">
                  กำลังเชื่อมต่อกับเซิร์ฟเวอร์ อย่าเพิ่งปิดหน้านี้...
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-4">
          {selectedMethod ? (
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={confirmPaymentDisabled}
              className="w-full min-h-[48px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              ยืนยันยอดนี้
            </button>
          ) : (
            <button
              type="button"
              onClick={() => finalizeOrder(payments)}
              disabled={remaining > 0 || payments.length === 0 || saving}
              className="w-full min-h-[52px] rounded-xl bg-green-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              {saving ? 'กำลังบันทึก...' : 'ยืนยันชำระเงิน'}
            </button>
          )}
        </div>
      </ModalBackdrop>

      {changePopup && (
        <ModalBackdrop canClose={false} maxWidthClass="max-w-sm">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 text-center">
            <p className="text-gray-500 mb-2">เงินทอน</p>
            <p className="mb-1 text-3xl sm:text-5xl font-bold text-green-600 break-words">
              {changePopup.amount.toLocaleString()}
            </p>
            <p className="text-gray-500">บาท</p>

            <button
              type="button"
              onClick={handleChangePopupDone}
              className="mt-6 w-full min-h-[52px] rounded-xl bg-orange-600 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              เสร็จสิ้น
            </button>
          </div>
        </ModalBackdrop>
      )}
    </>
  )
}

export default CheckoutModal
