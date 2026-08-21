import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import BottomNav from './components/BottomNav'
import OpenShiftModal from './components/OpenShiftModal'
import Sidebar from './components/Sidebar'
import { db } from './lib/firebase'
import DocumentsPage from './pages/DocumentsPage'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import SettingsPage from './pages/SettingsPage'
import ShiftPage from './pages/ShiftPage'

const PAGES = {
  sales: SalesPage,
  reports: ReportsPage,
  documents: DocumentsPage,
  inventory: InventoryPage,
  shift: ShiftPage,
  expenses: ExpensesPage,
  settings: SettingsPage,
}

function App() {
  const [page, setPage] = useState('sales')
  const [shifts, setShifts] = useState([])
  const [shiftLoading, setShiftLoading] = useState(true)
  const [shiftModalDismissed, setShiftModalDismissed] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('opened_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setShiftLoading(false)
    })
  }, [])

  const currentShift = useMemo(() => shifts.find((s) => s.status === 'open') ?? null, [shifts])

  const handleNavigate = (p) => {
    if (p === 'sales') setShiftModalDismissed(false)
    setPage(p)
  }

  const showOpenShiftModal =
    page === 'sales' && !shiftLoading && !currentShift && !shiftModalDismissed

  const PageComponent = PAGES[page] ?? SalesPage

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar current={page} onNavigate={handleNavigate} />
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <PageComponent />
        </div>
        <BottomNav current={page} onNavigate={handleNavigate} />
      </div>

      {showOpenShiftModal && (
        <OpenShiftModal onClose={() => setShiftModalDismissed(true)} />
      )}
    </div>
  )
}

export default App
