import { doc, setDoc } from 'firebase/firestore'
import { ImageOff, LogOut, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { auth } from '../lib/firebase'
import { displayName, logout } from '../lib/auth'
import {
  DEFAULT_CONSUMABLE_COST,
  DEFAULT_GP_RATE,
  DEFAULT_PACKAGING_COST,
  DELIVERY_PLATFORMS as PLATFORMS,
} from '../lib/constants'
import { compressImageToBase64, ImageTooLargeError, InvalidImageError } from '../lib/imageUtils'
import { db } from '../lib/firebase'

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-800 font-medium text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
      />
    </div>
  )
}

function SettingsPage() {
  const { store, storeLoading } = useAppData()
  const [shopName, setShopName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [address, setAddress]       = useState('')
  const [billNote, setBillNote]     = useState('')
  const [logoBase64, setLogoBase64] = useState(null)
  const [newLogo, setNewLogo]       = useState(null)
  const [processingLogo, setProcessingLogo] = useState(false)
  const [logoError, setLogoError]   = useState(null)
  const [hydrated, setHydrated]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [saveError, setSaveError]   = useState(null)
  const [deliveryPlatforms, setDeliveryPlatforms] = useState(PLATFORMS)
  const [gpRates, setGpRates] = useState({})
  const [packagingCost, setPackagingCost] = useState(String(DEFAULT_PACKAGING_COST))
  const [consumableCost, setConsumableCost] = useState(String(DEFAULT_CONSUMABLE_COST))

  // เติมค่าจาก context ครั้งเดียวตอนโหลดเสร็จ หลังจากนั้นปล่อยให้ฟอร์มเป็นของผู้ใช้
  // ไม่ใช้ getDoc เพราะถ้าเน็ตหลุดจะค้างที่ "กำลังโหลด..." ตลอดไป
  useEffect(() => {
    if (storeLoading || hydrated) return
    setShopName(store.shop_name ?? '')
    setPhone(store.phone ?? '')
    setAddress(store.address ?? '')
    setBillNote(store.bill_note ?? '')
    setLogoBase64(store.logo_base64 ?? null)
    setDeliveryPlatforms(store.enabled_delivery_platforms ?? PLATFORMS)
    const savedGp = store.platform_gp ?? {}
    setGpRates(
      Object.fromEntries(
        PLATFORMS.map((p) => [p, String(Math.round((savedGp[p] ?? DEFAULT_GP_RATE) * 100))]),
      ),
    )
    setPackagingCost(String(store.packaging_cost ?? DEFAULT_PACKAGING_COST))
    setConsumableCost(String(store.consumable_cost ?? DEFAULT_CONSUMABLE_COST))
    setHydrated(true)
  }, [store, storeLoading, hydrated])

  const toggleDeliveryPlatform = (platform) => {
    setDeliveryPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    )
  }

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    setProcessingLogo(true)
    try {
      const b64 = await compressImageToBase64(file)
      setLogoBase64(b64)
      setNewLogo(b64)
    } catch (err) {
      if (err instanceof InvalidImageError || err instanceof ImageTooLargeError) setLogoError(err.message)
      else setLogoError('ประมวลผลรูปภาพไม่สำเร็จ')
    } finally {
      setProcessingLogo(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const payload = {
      shop_name: shopName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      bill_note: billNote.trim(),
    }
    if (newLogo) payload.logo_base64 = newLogo
    payload.enabled_delivery_platforms = deliveryPlatforms
    payload.platform_gp = Object.fromEntries(
      PLATFORMS.map((p) => [p, (Number(gpRates[p]) || 0) / 100]),
    )
    payload.packaging_cost = Number(packagingCost) || 0
    payload.consumable_cost = Number(consumableCost) || 0
    try {
      await setDoc(doc(db, 'settings', 'store'), payload, { merge: true })
      setSaved(true)
      setNewLogo(null)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('บันทึกไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-3 shadow-sm">
        <h1 className="font-bold text-lg">ตั้งค่าร้าน</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {storeLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">กำลังโหลด...</p>
          </div>
        ) : (
          <>
            {/* Logo upload */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
              <p className="self-start text-xs font-bold text-orange-500 uppercase tracking-wider">โลโก้ร้าน</p>
              <div className="w-28 h-28 rounded-3xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                {logoBase64 ? (
                  <img src={logoBase64} alt="โลโก้ร้าน" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="text-gray-300" size={36} />
                )}
              </div>
              <label className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold cursor-pointer active:scale-95 transition-all ${
                processingLogo ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white shadow-md shadow-orange-200'
              }`}>
                <Upload size={16} />
                {processingLogo ? 'กำลังประมวลผล...' : logoBase64 ? 'เปลี่ยนโลโก้' : 'อัพโหลดโลโก้'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={handleLogoChange} disabled={processingLogo || saving} />
              </label>
              {logoError && <p className="text-xs text-red-500">{logoError}</p>}
            </div>

            {/* Shop info card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">ข้อมูลร้าน</p>
              <Field
                label="ชื่อร้าน"
                value={shopName}
                onChange={setShopName}
                placeholder="เช่น หมึกย่าง หอยแมลงภู่"
              />
              <Field
                label="เบอร์โทร"
                value={phone}
                onChange={setPhone}
                placeholder="เช่น 08x-xxx-xxxx"
                type="tel"
              />
              <Field
                label="ที่อยู่ / สาขา"
                value={address}
                onChange={setAddress}
                placeholder="เช่น ตลาดนัดสุขุมวิท"
              />
            </div>

            {/* Delivery platforms card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">แพลตฟอร์มเดลิเวอรี่</p>
                <p className="text-xs text-gray-400 mt-0.5">เปิดเฉพาะแอพที่ร้านขายจริง จะโผล่ให้เลือกตอนคิดเงินและตั้งราคาสินค้า</p>
              </div>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map((p) => {
                  const enabled = deliveryPlatforms.includes(p)
                  return (
                    <div key={p} className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleDeliveryPlatform(p)}
                        aria-pressed={enabled}
                        aria-label={`เปิด/ปิด ${p}`}
                        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                      <span className={`text-sm font-medium ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>{p}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ต้นทุนและค่า GP */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">ต้นทุนและค่า GP</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ใช้คำนวณกำไรจริงและราคาเดลิเวอรีที่แนะนำ ใส่คร่าว ๆ ไปก่อนได้
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="packaging-cost" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    ค่าบรรจุภัณฑ์ / ออเดอร์
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="packaging-cost"
                      type="number" inputMode="decimal" step="any"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-800 font-bold text-sm focus:outline-none focus:border-orange-400 transition-all"
                    />
                    <span className="text-sm text-gray-400 shrink-0">฿</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">กล่อง ถุง น้ำจิ้มแยก</p>
                </div>
                <div>
                  <label htmlFor="consumable-cost" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    ของประกอบ / ชิ้น
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="consumable-cost"
                      type="number" inputMode="decimal" step="any"
                      value={consumableCost}
                      onChange={(e) => setConsumableCost(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-800 font-bold text-sm focus:outline-none focus:border-orange-400 transition-all"
                    />
                    <span className="text-sm text-gray-400 shrink-0">฿</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">ไม้เสียบ น้ำจิ้ม ถ่าน</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  ค่า GP + ภาษี ที่แต่ละแอปหัก (%)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.filter((p) => deliveryPlatforms.includes(p)).map((p) => (
                    <label key={p} className="block">
                      <span className="text-xs font-medium text-gray-600">{p}</span>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <input
                          type="number" inputMode="decimal" step="any"
                          value={gpRates[p] ?? ''}
                          onChange={(e) => setGpRates((prev) => ({ ...prev, [p]: e.target.value }))}
                          placeholder="30"
                          className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold focus:outline-none focus:border-orange-400"
                        />
                        <span className="text-sm text-gray-400 shrink-0">%</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  ไม่ต้องรู้ตัวเลขแน่นอน — พอบันทึกรอบจ่ายเงินจริงในหน้ารายงาน
                  ระบบจะคำนวณ % ที่ถูกหักจริงย้อนกลับให้เอง
                </p>
              </div>
            </div>

            {/* Bill note card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">หมายเหตุในบิล</p>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  ข้อความท้ายบิล
                </label>
                <textarea
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="เช่น ขอบคุณที่ใช้บริการ 🙏"
                  rows={3}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-800 font-medium text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                />
              </div>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold text-base shadow-lg active:scale-95 transition-all">
              {saving ? 'กำลังบันทึก...' : saved ? '✓ บันทึกแล้ว' : 'บันทึกการตั้งค่า'}
            </button>

            {saveError && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-center">
                <p className="text-red-600 font-semibold text-sm">{saveError}</p>
              </div>
            )}

            {saved && (
              <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-center">
                <p className="text-green-700 font-semibold text-sm">✓ บันทึกการตั้งค่าเรียบร้อยแล้ว</p>
              </div>
            )}

            {/* บัญชีผู้ใช้ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">บัญชีที่ใช้อยู่</p>
                <p className="text-sm text-gray-600 truncate mt-0.5">{displayName(auth.currentUser?.email)}</p>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm px-4 py-2.5 active:scale-95 transition-all"
              >
                <LogOut size={15} />
                ออกจากระบบ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
