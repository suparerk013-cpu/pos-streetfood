import { ImageOff, Upload } from 'lucide-react'
import { useState } from 'react'
import { useAppData } from '../lib/appDataContext'
import { DELIVERY_PLATFORMS as PLATFORMS } from '../lib/constants'
import { compressImageToBase64, ImageTooLargeError, InvalidImageError } from '../lib/imageUtils'
import ModalBackdrop from './ModalBackdrop'

function EditProductModal({ product, onClose, onSubmit, onDelete }) {
  const { enabledPlatforms: shopPlatforms } = useAppData()
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [stockQty, setStockQty] = useState(String(product.stock_qty ?? 0))
  const [unit, setUnit] = useState(product.unit ?? 'ชิ้น')
  const [deliveryPrices, setDeliveryPrices] = useState(
    Object.fromEntries(PLATFORMS.map((p) => [p, String(product.delivery_prices?.[p] ?? '')]))
  )
  const [imagePreview, setImagePreview] = useState(product.image_base64 ?? null)
  const [newImageBase64, setNewImageBase64] = useState(null)
  const [processingImage, setProcessingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const isValid = name.trim() !== '' && Number(price) > 0
  const canClose = !saving && !deleting

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete()
    } catch {
      setDeleting(false)
      setDeleteError('ลบไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

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
    shopPlatforms.forEach((p) => {
      if (Number(deliveryPrices[p]) > 0) dpMap[p] = Number(deliveryPrices[p])
    })
    const nextStockQty = Math.max(0, Number(stockQty) || 0)
    const stockDelta = nextStockQty - (product.stock_qty ?? 0)
    const updates = {
      name: name.trim(),
      price: Number(price),
      unit: unit.trim() || 'ชิ้น',
      delivery_prices: dpMap,
    }
    if (newImageBase64) updates.image_base64 = newImageBase64

    try {
      await onSubmit(updates, stockDelta)
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

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">ราคาหน้าร้าน (บาท)</span>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">จำนวนสต็อก</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={stockQty}
              onChange={(event) => setStockQty(event.target.value)}
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">หน่วยนับ</span>
          <input
            type="text"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="เช่น ไม้, ถุง, แก้ว, ชิ้น"
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        {/* Delivery prices */}
        {shopPlatforms.length > 0 && (
          <div className="mb-4 bg-orange-50 rounded-2xl p-3.5 border border-orange-100">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-3">ราคาเดลิเวอรี่ (ถ้าต่างจากหน้าร้าน)</p>
            <div className="grid grid-cols-2 gap-2">
              {shopPlatforms.map((p) => (
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
        )}

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving || processingImage || deleting}
          className="w-full min-h-[56px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>

        {/* Danger zone: delete product */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {deleteError && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{deleteError}</p>
          )}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold active:bg-red-50 transition-all disabled:opacity-40"
            >
              ลบสินค้านี้
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-red-600 text-center font-medium">
                ลบสินค้า "{product.name}" ถาวร กู้คืนไม่ได้
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
                >
                  ไม่ลบ
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 disabled:bg-red-300 text-white text-sm font-bold active:scale-95 transition-all"
                >
                  {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default EditProductModal
