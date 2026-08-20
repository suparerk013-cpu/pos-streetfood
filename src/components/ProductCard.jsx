function ProductCard({ product, onSelect }) {
  const outOfStock = (product.stock_qty ?? 0) <= 0

  return (
    <button
      type="button"
      onClick={() => !outOfStock && onSelect(product)}
      disabled={outOfStock}
      className={`relative min-h-[88px] rounded-2xl border shadow-sm transition-transform flex flex-col items-center justify-center gap-1 px-3 py-4 text-center overflow-hidden ${
        outOfStock
          ? 'bg-gray-100 border-gray-200'
          : 'bg-white border-orange-100 active:scale-95 active:bg-orange-50'
      }`}
    >
      {product.image_base64 && (
        <img
          src={product.image_base64}
          alt=""
          className={`w-14 h-14 rounded-xl object-cover mb-1 ${outOfStock ? 'grayscale opacity-60' : ''}`}
        />
      )}

      <span className="font-semibold text-gray-800 text-base leading-snug line-clamp-2">
        {product.name}
      </span>
      <span className="text-orange-600 font-bold text-lg">{product.price} ฿</span>

      {outOfStock && (
        <>
          <span className="absolute inset-0 rounded-2xl bg-black/35" />
          <span className="absolute top-2 right-2 rounded-full bg-red-600 text-white text-xs font-bold px-2.5 py-1 shadow">
            หมด
          </span>
        </>
      )}
    </button>
  )
}

export default ProductCard
