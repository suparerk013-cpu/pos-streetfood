import { BarChart3, FileText, Package, Receipt, RefreshCw, Settings, ShoppingCart } from 'lucide-react'

const TABS = [
  { key: 'sales', label: 'หน้าขาย', icon: ShoppingCart },
  { key: 'reports', label: 'รายงาน', icon: BarChart3 },
  { key: 'documents', label: 'เอกสาร', icon: FileText },
  { key: 'inventory', label: 'คลัง', icon: Package },
  { key: 'shift', label: 'ปิดกะ', icon: RefreshCw },
  { key: 'expenses', label: 'รายจ่าย', icon: Receipt },
  { key: 'settings', label: 'ตั้งค่า', icon: Settings },
]

function BottomNav({ current, onNavigate }) {
  return (
    <nav className="sm:hidden shrink-0 bg-gradient-to-r from-orange-600 to-red-600 flex border-t border-orange-700/30">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = current === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all ${
              isActive ? 'text-orange-600' : 'text-white/75'
            }`}
          >
            <div className={`rounded-xl px-2 py-1 transition-all ${isActive ? 'bg-white shadow-md' : ''}`}>
              <Icon size={19} />
            </div>
            <span className={`text-[9px] font-bold leading-none ${isActive ? 'text-white' : 'text-white/75'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
