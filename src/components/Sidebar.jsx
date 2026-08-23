import { doc, onSnapshot } from 'firebase/firestore'
import { BarChart3, FileText, Package, Receipt, RefreshCw, Settings, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

const NAV_ITEMS = [
  { key: 'sales',     label: 'หน้าขาย',    icon: ShoppingCart },
  { key: 'reports',   label: 'รายงาน',     icon: BarChart3 },
  { key: 'documents', label: 'เอกสาร',     icon: FileText },
  { key: 'inventory', label: 'คลังสินค้า', icon: Package },
  { key: 'shift',     label: 'ปิดกะ/เปิดกะ', icon: RefreshCw },
  { key: 'expenses',  label: 'ค่าใช้จ่าย', icon: Receipt },
  { key: 'settings',  label: 'ตั้งค่า',    icon: Settings },
]

function Sidebar({ current, onNavigate, lowStockCount = 0 }) {
  const [shopName, setShopName]     = useState('')
  const [logoBase64, setLogoBase64] = useState(null)

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
      if (snap.exists()) {
        setShopName(snap.data().shop_name ?? '')
        setLogoBase64(snap.data().logo_base64 ?? null)
      }
    })
  }, [])

  const displayName = shopName || 'ร้านของฉัน'
  const [line1, line2] = displayName.includes(' ')
    ? [displayName.split(' ').slice(0, Math.ceil(displayName.split(' ').length / 2)).join(' '),
       displayName.split(' ').slice(Math.ceil(displayName.split(' ').length / 2)).join(' ')]
    : [displayName, '']

  return (
    <nav className="group hidden sm:flex w-14 hover:w-52 shrink-0 h-full bg-gradient-to-b from-orange-600 to-red-700 text-white flex-col py-4 overflow-hidden transition-[width] duration-300 ease-in-out z-10">
      <div className="px-3 pb-4 mb-2 border-b border-white/20 overflow-hidden flex items-center gap-3 h-16">
        <div className="shrink-0 w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner overflow-hidden">
          {logoBase64
            ? <img src={logoBase64} alt="โลโก้" className="w-full h-full object-cover" />
            : <span className="text-2xl leading-none">🍢</span>
          }
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
          <p className="font-black text-white text-sm leading-tight whitespace-nowrap tracking-wide">{line1}</p>
          {line2 && <p className="font-semibold text-white/70 text-xs leading-tight whitespace-nowrap tracking-wider">{line2}</p>}
        </div>
      </div>

      <ul className="flex flex-col gap-1 px-2 flex-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = current === key
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate(key)}
                title={label}
                className={`relative w-full flex items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 ${
                  isActive ? 'bg-white text-orange-700 font-bold' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="relative shrink-0">
                  <Icon size={22} />
                  {key === 'inventory' && lowStockCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {lowStockCount > 9 ? '9+' : lowStockCount}
                    </span>
                  )}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap text-sm overflow-hidden">
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Sidebar
