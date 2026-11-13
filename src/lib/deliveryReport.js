/**
 * สรุปเดลิเวอรีแยกตามแอป: ยอดขาย → หัก GP → เงินที่เข้าจริง
 *
 * ไม่หักต้นทุนต่อชิ้นแล้ว — ร้านเลิกคิดต้นทุนเพราะตัวเลขไม่ตรงของจริง
 * กำไรดูจากรายรับลบรายจ่ายที่จดไว้ในหน้าค่าใช้จ่ายแทน
 */
export function summarizeDelivery(orders, { rateFor }) {
  const byPlatform = new Map()

  orders
    .filter((o) => o.channel === 'delivery')
    .forEach((o) => {
      const platform = o.platform ?? 'เดลิเวอรี่'
      if (!byPlatform.has(platform)) {
        byPlatform.set(platform, { platform, gross: 0, orders: 0 })
      }
      const row = byPlatform.get(platform)
      row.gross += o.total_amount ?? 0
      row.orders += 1
    })

  return [...byPlatform.values()]
    .map((row) => {
      const rate = rateFor(row.platform)
      const fee = row.gross * rate
      return { ...row, rate, fee, net: row.gross - fee }
    })
    .sort((a, b) => b.gross - a.gross)
}

/** ของแถมที่แจกไปในช่วงนั้นกี่ชิ้น */
export function summarizeFreebies(orders, { nameOf } = {}) {
  const map = new Map()
  orders.forEach((o) => {
    ;(o.items ?? []).forEach((item) => {
      if (!item.is_free) return
      const row = map.get(item.product_id) ?? {
        productId: item.product_id,
        name: nameOf?.(item.product_id) ?? item.name,
        qty: 0,
      }
      row.qty += item.qty
      map.set(item.product_id, row)
    })
  })
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}
