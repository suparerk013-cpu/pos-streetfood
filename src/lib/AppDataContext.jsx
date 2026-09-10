import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from './firebase'

const LOW_STOCK_THRESHOLD = 10

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  const [shifts, setShifts] = useState([])
  const [shiftsLoading, setShiftsLoading] = useState(true)

  const [storeSettings, setStoreSettings] = useState({})
  const [storeSettingsLoading, setStoreSettingsLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setProductsLoading(false)
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
      setStoreSettings(snap.exists() ? snap.data() : {})
      setStoreSettingsLoading(false)
    })
  }, [])

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products])

  const lowStockCount = useMemo(
    () => activeProducts.filter((p) => (p.stock_qty ?? 0) <= LOW_STOCK_THRESHOLD).length,
    [activeProducts],
  )

  const currentShift = useMemo(() => shifts.find((s) => s.status === 'open') ?? null, [shifts])

  const value = {
    products,
    activeProducts,
    productsLoading,
    shifts,
    shiftsLoading,
    currentShift,
    storeSettings,
    storeSettingsLoading,
    lowStockCount,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData ต้องถูกเรียกภายใน <AppDataProvider>')
  return ctx
}
