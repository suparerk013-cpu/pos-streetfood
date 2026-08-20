import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { resetDailyStock } from '../lib/stock'

function ShiftPage() {
  const [dailyProducts, setDailyProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [resettingId, setResettingId] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((product) => product.stock_type === 'daily')
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setDailyProducts(items)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleResetDaily = async (product) => {
    setResettingId(product.id)
    try {
      await resetDailyStock(product.id)
    } finally {
      setResettingId(null)
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        <h1 className="font-bold text-lg">ปิดกะ / เปิดกะ</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {!loading && dailyProducts.length === 0 && (
          <p className="text-center text-gray-400 mt-8">
            ไม่มีสินค้าที่เป็นสต็อกรายวัน (stock_type: daily) ในระบบตอนนี้
          </p>
        )}

        <div className="space-y-3">
          {dailyProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl bg-white border border-orange-100 p-4"
            >
              <div className="mb-3">
                <p className="font-bold text-gray-800">{product.name}</p>
                <p className="text-sm text-gray-400">
                  สต็อกวันนี้: {product.stock_qty ?? 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResetDaily(product)}
                disabled={resettingId === product.id}
                className="w-full min-h-[48px] rounded-xl bg-red-50 text-red-600 font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                {resettingId === product.id ? 'กำลังเปิดกะ...' : 'เปิดกะใหม่ (เคลียร์สต็อกวันนี้)'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShiftPage
