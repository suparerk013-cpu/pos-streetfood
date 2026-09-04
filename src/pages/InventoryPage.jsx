import { ImageOff, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import AddProductModal from '../components/AddProductModal'
import EditProductModal from '../components/EditProductModal'
import StockLogModal from '../components/StockLogModal'
import StockModal from '../components/StockModal'
import { useAppData } from '../lib/appDataContext'
import { LOW_STOCK_THRESHOLD, productCategoryLabel } from '../lib/constants'
import { addProduct, deleteProduct, updateProduct } from '../lib/products'
import { seedInitialProducts } from '../lib/seedProducts'
import { adjustStock, restockProduct } from '../lib/stock'

function InventoryPage() {
  const { products: allProducts, productsLoading: loading } = useAppData()
  const [stockModalTarget, setStockModalTarget] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [logTarget, setLogTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // สินค้าที่ถูกซ่อน (is_active = false) ยังอยู่ในระบบเพื่อให้บิลเก่าอ้างถึงได้
  const products = useMemo(
    () => (showArchived ? allProducts : allProducts.filter((p) => p.is_active !== false)),
    [allProducts, showArchived],
  )
  const existingCategories = useMemo(
    () => [...new Set(allProducts.map((p) => p.category).filter(Boolean))],
    [allProducts],
  )
  const archivedCount = useMemo(
    () => allProducts.filter((p) => p.is_active === false).length,
    [allProducts],
  )

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedInitialProducts()
    } finally {
      setSeeding(false)
    }
  }

  const handleStockSubmit = async (qty, note) => {
    const { product } = stockModalTarget
    await restockProduct({ productId: product.id, qty, note })
    setStockModalTarget(null)
  }

  const handleAddProduct = async (data) => {
    const nextSortOrder =
      products.reduce((max, p) => Math.max(max, p.sort_order ?? 0), 0) + 1
    await addProduct({ ...data, sortOrder: nextSortOrder })
    setAddModalOpen(false)
  }

  const handleEditProduct = async (updates, stockDelta) => {
    await updateProduct(editTarget.id, updates)
    if (stockDelta) await adjustStock(editTarget.id, stockDelta, 'แก้ไขจากหน้าแก้ไขสินค้า')
    setEditTarget(null)
  }

  const handleDeleteProduct = async () => {
    await deleteProduct(editTarget.id)
    setEditTarget(null)
  }

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter((p) => p.name?.toLowerCase().includes(term))
  }, [products, search])

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

        <div className="mb-4 flex items-center gap-2 bg-white rounded-2xl border border-gray-200 px-3.5 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="search"
            inputMode="search"
            placeholder="ค้นหาชื่อสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-gray-400 shrink-0">
              <X size={16} />
            </button>
          )}
        </div>

        {!loading && allProducts.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-10">
            <span className="text-5xl">📦</span>
            <p className="text-gray-400 text-sm">ยังไม่มีสินค้าในระบบ</p>
            <button type="button" onClick={handleSeed} disabled={seeding}
              className="rounded-2xl bg-orange-500 text-white font-bold text-sm px-5 py-2.5 disabled:bg-gray-300 active:scale-95 transition-all">
              {seeding ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้าตัวอย่าง (หมึกย่าง / หอยแมลงภู่)'}
            </button>
          </div>
        )}

        {!loading && archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived((v) => !v)}
            className={`mb-3 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              showArchived ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
            {showArchived ? '✕ ซ่อนสินค้าที่เลิกขาย' : `แสดงสินค้าที่เลิกขาย (${archivedCount})`}
          </button>
        )}

        {!loading && products.length > 0 && visibleProducts.length === 0 && (
          <p className="text-center text-gray-400 mt-8">ไม่พบสินค้าที่ค้นหา</p>
        )}

        <div className="space-y-3">
          {visibleProducts.map((product) => {
            const qty = product.stock_qty ?? 0
            const isLow = qty <= LOW_STOCK_THRESHOLD
            const isArchived = product.is_active === false

            return (
              <div
                key={product.id}
                className={`rounded-2xl border p-4 ${
                  isArchived ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-orange-100'
                }`}
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
                      <p className="font-bold text-gray-800">
                        {product.name}
                        {isArchived && (
                          <span className="ml-2 text-[10px] font-bold bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 align-middle">
                            เลิกขาย
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-400">
                        {productCategoryLabel(product.category)} · {product.price} ฿ ·{' '}
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
                    onClick={() => setEditTarget(product)}
                    className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-gray-700 font-medium active:scale-95 transition-transform"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTarget(product)}
                    className="min-h-[44px] flex-1 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 font-medium active:scale-95 transition-transform text-sm"
                  >
                    📋 ประวัติ
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
        <AddProductModal
          onClose={() => setAddModalOpen(false)}
          onSubmit={handleAddProduct}
          existingCategories={existingCategories}
        />
      )}

      {editTarget && (
        <EditProductModal
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEditProduct}
          onDelete={handleDeleteProduct}
        />
      )}

      {logTarget && (
        <StockLogModal product={logTarget} onClose={() => setLogTarget(null)} />
      )}
    </div>
  )
}

export default InventoryPage
