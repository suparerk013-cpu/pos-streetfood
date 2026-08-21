import { ImageOff, Upload } from 'lucide-react'
import { useState } from 'react'
import { compressImageToBase64, ImageTooLargeError, InvalidImageError } from '../lib/imageUtils'
import ModalBackdrop from './ModalBackdrop'

const PLATFORMS = ['GrabFood', 'LINE MAN', 'Shopee Food', 'Robinhood']

function EditProductModal({ product, onClose, onSubmit }) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [deliveryPrices, setDeliveryPrices] = useState(
    Object.fromEntries(PLATFORMS.map((p) => [p, String(product.delivery_prices?.[p] ?? '')]))
  )
  const [imagePreview, setImagePreview] = useState(product.image_base64 ?? null)
  const [newImageBase64, setNewImageBase64] = useState(null)
  const [processingImage, setProcessingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isValid = name.trim() !== '' && Number(price) > 0
  const canClose = !saving

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setProcessingImage(true)
    try {
      const base64 = await compressImageToBase64(file)
      setImagePreview(base64)
      setNewImageBase64(base64)
    } catch (err) {
      if (err instanceof InvalidImageError || err instanceof ImageTooLargeError) {
        setError(err.message)
      } else {
        setError('ประมวลผลรูปภาพไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
    } finally {
      setProcessingImage(false)
    }
  }

  const handleSubmit = async () => {
    if (!isValid || saving || processingImage) return
    setSaving(true)
    setError(null)

    const dpMap = {}
    PLATFORMS.forEach((p) => { if (Number(deliveryPrices[p]) > 0) dpMap[p] = Number(deliveryPrices[p]) })
    const updates = { name: name.trim(), price: Number(price), delivery_prices: dpMap }
    if (newImageBase64) updates.image_base64 = newImageBase64

    try {
      await onSubmit(updates)
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">แก้ไขสินค้า</h2>
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

        <div className="mb-4 flex flex-col items-center">
          <div className="w-28 h-28 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden mb-2">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageOff className="text-gray-300" size={36} />
            )}
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer active:scale-95 transition-transform">
            <Upload size={16} />
            {processingImage ? 'กำลังประมวลผลรูป...' : imagePreview ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={processingImage || saving}
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">ชื่อสินค้า</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">ราคาหน้าร้าน (บาท)</span>
          <input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        {/* Delivery prices */}
        <div className="mb-4 bg-orange-50 rounded-2xl p-3.5 border border-orange-100">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-3">ราคาเดลิเวอรี่ (ถ้าต่างจากหน้าร้าน)</p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => (
              <label key={p} className="block">
                <span className="text-xs font-medium text-gray-600">{p}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={deliveryPrices[p]}
                  onChange={(e) => setDeliveryPrices((prev) => ({ ...prev, [p]: e.target.value }))}
                  placeholder={price || '0'}
                  className="mt-0.5 w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold"
                />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving || processingImage}
          className="w-full min-h-[56px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default EditProductModal
