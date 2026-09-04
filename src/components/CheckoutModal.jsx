import { useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { calcCartTotal } from '../lib/cart'
import {
  DELIVERY_PLATFORMS as PLATFORM_KEYS,
  METHOD_ICONS,
  METHOD_SHORT,
  PLATFORM_BUTTON_BG,
  PLATFORM_ICONS,
} from '../lib/constants'
import { createOrder, InsufficientStockError } from '../lib/orders'
import ModalBackdrop from './ModalBackdrop'

const DELIVERY_PLATFORMS = PLATFORM_KEYS.map((key) => ({
  key,
  label: key,
  bg: PLATFORM_BUTTON_BG[key],
  emoji: PLATFORM_ICONS[key],
}))

const DIGIT_ROWS = [['1','2','3'], ['4','5','6'], ['7','8','9'], ['ล้าง','0','⌫']]
const QUICK_AMOUNTS  = [20, 50, 100]
const QUICK_DISCOUNTS = [5, 10, 20]

function calcDeliveryTotal(cart, platform) {
  return cart.reduce((sum, item) => {
    const price = item.delivery_prices?.[platform] ?? item.price
    return sum + price * item.quantity
  }, 0)
}

function CheckoutModal({ cart, onClose, onSuccess }) {
  const { enabledPlatforms: shopPlatformKeys, currentShift } = useAppData()
  const subtotal = calcCartTotal(cart)
  const [method, setMethod]           = useState('cash')
  const [numpadValue, setNumpadValue] = useState('0')
  const [payments, setPayments]       = useState([])
  const [changePopup, setChangePopup] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(null)
  const [discount, setDiscount]       = useState(0)
  const [discountMode, setDiscountMode] = useState(false)

  const total      = Math.max(subtotal - discount, 0)
  const paidSoFar  = payments.reduce((s, p) => s + p.amount, 0)
  const remaining  = Math.max(total - paidSoFar, 0)
  const entered    = Number(numpadValue) || 0

  const canAdd = discountMode
    ? entered <= subtotal
    : (entered > 0 && remaining > 0 && (method === 'promptpay' ? entered <= remaining : true))

  const finalizeOrder = async (finalPayments, overrideTotal = total, overrideSubtotal = subtotal) => {
    if (saving) return
    setSaving(true); setSaveError(null)
    try {
      const result = await createOrder({
        cart,
        payments: finalPayments,
        total: overrideTotal,
        discount,
        subtotal: overrideSubtotal,
        shiftId: currentShift?.id ?? null,
      })
      setSaving(false); onSuccess(result)
    } catch (err) {
      setSaving(false)
      setSaveError(err instanceof InsufficientStockError
        ? `${err.message} — ปรับจำนวนก่อน`
        : 'บันทึกไม่สำเร็จ ลองใหม่')
    }
  }

  const handleDiscountConfirm = () => {
    setDiscount(Math.min(entered, subtotal))
    setDiscountMode(false)
    setNumpadValue('0')
    setPayments([])
  }

  const handleAddPayment = () => {
    if (!canAdd) return
    const applied = Math.min(entered, remaining)
    const change  = method === 'cash' ? Math.max(entered - applied, 0) : 0
    const pay = method === 'cash'
      ? { method: 'cash', amount: applied, cash_received: entered, change }
      : { method: 'promptpay', amount: applied }
    const updated      = [...payments, pay]
    const newRemaining = Math.max(total - updated.reduce((s,p) => s + p.amount, 0), 0)
    setPayments(updated); setNumpadValue('0')
    if (change > 0) {
      setChangePopup({ amount: change, shouldFinalize: newRemaining === 0, finalPayments: updated })
    } else if (newRemaining === 0) {
      finalizeOrder(updated)
    }
  }

  const handleKey = (key) => {
    if (key === 'ล้าง') { setNumpadValue('0'); return }
    if (key === '⌫')   { setNumpadValue(v => v.length > 1 ? v.slice(0,-1) : '0'); return }
    setNumpadValue(v => v === '0' ? key : v.length < 7 ? v + key : v)
  }

  const btnLabel = () => {
    if (discountMode) {
      return entered === 0 ? 'ยืนยัน (ไม่มีส่วนลด)' : `🏷️ ส่วนลด ${entered.toLocaleString()} ฿`
    }
    if (saving)        return 'กำลังบันทึก...'
    if (entered === 0) return 'กรอกยอดที่รับ'
    const applied      = Math.min(entered, remaining)
    const newRemaining = remaining - applied
    const change       = method === 'cash' ? Math.max(entered - applied, 0) : 0
    if (newRemaining === 0 && change === 0) return '✓ ยืนยันชำระครบ'
    if (newRemaining === 0 && change > 0)  return `✓ ทอน ${change.toLocaleString()} ฿`
    return `✓ รับ ${applied.toLocaleString()} ฿  (ค้าง ${newRemaining.toLocaleString()})`
  }

  const openDiscountMode = () => {
    setDiscountMode(true)
    setNumpadValue(discount > 0 ? String(discount) : '0')
  }

  const cancelDiscountMode = () => {
    setDiscountMode(false)
    setNumpadValue('0')
  }

  const showNumpad = discountMode || method !== 'delivery'

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center bg-black/60"
        onClick={() => !saving && onClose()}
      >
        <div
          className="flex-1 min-h-0 flex flex-col bg-white w-full overflow-hidden sm:flex-none sm:h-[95vh] sm:max-w-md sm:rounded-3xl sm:shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >

          {/* ══ HEADER ══ */}
          <div className="shrink-0 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none">
                {discount > 0 ? 'ราคาสินค้า → ยอดสุทธิ' : 'ยอดรวม'}
              </p>
              {discount > 0 ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-white/40 text-xl line-through leading-tight tabular-nums">
                    {subtotal.toLocaleString()}
                  </p>
                  <p className="text-white font-black text-4xl leading-tight tabular-nums">
                    {total.toLocaleString()}
                    <span className="text-xl opacity-60 ml-1.5">฿</span>
                  </p>
                </div>
              ) : (
                <p className="text-white font-black text-4xl leading-tight tabular-nums">
                  {subtotal.toLocaleString()}
                  <span className="text-xl opacity-60 ml-1.5">฿</span>
                </p>
              )}
              {discount > 0 && (
                <p className="text-green-200 text-xs font-semibold">🏷️ ส่วนลด {discount.toLocaleString()} ฿</p>
              )}
              {payments.length > 0 && (
                <p className="text-white/80 text-xs mt-0.5">
                  {payments.map((p,i)=>(
                    <span key={i}>{p.platform ?? METHOD_SHORT[p.method]} {p.amount.toLocaleString()} · </span>
                  ))}
                  <span className="font-bold">ค้าง {remaining.toLocaleString()} ฿</span>
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              {payments.length === 0 && !discountMode && (
                <button
                  type="button"
                  onClick={openDiscountMode}
                  className="rounded-lg bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 active:bg-white/30 whitespace-nowrap">
                  {discount > 0 ? `🏷️ ลด ${discount}฿` : '+ ส่วนลด'}
                </button>
              )}
              <button type="button" onClick={() => !saving && onClose()} disabled={saving}
                className="w-10 h-10 rounded-full bg-white/20 text-white text-2xl font-bold flex items-center justify-center disabled:opacity-40">
                ×
              </button>
            </div>
          </div>

          {/* ══ METHOD TABS or DISCOUNT BANNER ══ */}
          {discountMode ? (
            <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏷️</span>
                <div>
                  <p className="text-orange-700 font-bold text-sm leading-none">ป้อนส่วนลด</p>
                  <p className="text-orange-400 text-[10px]">กรอกจำนวนเงินที่ต้องการลด</p>
                </div>
              </div>
              <button type="button" onClick={cancelDiscountMode}
                className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 active:scale-95">
                ยกเลิก
              </button>
            </div>
          ) : (
            <div className="shrink-0 flex gap-1.5 px-3 pt-2 pb-1">
              {['cash','promptpay','delivery'].map((m) => (
                <button key={m} type="button"
                  onClick={() => { setMethod(m); setNumpadValue('0') }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 font-bold text-xs transition-all ${
                    method === m
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-200 bg-white text-gray-500 active:scale-95'
                  }`}>
                  <span className="text-sm">{METHOD_ICONS[m]}</span>
                  {METHOD_SHORT[m]}
                </button>
              ))}
            </div>
          )}

          {/* ══ NUMPAD AREA ══ */}
          {showNumpad ? (
            <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-1.5">

              {/* Display row */}
              <div className="shrink-0 flex gap-1.5">
                <div className="flex-1 flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-3 py-1.5">
                  <span className="text-3xl font-extrabold text-gray-800 tabular-nums leading-none">
                    {Number(numpadValue).toLocaleString()}
                  </span>
                  <span className="text-base font-bold text-gray-400">
                    {discountMode ? '฿ ลด' : '฿'}
                  </span>
                </div>
                {!discountMode && (
                  <button type="button" onClick={() => setNumpadValue(String(remaining))}
                    className="shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white active:scale-95 shadow-sm">
                    พอดี
                  </button>
                )}
              </div>

              {/* Error */}
              {saveError && (
                <p className="shrink-0 rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600">{saveError}</p>
              )}
              {!discountMode && method === 'promptpay' && entered > remaining && (
                <p className="shrink-0 text-center text-xs font-semibold text-red-500">
                  ยอดโอนต้องไม่เกิน {remaining.toLocaleString()} ฿
                </p>
              )}
              {discountMode && entered > subtotal && (
                <p className="shrink-0 text-center text-xs font-semibold text-red-500">
                  ส่วนลดต้องไม่เกิน {subtotal.toLocaleString()} ฿
                </p>
              )}

              {/* Quick amounts */}
              <div className="shrink-0 flex gap-1.5">
                {(discountMode ? QUICK_DISCOUNTS : QUICK_AMOUNTS).map((v) => (
                  <button key={v} type="button" onClick={() => setNumpadValue(String(v))}
                    className={`flex-1 h-11 rounded-xl font-bold text-base active:scale-95 transition-all ${
                      discountMode
                        ? 'bg-green-50 border border-green-100 text-green-700 active:bg-green-100'
                        : 'bg-blue-50 border border-blue-100 text-blue-700 active:bg-blue-100'
                    }`}>
                    {discountMode ? `-${v}` : v}
                  </button>
                ))}
              </div>

              {/* Digit grid */}
              <div className="flex-1 min-h-0 flex flex-col gap-1.5">
                {DIGIT_ROWS.map((row, ri) => (
                  <div key={ri} className="flex-1 flex gap-1.5">
                    {row.map((d) => (
                      <button key={d} type="button" onClick={() => handleKey(d)}
                        className={`flex-1 rounded-2xl font-black text-3xl active:scale-95 transition-all select-none ${
                          d === 'ล้าง'
                            ? 'bg-gray-100 text-gray-500 text-lg active:bg-gray-200'
                            : d === '⌫'
                            ? 'bg-gray-100 text-gray-600 active:bg-gray-200'
                            : 'bg-white border-2 border-gray-200 text-gray-800 shadow-sm active:bg-orange-50 active:border-orange-300'
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Confirm button */}
              <button type="button"
                onClick={discountMode ? handleDiscountConfirm : handleAddPayment}
                disabled={(!discountMode && (!canAdd || saving)) || (discountMode && entered > subtotal)}
                className={`shrink-0 h-14 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all text-white ${
                  discountMode
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 disabled:from-gray-300 disabled:to-gray-300'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300'
                }`}>
                {btnLabel()}
              </button>
            </div>

          ) : (
            /* ══ DELIVERY PLATFORMS ══ */
            <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2">
              {saveError && (
                <p className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 text-center">{saveError}</p>
              )}
              <p className="shrink-0 text-xs font-bold text-gray-400 uppercase tracking-wider text-center pt-1">
                เลือกแพลตฟอร์ม
              </p>
              {shopPlatformKeys.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">
                  ยังไม่ได้เปิดแอพเดลิเวอรี่ — ไปเปิดที่หน้าตั้งค่าก่อน
                </p>
              )}
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
                {DELIVERY_PLATFORMS.filter((p) => shopPlatformKeys.includes(p.key)).map((p) => {
                  const dTotal = calcDeliveryTotal(cart, p.key)
                  // ส่วนลดกรอกไว้กับราคาหน้าร้าน แต่ราคาเดลิเวอรีเป็นคนละฐาน
                  // จึงจำกัดไม่ให้ลดเกินยอดของแพลตฟอร์มนั้นเอง
                  const dDiscount = Math.min(discount, dTotal)
                  const dNet   = dTotal - dDiscount
                  return (
                    <button key={p.key} type="button" disabled={saving}
                      onClick={() => !saving && finalizeOrder([{ method: 'delivery', platform: p.key, amount: dNet }], dNet, dTotal)}
                      className={`${p.bg} rounded-2xl flex flex-col items-center justify-center gap-1.5 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50`}>
                      <span className="text-4xl">{p.emoji}</span>
                      <span className="font-bold text-base">{p.label}</span>
                      {dDiscount > 0 ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-xs line-through opacity-60 tabular-nums">{dTotal.toLocaleString()}</span>
                          <span className="font-black text-xl tabular-nums">{dNet.toLocaleString()} ฿</span>
                        </span>
                      ) : (
                        <span className="font-black text-xl tabular-nums">{dTotal.toLocaleString()} ฿</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Change popup */}
      {changePopup && (
        <ModalBackdrop canClose={false} maxWidthClass="max-w-sm">
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">💵</div>
            <p className="text-gray-500 mb-1 font-medium">เงินทอน</p>
            <p className="text-5xl font-extrabold text-green-600 mb-1">{changePopup.amount.toLocaleString()}</p>
            <p className="text-gray-400 mb-5">บาท</p>
            <button type="button"
              onClick={() => { setChangePopup(null); if (changePopup.shouldFinalize) finalizeOrder(changePopup.finalPayments) }}
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg shadow-lg active:scale-95">
              เสร็จสิ้น
            </button>
          </div>
        </ModalBackdrop>
      )}
    </>
  )
}

export default CheckoutModal
