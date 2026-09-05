import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import OpenShiftModal from './components/OpenShiftModal'
import Sidebar from './components/Sidebar'
import { AppDataProvider } from './lib/appData'
import { useAppData } from './lib/appDataContext'
import { watchAuth } from './lib/auth'
import { LOW_STOCK_THRESHOLD } from './lib/constants'
import LoginPage from './pages/LoginPage'
import SalesPage from './pages/SalesPage'

// หน้าขายโหลดมาพร้อมแอปเพราะเป็นหน้าที่เปิดตลอดวัน ส่วนหน้าอื่นโหลดเมื่อกดเข้าไป
// ทำให้บันเดิลก้อนแรกเล็กลงและแอปเปิดเร็วขึ้นบนมือถือหน้าร้าน
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const ShiftPage = lazy(() => import('./pages/ShiftPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const PAGES = {
  sales: SalesPage,
  reports: ReportsPage,
  documents: DocumentsPage,
  inventory: InventoryPage,
  shift: ShiftPage,
  expenses: ExpensesPage,
  settings: SettingsPage,
}

function PageFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">กำลังโหลด...</p>
    </div>
  )
}

function Shell() {
  const { activeProducts, shiftsLoading, currentShift } = useAppData()
  const [page, setPage] = useState('sales')
  const [shiftModalDismissed, setShiftModalDismissed] = useState(false)

  const lowStockCount = useMemo(
    () => activeProducts.filter((p) => (p.stock_qty ?? 0) <= LOW_STOCK_THRESHOLD).length,
    [activeProducts],
  )

  const handleNavigate = (p) => {
    if (p === 'sales') setShiftModalDismissed(false)
    setPage(p)
  }

  const showOpenShiftModal =
    page === 'sales' && !shiftsLoading && !currentShift && !shiftModalDismissed

  const PageComponent = PAGES[page] ?? SalesPage

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar current={page} onNavigate={handleNavigate} lowStockCount={lowStockCount} />
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <OfflineBanner />
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* key=page ทำให้กลับมาใช้งานได้เองเมื่อกดเมนูไปหน้าอื่น ไม่ต้องปิดแอปทิ้ง */}
          <ErrorBoundary key={page}>
            <Suspense fallback={<PageFallback />}>
              <PageComponent />
            </Suspense>
          </ErrorBoundary>
        </div>
        <BottomNav current={page} onNavigate={handleNavigate} lowStockCount={lowStockCount} />
      </div>

      {showOpenShiftModal && <OpenShiftModal onClose={() => setShiftModalDismissed(true)} />}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    return watchAuth((nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)
    })
  }, [])

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-orange-50">
        <p className="text-gray-400 text-sm">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  )
}

export default App
