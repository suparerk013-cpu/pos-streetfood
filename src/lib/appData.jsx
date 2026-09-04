import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { AppDataContext } from './appDataContext'
import {
  DEFAULT_CONSUMABLE_COST,
  DEFAULT_GP_RATE,
  DEFAULT_PACKAGING_COST,
  DELIVERY_PLATFORMS,
} from './constants'
import { db } from './firebase'

/**
 * ข้อมูลที่ทุกหน้าใช้ร่วมกัน (สินค้า, วัตถุดิบ, กะ, ตั้งค่าร้าน, สถานะเน็ต)
 *
 * เดิมแต่ละหน้าเปิด onSnapshot ของตัวเอง — สินค้าถูกฟังซ้ำ 3 ที่ ตั้งค่าร้านซ้ำ 4 ที่
 * รวมมาไว้ที่เดียวทำให้จำนวน listener ลดลงและข้อมูลตรงกันทุกหน้า
 */
export function AppDataProvider({ children }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [ingredients, setIngredients] = useState([])
  const [ingredientsLoading, setIngredientsLoading] = useState(true)
  const [shifts, setShifts] = useState([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [store, setStore] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      )
      setProductsLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'ingredients'), (snap) => {
      setIngredients(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')),
      )
      setIngredientsLoading(false)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('opened_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setShiftsLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
      setStore(snap.exists() ? snap.data() : {})
    })
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
    ingredients,
    activeIngredients: ingredients.filter((i) => i.is_active !== false),
    ingredientsLoading,
    shifts,
    shiftsLoading,
    currentShift: shifts.find((s) => s.status === 'open') ?? null,
    closedShifts: shifts.filter((s) => s.status === 'closed'),
    store: store ?? {},
    storeLoading: store === null,
    shopName: store?.shop_name ?? '',
    enabledPlatforms: store?.enabled_delivery_platforms ?? DELIVERY_PLATFORMS,
    // ตัวเลขต้นทุน/GP ที่ใช้คำนวณกำไรทั้งระบบ ตั้งได้ในหน้าตั้งค่า
    gpRates: store?.platform_gp ?? {},
    gpRateFor: (platform) => store?.platform_gp?.[platform] ?? DEFAULT_GP_RATE,
    packagingCost: store?.packaging_cost ?? DEFAULT_PACKAGING_COST,
    consumableCost: store?.consumable_cost ?? DEFAULT_CONSUMABLE_COST,
    ingredientById: new Map(ingredients.map((i) => [i.id, i])),
    online,
  }), [products, productsLoading, ingredients, ingredientsLoading, shifts, shiftsLoading, store, online])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
