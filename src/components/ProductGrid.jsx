import { colorOfCategory } from '../lib/categoryColors'
import ProductCard from './ProductCard'

function ProductGrid({ products, cartQtyByProductId, maxByProduct, remainingByProduct, colorMap, onSelectProduct, emptyMessage }) {
  if (products.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <p className="text-gray-400 text-lg whitespace-pre-line">
          {emptyMessage ?? 'ยังไม่มีสินค้า กรุณาเพิ่มจากหน้าคลังสินค้า'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 p-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          cartQty={cartQtyByProductId?.get(product.id) ?? 0}
          maxQty={maxByProduct?.get(product.id)}
          remaining={remainingByProduct?.get(product.id)}
          color={colorOfCategory(colorMap, product.category)}
          onSelect={onSelectProduct}
        />
      ))}
    </div>
  )
}

export default ProductGrid
