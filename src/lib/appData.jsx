import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { AppDataContext } from './appDataContext'
import { DEFAULT_GP_RATE, DELIVERY_PLATFORMS } from './constants'
import { db } from './firebase'
import { logSnapshotError } from './snapshotError'

/**
 * ข้อมูลที่ทุกหน้าใช้ร่วมกัน (สินค้า, กะ, ตั้งค่าร้าน, สถานะเน็ต)
 *
 * เดิมแต่ละหน้าเปิด onSnapshot ของตัวเอง — สินค้าถูกฟังซ้ำ 3 ที่ ตั้งค่าร้านซ้ำ 4 ที่
 * รวมมาไว้ที่เดียวทำให้จำนวน listener ลดลงและข้อมูลตรงกันทุกหน้า
 */
const RECENT_SHIFTS = 60

export function AppDataProvider({ children }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [shifts, setShifts] = useState([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [store, setStore] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [dataError, setDataError] = useState(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      )
      setProductsLoading(false)
      setDataError(null)
    }, logSnapshotError('สินค้า', setDataError))
  }, [])

  useEffect(() => {
    // ฟังแค่กะล่าสุดพอสำหรับหาว่ากะไหนเปิดอยู่และโชว์ประวัติในหน้าปิดกะ
    // เดิมโหลดทุกกะที่เคยมีทุกครั้งที่เปิดแอป ปีนึงก็ 365 เอกสาร โตไปเรื่อย ๆ ไม่มีเพดาน
    // รายงานย้อนหลังไกลกว่านี้ดึงเองตามช่วงที่เลือก (useShiftsInRange)
    const q = query(collection(db, 'shifts'), orderBy('opened_at', 'desc'), limit(RECENT_SHIFTS))
    return onSnapshot(q, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setShiftsLoading(false)
    }, logSnapshotError('กะ', setDataError))
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
      setStore(snap.exists() ? snap.data() : {})
    }, logSnapshotError('ตั้งค่าร้าน', setDataError))
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const value = useMemo(() => ({
    products,
    activeProducts: products.filter((p) => p.is_active),
    productsLoading,
    productById: new Map(products.map((p) => [p.id, p])),
    shifts,
    shiftsLoading,
    currentShift: shifts.find((s) => s.status === 'open') ?? null,
    closedShifts: shifts.filter((s) => s.status === 'closed'),
    store: store ?? {},
    storeLoading: store === null,
    shopName: store?.shop_name ?? '',
    enabledPlatforms: store?.enabled_delivery_platforms ?? DELIVERY_PLATFORMS,
    // ค่า GP ที่แต่ละแอปหัก ตั้งได้ในหน้าตั้งค่า ใช้คิดเงินที่เข้ากระเป๋าจริงจากเดลิเวอรี
    gpRates: store?.platform_gp ?? {},
    gpRateFor: (platform) => store?.platform_gp?.[platform] ?? DEFAULT_GP_RATE,
    online,
    dataError,
  }), [products, productsLoading, shifts, shiftsLoading, store, online, dataError])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
