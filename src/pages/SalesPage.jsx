import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import CartSheet from '../components/CartSheet'
import CheckoutModal from '../components/CheckoutModal'
import ModifierModal from '../components/ModifierModal'
import ProductGrid from '../components/ProductGrid'
import SuccessModal from '../components/SuccessModal'
import {
  addItemToCart,
  getModifierCategories,
  removeItem,
  updateItemQuantity,
} from '../lib/cart'
import { db } from '../lib/firebase'
import { seedInitialProducts } from '../lib/seedProducts'

function SalesPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [modalProduct, setModalProduct] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successResult, setSuccessResult] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((product) => product.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setProducts(items)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSelectProduct = (product) => {
    if ((product.stock_qty ?? 0) <= 0) return
    const hasModifiers = getModifierCategories(product).length > 0
    if (!hasModifiers) {
      setCart((prev) => addItemToCart(prev, product, {}))
      return
    }
    setModalProduct(product)
  }

  const handleConfirmModifiers = (selectedModifiers) => {
    setCart((prev) => addItemToCart(prev, modalProduct, selectedModifiers))
    setModalProduct(null)
  }

  const handleIncrement = (key) => setCart((prev) => updateItemQuantity(prev, key, 1))
  const handleDecrement = (key) => setCart((prev) => updateItemQuantity(prev, key, -1))
  const handleRemove = (key) => setCart((prev) => removeItem(prev, key))

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedInitialProducts()
    } finally {
      setSeeding(false)
    }
  }

  const handleCheckoutSuccess = (result) => {
    setCheckoutOpen(false)
    setCart([])
    setSuccessResult(result)
  }

  return (
    <div className="h-full w-full flex flex-col bg-orange-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-sm shrink-0">
        <h1 className="font-bold text-lg">หมึกย่าง หอยแมลงภู่</h1>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs bg-white/20 px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {seeding ? 'กำลัง Seed...' : 'Seed ข้อมูลตัวอย่าง (dev)'}
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!loading && (
          <ProductGrid products={products} onSelectProduct={handleSelectProduct} />
        )}
      </div>

      <CartSheet
        cart={cart}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
        onCheckout={() => setCheckoutOpen(true)}
      />

      {modalProduct && (
        <ModifierModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onConfirm={handleConfirmModifiers}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {successResult && (
        <SuccessModal result={successResult} onClose={() => setSuccessResult(null)} />
      )}
    </div>
  )
}

export default SalesPage
