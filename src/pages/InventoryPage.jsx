import { collection, onSnapshot } from 'firebase/firestore'
import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import AddProductModal from '../components/AddProductModal'
import EditProductModal from '../components/EditProductModal'
import StockModal from '../components/StockModal'
import { db } from '../lib/firebase'
import { addProduct, updateProduct } from '../lib/products'
import { adjustStock, restockProduct } from '../lib/stock'

const LOW_STOCK_THRESHOLD = 10

function InventoryPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [stockModalTarget, setStockModalTarget] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setProducts(items)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleStockSubmit = async (qty, note, purchasePrice) => {
    const { product, mode } = stockModalTarget
    if (mode === 'restock') {
      await restockProduct({
        productId: product.id,
        productName: product.name,
        qty,
        note,
        purchasePrice,
      })
    } else {
      await adjustStock(product.id, qty, note)
    }
    setStockModalTarget(null)
  }

  const handleAddProduct = async (data) => {
    const nextSortOrder =
      products.reduce((max, p) => Math.max(max, p.sort_order ?? 0), 0) + 1
    await addProduct({ ...data, sortOrder: nextSortOrder })
    setAddModalOpen(false)
  }

  const handleEditProduct = async (updates) => {
    await updateProduct(editTarget.id, updates)
    setEditTarget(null)
  }

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        <h1 className="font-bold text-lg">คลังสินค้า</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="mb-4 w-full min-h-[56px] rounded-2xl border-2 border-dashed border-orange-300 text-orange-600 font-bold active:scale-95 transition-transform"
        >
          + เพิ่มสินค้าใหม่
        </button>

        {!loading && products.length === 0 && (
          <p className="text-center text-gray-400 mt-8">ยังไม่มีสินค้า</p>
        )}

        <div className="space-y-3">
          {products.map((product) => {
            const qty = product.stock_qty ?? 0
            const isLow = qty < LOW_STOCK_THRESHOLD

            return (
              <div
                key={product.id}
                className="rounded-2xl bg-white border border-orange-100 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                      {product.image_base64 ? (
                        <img
                          src={product.image_base64}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageOff className="text-gray-300" size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-400">
                        {product.category} · {product.price} ฿ ·{' '}
                        {product.stock_type === 'daily' ? 'สต็อกรายวัน' : 'สต็อกล็อต'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                      {qty}
                    </p>
                    {isLow && (
                      <span className="inline-block rounded-full bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5">
                        สต็อกต่ำ
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStockModalTarget({ product, mode: 'restock' })}
                    className="min-h-[44px] flex-1 rounded-xl bg-orange-600 text-white font-medium active:scale-95 transition-transform"
                  >
                    นำเข้าสต็อก
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockModalTarget({ product, mode: 'adjustment' })}
                    className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-gray-700 font-medium active:scale-95 transition-transform"
                  >
                    ปรับสต็อก
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTarget(product)}
                    className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-gray-700 font-medium active:scale-95 transition-transform"
                  >
                    แก้ไข
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {stockModalTarget && (
        <StockModal
          product={stockModalTarget.product}
          mode={stockModalTarget.mode}
          onClose={() => setStockModalTarget(null)}
          onSubmit={handleStockSubmit}
        />
      )}

      {addModalOpen && (
        <AddProductModal onClose={() => setAddModalOpen(false)} onSubmit={handleAddProduct} />
      )}

      {editTarget && (
        <EditProductModal
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEditProduct}
        />
      )}
    </div>
  )
}

export default InventoryPage
