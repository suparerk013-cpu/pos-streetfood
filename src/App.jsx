import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import ShiftPage from './pages/ShiftPage'

const PAGES = {
  sales: SalesPage,
  inventory: InventoryPage,
  shift: ShiftPage,
  expenses: ExpensesPage,
}

function App() {
  const [page, setPage] = useState('sales')
  const PageComponent = PAGES[page] ?? SalesPage

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar current={page} onNavigate={setPage} />
      <div className="flex-1 min-w-0 h-full">
        <PageComponent />
      </div>
    </div>
  )
}

export default App
