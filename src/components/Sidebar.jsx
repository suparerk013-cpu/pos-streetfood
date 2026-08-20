import { BarChart3, Package, Receipt, RefreshCw, Settings, ShoppingCart } from 'lucide-react'

const NAV_ITEMS = [
  { key: 'sales', label: 'หน้าขาย', icon: ShoppingCart },
  { key: 'inventory', label: 'คลังสินค้า', icon: Package },
  { key: 'shift', label: 'ปิดกะ/เปิดกะ', icon: RefreshCw },
  { key: 'expenses', label: 'ค่าใช้จ่าย', icon: Receipt },
  { key: 'reports', label: 'รายงาน', icon: BarChart3, disabled: true },
  { key: 'settings', label: 'ตั้งค่า', icon: Settings, disabled: true },
]

function Sidebar({ current, onNavigate }) {
  return (
    <nav className="w-16 sm:w-56 shrink-0 h-full bg-gradient-to-b from-orange-600 to-red-700 text-white flex flex-col py-4 overflow-y-auto">
      <div className="hidden sm:block px-4 pb-4 mb-2 border-b border-white/20">
        <p className="font-bold leading-tight">
          หมึกย่าง
          <br />
          หอยแมลงภู่
        </p>
      </div>

      <ul className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ key, label, icon: Icon, disabled }) => {
          const isActive = current === key
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => !disabled && onNavigate(key)}
                disabled={disabled}
                title={label}
                className={`w-full flex items-center justify-center sm:justify-start gap-3 rounded-xl px-0 sm:px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-white text-orange-700 font-bold'
                    : 'text-white/85 hover:bg-white/10'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Icon size={22} className="shrink-0" />
                <span className="hidden sm:inline text-sm">{label}</span>
                {disabled && (
                  <span className="hidden sm:inline ml-auto text-[10px] bg-white/20 rounded px-1.5 py-0.5">
                    เร็วๆนี้
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Sidebar
