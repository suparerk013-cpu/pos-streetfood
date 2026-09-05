import { ImageOff, Upload } from 'lucide-react'
import { useState } from 'react'
import { productCategoryLabel } from '../lib/constants'
import { compressImageToBase64, ImageTooLargeError, InvalidImageError } from '../lib/imageUtils'
import ModalBackdrop from './ModalBackdrop'

function AddProductModal({ onClose, onSubmit, existingCategories = [] }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [stockQty, setStockQty] = useState('')
  const [unit, setUnit] = useState('')
  const [stockType, setStockType] = useState('batch')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
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
      setImageBase64(base64)
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

    try {
      await onSubmit({
        name: name.trim(),
        price: Number(price),
        category: category.trim() || 'other',
        stockQty: Math.max(0, Number(stockQty) || 0),
        unit: unit.trim() || 'ชิ้น',
        stockType,
        imageBase64,
        // สินค้าเดี่ยวขายหน้าร้านเสมอ — เดลิเวอรีขายเป็นเซ็ตที่ตั้งราคาเผื่อ GP ไว้แล้ว
        channel: 'store',
        deliveryPrice: null,
      })
    } catch {
      setSaving(false)
      setError('บันทึกไม่สำเร็จ อาจเป็นเพราะอินเทอร์เน็ตขัดข้อง ลองอีกครั้ง')
    }
  }

  return (
    <ModalBackdrop onClose={onClose} canClose={canClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">เพิ่มสินค้าใหม่</h2>
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
            {processingImage ? 'กำลังประมวลผลรูป...' : imagePreview ? 'เปลี่ยนรูป' : 'อัปโหลดรูป (ไม่บังคับ)'}
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
            placeholder="เช่น น้ำเปล่า"
            className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
          />
        </label>

        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">ราคา (บาท)</span>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="20"
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">หมวดหมู่</span>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="เช่น ปลาหมึก, เครื่องดื่ม"
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4"
            />
            {/* กดเลือกจากหมวดที่มีอยู่ กันพิมพ์ไม่ตรงกันจนกลายเป็นคนละหมวด */}
            {existingCategories.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {existingCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                      category === cat
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {productCategoryLabel(cat)}
                  </button>
                ))}
              </span>
            )}
          </label>
        </div>

        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">จำนวนสต็อกเริ่มต้น</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={stockQty}
              onChange={(event) => setStockQty(event.target.value)}
              placeholder="0"
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">หน่วยนับ</span>
            <input
              type="text"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="เช่น ไม้, ถุง, แก้ว, ชิ้น"
              className="mt-1 w-full min-h-[52px] rounded-xl border border-gray-200 px-4 text-lg"
            />
          </label>
        </div>

        <div className="mb-3">
          <span className="text-sm font-medium text-gray-600">ประเภทสต็อก</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStockType('batch')}
              title="ล็อต (อยู่ได้หลายวัน)"
              className={`min-h-[52px] rounded-xl border-2 font-medium text-sm transition-colors ${
                stockType === 'batch'
                  ? 'border-orange-600 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              ล็อต
            </button>
            <button
              type="button"
              onClick={() => setStockType('daily')}
              title="รายวัน (เปิดกะใหม่ทุกวัน)"
              className={`min-h-[52px] rounded-xl border-2 font-medium text-sm transition-colors ${
                stockType === 'daily'
                  ? 'border-orange-600 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              รายวัน
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {stockType === 'batch' ? 'สินค้าที่อยู่ได้หลายวัน' : 'สินค้าที่ต้องนับใหม่ทุกวัน'}
          </p>
        </div>

        <p className="mb-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 leading-relaxed">
          🏠 สินค้าที่เพิ่มตรงนี้ขายหน้าร้าน — หน้าเดลิเวอรีขายเฉพาะสินค้าจัดเซ็ต
          สร้างเซ็ตได้ที่แท็บ &ldquo;เซ็ต&rdquo; แล้วเลือกสินค้าตัวนี้เป็นส่วนประกอบ
        </p>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving || processingImage}
          className="w-full min-h-[56px] rounded-xl bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {saving ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default AddProductModal
