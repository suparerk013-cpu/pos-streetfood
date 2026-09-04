/** สรุปเดลิเวอรีแยกตามแอป: ยอดขาย → หัก GP → เงินเข้า → หักต้นทุน → กำไร */
export function summarizeDelivery(orders, { rateFor, costOfOrder }) {
  const byPlatform = new Map()

  orders
    .filter((o) => o.channel === 'delivery')
    .forEach((o) => {
      const platform = o.platform ?? 'เดลิเวอรี่'
      if (!byPlatform.has(platform)) {
        byPlatform.set(platform, { platform, gross: 0, orders: 0, cost: 0 })
      }
      const row = byPlatform.get(platform)
      row.gross += o.total_amount ?? 0
      row.orders += 1
      row.cost += costOfOrder ? costOfOrder(o) : 0
    })

  return [...byPlatform.values()]
    .map((row) => {
      const rate = rateFor(row.platform)
      const fee = row.gross * rate
      const net = row.gross - fee
      return {
        ...row,
        rate,
        fee,
        net,
        profit: net - row.cost,
        margin: row.gross > 0 ? (net - row.cost) / row.gross : 0,
      }
    })
    .sort((a, b) => b.gross - a.gross)
}

/** ต้นทุนของบิล 1 ใบ — เซ็ตคิดจากส่วนประกอบ ของแถมคิดต้นทุนเต็มแม้ราคา 0 */
export function orderCost(order, { unitCostOf, packagingCost = 0 }) {
  const items = order.items ?? []
  const goods = items.reduce((sum, item) => {
    if (item.is_bundle && item.components?.length) {
      return sum + item.components.reduce(
        (s, c) => s + unitCostOf(c.product_id) * (c.qty ?? 0) * item.qty,
        0,
      )
    }
    return sum + unitCostOf(item.product_id) * item.qty
  }, 0)
  return goods + (order.channel === 'delivery' ? packagingCost : 0)
}

/** ของแถมที่แจกไปในช่วงนั้น — กี่ชิ้นและคิดเป็นต้นทุนเท่าไร */
export function summarizeFreebies(orders, { unitCostOf, nameOf }) {
  const map = new Map()
  orders.forEach((o) => {
    ;(o.items ?? []).forEach((item) => {
      if (!item.is_free) return
      const row = map.get(item.product_id) ?? {
        productId: item.product_id,
        name: nameOf?.(item.product_id) ?? item.name,
        qty: 0,
        cost: 0,
      }
      row.qty += item.qty
      row.cost += unitCostOf(item.product_id) * item.qty
      map.set(item.product_id, row)
    })
  })
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}
