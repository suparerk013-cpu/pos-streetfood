import { DEFAULT_GP_RATE } from './constants'

/**
 * ราคากับเงินที่เข้าจริง
 *
 * เดิมไฟล์นี้คิดต้นทุนต่อชิ้นจากราคาวัตถุดิบหารจำนวนที่ทำได้ บวกน้ำจิ้มบวกของประกอบ
 * แต่ใช้จริงแล้วตัวเลขไม่ตรงของจริง — ปริมาณผักไม่ตายตัว หมึกแต่ละโลเสียบได้ไม่เท่ากัน
 * ร้านจึงเลิกคิดต้นทุนต่อชิ้น แล้วดูกำไรจากรายรับลบรายจ่ายที่จดไว้จริงแทน
 *
 * ที่เหลืออยู่คือเรื่องที่ไม่ต้องเดา: ค่า GP ที่แอปหัก ราคาถ้าซื้อแยก และเซ็ตทำได้กี่ชุด
 */

/** จำนวนเซ็ตที่ทำได้จากสต็อกส่วนประกอบที่เหลืออยู่ — ตัวที่น้อยที่สุดเป็นตัวจำกัด */
export function bundleStock(bundle, productById) {
  const components = (bundle?.components ?? []).filter((c) => (c.qty ?? 0) > 0)
  if (components.length === 0) return 0
  return components.reduce((min, c) => {
    const stock = productById?.get(c.product_id)?.stock_qty ?? 0
    return Math.min(min, Math.floor(stock / c.qty))
  }, Infinity)
}

/**
 * ราคาถ้าลูกค้าซื้อของในเซ็ตแยกทีละชิ้นที่หน้าร้าน
 *
 * ใช้เป็นตัวเทียบตอนตั้งราคาเซ็ต — รู้ทันทีว่าเซ็ตถูกกว่าหรือแพงกว่าซื้อแยกเท่าไหร่
 * โดยไม่ต้องรู้ต้นทุน เพราะราคาขายปกติเป็นตัวเลขที่ร้านตั้งเองและแน่นอนอยู่แล้ว
 */
export function separatePriceOf(bundle, productById) {
  return (bundle?.components ?? []).reduce((sum, c) => {
    const price = Number(productById?.get(c.product_id)?.price) || 0
    return sum + price * (Number(c.qty) || 0)
  }, 0)
}

/** เงินที่เข้าจริงหลังแพลตฟอร์มหัก GP + ภาษี */
export function netAfterGp(grossAmount, gpRate = DEFAULT_GP_RATE) {
  return grossAmount * (1 - gpRate)
}
