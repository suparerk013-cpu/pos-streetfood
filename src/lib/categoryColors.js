/**
 * สีประจำหมวดสินค้า — แอปเลือกให้เอง ไม่ต้องตั้ง
 *
 * หมวดแรกที่เจอได้สีแรก หมวดถัดไปได้สีถัดไป เรียงตามลำดับสินค้าในคลัง (sort_order)
 * ลำดับเดิมจึงได้สีเดิมทุกครั้งที่เปิดแอป คนขายจำสีได้ว่าส้มคือหมึก ฟ้าคือหอย
 * หมวดเกินจำนวนสีวนกลับมาใช้สีแรก — ร้านทั่วไปมีไม่กี่หมวด
 *
 * เขียนชื่อคลาสเต็ม ๆ ไว้ตรงนี้ Tailwind ต้องเห็นทั้งคำถึงจะสร้างสีให้
 */
export const CATEGORY_PALETTE = [
  { tile: 'bg-orange-500', soft: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  { tile: 'bg-sky-600', soft: 'bg-sky-100 text-sky-700', bar: 'bg-sky-600' },
  { tile: 'bg-emerald-600', soft: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-600' },
  { tile: 'bg-violet-600', soft: 'bg-violet-100 text-violet-700', bar: 'bg-violet-600' },
  { tile: 'bg-rose-600', soft: 'bg-rose-100 text-rose-700', bar: 'bg-rose-600' },
  { tile: 'bg-amber-600', soft: 'bg-amber-100 text-amber-800', bar: 'bg-amber-600' },
  { tile: 'bg-teal-600', soft: 'bg-teal-100 text-teal-700', bar: 'bg-teal-600' },
  { tile: 'bg-indigo-600', soft: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-600' },
]

/** สินค้าที่ไม่ได้ใส่หมวด — สีกลาง ๆ ไม่แย่งสายตา */
export const UNCATEGORIZED_COLOR = { tile: 'bg-slate-600', soft: 'bg-slate-100 text-slate-700', bar: 'bg-slate-500' }

/** หมวด → สี ตามลำดับที่หมวดโผล่ในรายการสินค้า */
export function categoryColorMap(products = []) {
  const map = new Map()
  ;[...products]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((p) => {
      if (!p.category || map.has(p.category)) return
      map.set(p.category, CATEGORY_PALETTE[map.size % CATEGORY_PALETTE.length])
    })
  return map
}

export function colorOfCategory(map, category) {
  return (category && map?.get(category)) || UNCATEGORIZED_COLOR
}
