/**
 * กันช่องตัวเลขเปลี่ยนค่าเองตอนเลื่อนเมาส์ผ่าน
 *
 * เบราว์เซอร์บนคอม/แท็บเล็ตที่มีเมาส์ ถ้าช่อง type="number" ถูกเลือกอยู่แล้วหมุนล้อเมาส์
 * ตัวเลขจะเพิ่มหรือลดทีละ 1 ทั้งที่คนตั้งใจแค่เลื่อนหน้า — เงินทอนตั้งต้น 500 กลายเป็น 497
 * โดยไม่มีใครเห็น
 *
 * แก้ที่เดียวทั้งแอป: หมุนล้อตอนช่องตัวเลขถูกเลือกอยู่ ให้ปล่อยช่องนั้นก่อน
 * หน้ายังเลื่อนได้ตามปกติ แต่ตัวเลขไม่ขยับ
 */
export function blurFocusedNumberInput(doc) {
  const el = doc?.activeElement
  if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur()
}

export function installNumberInputGuard(doc = globalThis.document) {
  if (!doc?.addEventListener) return () => {}
  const handler = () => blurFocusedNumberInput(doc)
  // capture: ต้องปล่อยช่องก่อนเบราว์เซอร์จะเอาล้อไปเปลี่ยนค่า
  doc.addEventListener('wheel', handler, { capture: true, passive: true })
  return () => doc.removeEventListener('wheel', handler, { capture: true })
}
