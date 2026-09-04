import { isBundle } from './bundles'
import { paymentLabel } from './constants'

/** สรุปวิธีชำระเป็นข้อความบรรทัดเดียว + เงินทอนรวม */
export function summarizePayments(payments) {
  const line = payments.map((p) => `${paymentLabel(p)} ${p.amount.toLocaleString()}`).join(' + ')
  const changeTotal = payments.reduce((sum, p) => sum + (p.change || 0), 0)
  return { line, changeTotal }
}

/**
 * รายการในบิล — เซ็ตเก็บส่วนประกอบติดไปด้วย เพื่อให้ยกเลิกบิลย้อนหลังคืนสต็อกได้ถูก
 * แม้ภายหลังจะแก้ส่วนประกอบของเซ็ตไปแล้ว
 */
export function buildOrderItems(lines, productById) {
  return lines.map((item) => {
    const product = productById?.get(item.productId)
    const base = {
      product_id: item.productId,
      name: item.name,
      qty: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
      modifiers: item.modifiers ?? {},
    }
    if (item.isFree) base.is_free = true
    if (isBundle(product)) {
      base.is_bundle = true
      base.components = product.components.map((c) => ({ product_id: c.product_id, qty: c.qty }))
    }
    return base
  })
}

/** จำนวนสินค้าจริงที่ต้องตัดสต็อก — เซ็ตกระจายเป็นส่วนประกอบ ของแถมนับเต็มจำนวน */
export function stockUnitsFromItems(items) {
  const map = new Map()
  const add = (id, qty) => map.set(id, (map.get(id) || 0) + qty)
  items.forEach((item) => {
    if (item.is_bundle && item.components?.length) {
      item.components.forEach((c) => add(c.product_id, (c.qty ?? 0) * item.qty))
    } else {
      add(item.product_id, item.qty)
    }
  })
  return map
}
