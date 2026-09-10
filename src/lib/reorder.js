/**
 * แปลงจุดสั่งซื้อระหว่างหน่วยที่กรอกกับหน่วยที่ซื้อมา
 *
 * เก็บลงฐานข้อมูลเป็นหน่วยที่ซื้อมาเสมอ จะได้เทียบกับสต็อกตรง ๆ โดยไม่ต้องแปลงทุกครั้งที่วาดจอ
 * แต่จำหน่วยที่คนพิมพ์ไว้ด้วย เปิดกลับมาจะได้เห็น "200 มล." ไม่ใช่ "0.286 ขวด"
 */
import { trim } from './format'

export function toReorderPayload(ingredient, qty, unit) {
  const value = Number(qty) || 0
  if (value <= 0) return { reorder_qty: null, reorder_unit: null }

  const buyUnit = ingredient?.unit ?? 'หน่วย'
  const divisor = Number(ingredient?.content_qty) || 0
  const inBuyUnit = unit && unit !== buyUnit && divisor > 0 ? value / divisor : value
  return { reorder_qty: inBuyUnit, reorder_unit: unit || buyUnit }
}

export function fromReorderValue(ingredient) {
  const stored = Number(ingredient?.reorder_qty) || 0
  if (stored <= 0) return { qty: '', unit: ingredient?.unit ?? '' }

  const unit = ingredient?.reorder_unit ?? ingredient?.unit ?? ''
  const divisor = Number(ingredient?.content_qty) || 0
  const shown = unit !== (ingredient?.unit ?? '') && divisor > 0 ? stored * divisor : stored
  return { qty: trim(shown), unit }
}
