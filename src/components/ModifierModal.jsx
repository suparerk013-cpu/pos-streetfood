import { useState } from 'react'
import { getModifierCategories } from '../lib/cart'
import ModalBackdrop from './ModalBackdrop'

const MODIFIER_LABELS = {
  spice_level: 'ระดับความเผ็ด',
  sauce: 'น้ำจิ้ม',
}

function ModifierModal({ product, initialSelected, onClose, onConfirm }) {
  const categories = getModifierCategories(product)

  // เปิดจากตะกร้า = ต้องขึ้นค่าที่เคยเลือกไว้ ไม่ใช่รีเซ็ตกลับเป็นตัวแรกทุกครั้ง
  const [selected, setSelected] = useState(() => {
    const initial = {}
    categories.forEach(([key, options]) => {
      initial[key] = initialSelected?.[key] ?? options[0]
    })
    return initial
  })

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 shrink-0 rounded-full bg-gray-100 text-gray-500 text-lg flex items-center justify-center"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>

        {categories.map(([categoryKey, options]) => (
          <div key={categoryKey} className="mb-5">
            <p className="font-medium text-gray-600 mb-2">
              {MODIFIER_LABELS[categoryKey] ?? categoryKey}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [categoryKey]: option }))
                  }
                  className={`min-h-[48px] px-4 rounded-xl border-2 font-medium transition-colors ${
                    selected[categoryKey] === option
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="w-full min-h-[56px] rounded-xl bg-orange-600 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          เพิ่มลงตะกร้า
        </button>
      </div>
    </ModalBackdrop>
  )
}

export default ModifierModal
