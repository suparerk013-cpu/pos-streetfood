/**
 * รายการซื้อของที่พกไปตลาด
 *
 * เก็บไว้ในเครื่องล้วน ไม่แตะฐานข้อมูลจนกว่าจะกดบันทึกเข้าคลัง
 * เพราะตลาดสดสัญญาณไม่ดี และระบบนี้เขียนฐานข้อมูลตอนออฟไลน์ไม่ได้
 * ถ้าให้บันทึกทีละรายการระหว่างเดิน เน็ตหลุดทีเดียวของที่ติ๊กไว้หายหมด
 *
 * แตะเน็ตครั้งเดียวตอนจบ — เดินตลาดเน็ตหลุดทั้งชั่วโมงรายการก็ยังอยู่ครบ
 */

const KEY = 'pos-shopping-list-v1'

/** อ่านรายการที่ค้างไว้ — เบราว์เซอร์บางโหมดอ่าน localStorage ไม่ได้ ต้องไม่ทำแอปพัง */
export function loadList() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveList(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items ?? []))
  } catch {
    // เขียนไม่ได้ก็ปล่อยไป รายการยังอยู่ในหน้าจอจนกว่าจะปิดแอป ดีกว่าแอปค้าง
  }
}

export function clearList() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // เหมือนกับตอนเขียน — ล้างไม่ได้ก็ไม่ใช่เรื่องคอขาดบาดตาย
  }
}

let rowSeq = 0
export function newItem(fields = {}) {
  rowSeq += 1
  return {
    key: `${Date.now()}-${rowSeq}`,
    ingredient_id: fields.ingredient_id ?? null,
    name: fields.name ?? '',
    unit: fields.unit ?? 'ชิ้น',
    category: fields.category ?? 'other',
    plan_qty: fields.plan_qty ?? 0,
    lastPrice: fields.lastPrice ?? 0,
    bought: false,
    qty: '',
    amount: '',
  }
}

/** แถวที่ซื้อแล้วและกรอกครบ — มีแค่แถวพวกนี้ที่บันทึกเข้าคลังได้ */
export function readyItems(items = []) {
  return items.filter((i) => i.bought && Number(i.qty) > 0 && Number(i.amount) > 0)
}

export function listTotal(items = []) {
  return readyItems(items).reduce((sum, i) => sum + Number(i.amount), 0)
}

export function unitPriceOf(item) {
  const qty = Number(item?.qty) || 0
  return qty > 0 ? Number(item?.amount) / qty : 0
}

/**
 * ราคาวันนี้ต่างจากครั้งก่อนกี่เปอร์เซ็นต์
 *
 * ยืนอยู่หน้าแผงแล้วรู้เลยว่าแพงขึ้นเท่าไหร่ ต่อได้หรือเดินไปเจ้าอื่น
 * และเป็นตัวจับเลขพิมพ์ผิดด้วย — พิมพ์ 150 เป็น 1500 จะเด้งขึ้นมาทันที
 */
export function priceChange(item) {
  const before = Number(item?.lastPrice) || 0
  const now = unitPriceOf(item)
  if (before <= 0 || now <= 0) return null
  const percent = ((now - before) / before) * 100
  return { before, now, percent, suspicious: Math.abs(percent) >= 100 }
}
