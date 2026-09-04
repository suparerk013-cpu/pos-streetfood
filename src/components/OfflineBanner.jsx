import { WifiOff } from 'lucide-react'
import { useAppData } from '../lib/appDataContext'

/**
 * เตือนเมื่อเน็ตหลุด
 *
 * Firestore transaction ทำงานตอนออฟไลน์ไม่ได้ (ต่างจาก write ธรรมดาที่คิวไว้ได้)
 * การออกบิล ตัดสต็อก และปิดกะจึงล้มทั้งหมด — บอกให้รู้ก่อนดีกว่าปล่อยให้กดคิดเงิน
 * แล้วเด้ง error ตอนลูกค้ายืนรออยู่หน้าเตา
 */
function OfflineBanner() {
  const { online } = useAppData()
  if (online) return null

  return (
    <div className="shrink-0 flex items-center justify-center gap-2 bg-gray-800 px-3 py-2 text-white">
      <WifiOff size={15} className="shrink-0" />
      <p className="text-xs font-semibold">
        ออฟไลน์ — ดูข้อมูลได้ แต่คิดเงิน/ปิดกะไม่ได้จนกว่าเน็ตจะกลับมา
      </p>
    </div>
  )
}

export default OfflineBanner
