import { BarChart3, Menu, Receipt, RefreshCw, ShoppingCart } from 'lucide-react'

/**
 * เมนูล่างบนมือถือ 5 ปุ่ม — เดิม 7 ปุ่มจนตัวหนังสือเล็กและกดพลาดง่าย
 * หน้าที่เปิดไม่บ่อย (คลัง เอกสาร ตั้งค่า) ย้ายไปอยู่ใน "เพิ่มเติม"
 */
const TABS = [
  { key: 'sales', label: 'ขาย', icon: ShoppingCart },
  { key: 'shift', label: 'กะ', icon: RefreshCw },
  { key: 'reports', label: 'รายงาน', icon: BarChart3 },
  { key: 'expenses', label: 'รายจ่าย', icon: Receipt },
  { key: 'more', label: 'เพิ่มเติม', icon: Menu },
]

/** หน้าที่อยู่ใต้ "เพิ่มเติม" — เปิดอยู่ก็ให้ปุ่มเพิ่มเติมติดสี จะได้รู้ว่าอยู่ตรงไหน */
const MORE_PAGES = ['more', 'inventory', 'documents', 'settings']

function BottomNav({ current, onNavigate, lowStockCount = 0 }) {
  const activeKey = MORE_PAGES.includes(current) ? 'more' : current

  return (
    <nav className="sm:hidden shrink-0 bg-white border-t border-gray-100 flex pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = activeKey === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <span className="relative">
              <Icon size={23} strokeWidth={isActive ? 2.6 : 2} />
              {key === 'more' && lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {lowStockCount > 9 ? '9+' : lowStockCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-bold leading-none">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
