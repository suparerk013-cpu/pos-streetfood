import { ChevronRight, FileText, Package, Settings } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAppData } from '../lib/appDataContext'

const ITEMS = [
  { key: 'inventory', label: 'คลังสินค้า', hint: 'เติมของ ตั้งราคา ตั้งโปร จัดเซ็ต', icon: Package, color: 'bg-orange-500' },
  { key: 'documents', label: 'เอกสาร', hint: 'ใบเสร็จ ประวัติบิล', icon: FileText, color: 'bg-sky-600' },
  { key: 'settings', label: 'ตั้งค่า', hint: 'ข้อมูลร้าน ค่า GP เดลิเวอรี บัญชี', icon: Settings, color: 'bg-slate-700' },
]

/** หน้ารวมเมนูที่เปิดไม่บ่อย ให้เมนูล่างเหลือ 5 ปุ่มที่ใช้ทุกวัน */
function MorePage({ onNavigate, lowStockCount = 0 }) {
  const { shopName } = useAppData()
  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      <PageHeader title="เพิ่มเติม" small={shopName || undefined} />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2.5 max-w-xl w-full mx-auto">
        {ITEMS.map(({ key, label, hint, icon: Icon, color }) => (
          <button key={key} type="button" onClick={() => onNavigate?.(key)}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm text-left active:scale-[0.98] transition-transform">
            <span className={`w-14 h-14 shrink-0 rounded-2xl ${color} text-white flex items-center justify-center`}>
              <Icon size={26} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-lg font-black text-gray-900">{label}</span>
              <span className="block text-sm text-gray-400 truncate">{hint}</span>
            </span>
            {key === 'inventory' && lowStockCount > 0 && (
              <span className="shrink-0 text-xs font-black bg-red-500 text-white rounded-full px-2 py-1">
                {lowStockCount} ใกล้หมด
              </span>
            )}
            <ChevronRight className="shrink-0 text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default MorePage
