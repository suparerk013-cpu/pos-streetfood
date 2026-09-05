function ProductCard({ product, cartQty = 0, onSelect }) {
  const stockQty = product.stock_qty ?? 0
  const outOfStock = stockQty <= 0
  const cartFull = !outOfStock && cartQty >= stockQty
  const disabled = outOfStock || cartFull

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(product)}
      disabled={disabled}
      className={`relative min-h-[100px] rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 px-3 py-4 text-center overflow-hidden ${
        disabled
          ? 'bg-gray-100 border-gray-200 shadow-sm'
          : 'bg-gradient-to-br from-white to-orange-50 border-orange-200 shadow-md active:scale-[0.96] active:shadow-sm'
      }`}
    >
      {/* ป้ายสต็อกอยู่มุมบนซ้าย เดิมอยู่มุมล่างซ้ายแล้วไปทับเลขราคาพอดี */}
      {!outOfStock && (
        <span
          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm ${
            stockQty <= 5
              ? 'bg-red-500 text-white'
              : stockQty <= 10
              ? 'bg-amber-400 text-white'
              : 'bg-white/95 text-gray-500 border border-gray-200'
          }`}
        >
          เหลือ {stockQty}
        </span>
      )}

      {product.image_base64 && (
        <img
          src={product.image_base64}
          alt=""
          className={`w-16 h-16 rounded-xl object-cover mb-0.5 ${disabled ? 'grayscale opacity-50' : 'shadow-sm'}`}
        />
      )}

      <span className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 w-full">
        {product.name}
      </span>
      <span className="font-extrabold text-lg bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
        {product.price} ฿
      </span>

      {outOfStock && (
        <>
          <span className="absolute inset-0 rounded-2xl bg-black/30" />
          <span className="absolute top-2 right-2 rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5 shadow-md">
            หมด
          </span>
        </>
      )}
      {cartFull && (
        <>
          <span className="absolute inset-0 rounded-2xl bg-orange-900/20" />
          <span className="absolute top-2 right-2 rounded-full bg-orange-500 text-white text-xs font-bold px-2 py-0.5 shadow-md">
            ครบแล้ว
          </span>
        </>
      )}
    </button>
  )
}

export default ProductCard
