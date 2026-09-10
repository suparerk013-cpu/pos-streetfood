import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import OpenShiftModal from './components/OpenShiftModal'
import Sidebar from './components/Sidebar'
import { AppDataProvider, useAppData } from './lib/AppDataContext'
import DocumentsPage from './pages/DocumentsPage'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import SettingsPage from './pages/SettingsPage'
import ShiftPage from './pages/ShiftPage'

const NAV_KEYS = ['sales', 'reports', 'documents', 'inventory', 'shift', 'expenses', 'settings']

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [shiftModalDismissed, setShiftModalDismissed] = useState(false)

  const { productsLoading, shiftsLoading, currentShift, lowStockCount } = useAppData()

  const page = NAV_KEYS.find((key) => location.pathname === `/${key}`) ?? 'sales'

  const handleNavigate = (p) => {
    if (p === 'sales') setShiftModalDismissed(false)
    navigate(`/${p}`)
  }

  const showOpenShiftModal =
    page === 'sales' && !shiftsLoading && !productsLoading && !currentShift && !shiftModalDismissed

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar current={page} onNavigate={handleNavigate} lowStockCount={lowStockCount} />
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/sales" replace />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/shift" element={<ShiftPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/sales" replace />} />
          </Routes>
        </div>
        <BottomNav current={page} onNavigate={handleNavigate} lowStockCount={lowStockCount} />
      </div>

      {showOpenShiftModal && (
        <OpenShiftModal onClose={() => setShiftModalDismissed(true)} />
      )}
    </div>
  )
}

function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  )
}

export default App
