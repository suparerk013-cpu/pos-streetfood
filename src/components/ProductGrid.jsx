import ProductCard from './ProductCard'

function ProductGrid({ products, cartQtyByProductId, onSelectProduct }) {
  if (products.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <p className="text-gray-400 text-lg">
          ยังไม่มีสินค้า กรุณาเพิ่มจากหน้าคลังสินค้า
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} cartQty={cartQtyByProductId?.get(product.id) ?? 0} onSelect={onSelectProduct} />
      ))}
    </div>
  )
}

export default ProductGrid
