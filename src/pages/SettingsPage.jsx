import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ImageOff, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { compressImageToBase64, ImageTooLargeError, InvalidImageError } from '../lib/imageUtils'
import { db } from '../lib/firebase'

const PLATFORMS = ['GrabFood', 'LINE MAN', 'Shopee Food', 'Robinhood']

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
  const [shopName, setShopName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [address, setAddress]       = useState('')
  const [billNote, setBillNote]     = useState('')
  const [logoBase64, setLogoBase64] = useState(null)
  const [newLogo, setNewLogo]       = useState(null)
  const [processingLogo, setProcessingLogo] = useState(false)
  const [logoError, setLogoError]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [deliveryPlatforms, setDeliveryPlatforms] = useState(PLATFORMS)

  useEffect(() => {
    getDoc(doc(db, 'settings', 'store')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setShopName(d.shop_name ?? '')
        setPhone(d.phone ?? '')
        setAddress(d.address ?? '')
        setBillNote(d.bill_note ?? '')
        setLogoBase64(d.logo_base64 ?? null)
        setDeliveryPlatforms(d.enabled_delivery_platforms ?? PLATFORMS)
      }
      setLoading(false)
    })
  }, [])

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
    const payload = {
      shop_name: shopName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      bill_note: billNote.trim(),
    }
    if (newLogo) payload.logo_base64 = newLogo
    payload.enabled_delivery_platforms = deliveryPlatforms
    await setDoc(doc(db, 'settings', 'store'), payload, { merge: true })
    setSaving(false)
    setSaved(true)
    setNewLogo(null)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-3 shadow-sm">
        <h1 className="font-bold text-lg">ตั้งค่าร้าน</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {loading ? (
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

            {saved && (
              <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-center">
                <p className="text-green-700 font-semibold text-sm">✓ บันทึกการตั้งค่าเรียบร้อยแล้ว</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
