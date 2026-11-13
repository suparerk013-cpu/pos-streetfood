import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export { toDateString } from './dates'

/**
 * รายจ่ายของร้าน — จดแค่ชื่อ ราคา หน่วย (และจำนวนถ้าอยากจด)
 *
 * เดิมแยกเป็นสองระบบ: ซื้อวัตถุดิบ (ผูกทะเบียนวัตถุดิบ เก็บสต็อก คิดต้นทุนต่อไม้)
 * กับค่าใช้จ่ายอื่น (ค่าน้ำค่าไฟ) — ของจริงที่ตลาดไม่ตายตัว ทะเบียนกับสูตรจึงไม่เคยตรง
 * ตอนนี้เหลือที่เดียว จดเงินที่จ่ายไปจริงแล้วเอาไปเทียบกับยอดขายเท่านั้น
 *
 * ของใหม่ทุกรายการเก็บใน `expenses` ส่วน `purchases` เก่าไม่ย้าย อ่านมารวมกันตอนแสดงผล
 * ข้อมูลย้อนหลังจึงไม่หาย และไม่ต้องเขียนทับฐานข้อมูลที่ใช้งานจริงอยู่
 */

/** หน่วยที่ใช้บ่อยที่ตลาด — กดเลือกได้เลย ไม่ต้องพิมพ์ */
export const EXPENSE_UNITS = ['ถุง', 'มัด', 'กิโล', 'ขวด', 'แพ็ค', 'กล่อง', 'ชิ้น', 'ถัง']

/** ชื่อหมวดของรายการเก่าที่บันทึกตอนยังมีหมวดให้เลือก */
const LEGACY_CATEGORY_LABELS = {
  utility_water: 'ค่าน้ำ',
  utility_electric: 'ค่าไฟ',
  rent: 'ค่าเช่า',
  labor: 'ค่าแรง',
  raw_material: 'วัตถุดิบ',
  other: 'อื่นๆ',
}

/** ชื่อเดียวกันพิมพ์ต่างกันนิดหน่อย ("น้ำแข็ง" กับ "น้ำแข็ง ") ต้องนับเป็นรายการเดียว */
export function nameKey(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function cleanNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** แปลงเอกสารจาก `expenses` (ทั้งแบบใหม่และแบบมีหมวดเดิม) เป็นรูปเดียวกัน */
export function entryFromExpense(e) {
  const name = e.name || e.custom_label || LEGACY_CATEGORY_LABELS[e.category] || 'อื่นๆ'
  return {
    id: e.id,
    source: 'expenses',
    name,
    amount: Number(e.amount) || 0,
    qty: cleanNumber(e.qty),
    unit: e.unit || null,
    date: e.date,
    note: e.note || null,
  }
}

/** แปลงการซื้อวัตถุดิบแบบเก่าเป็นรูปเดียวกับรายจ่ายใหม่ */
export function entryFromPurchase(p) {
  return {
    id: p.id,
    source: 'purchases',
    name: p.ingredient_name || 'วัตถุดิบ',
    amount: Number(p.total_amount) || 0,
    qty: cleanNumber(p.qty),
    unit: p.unit || null,
    date: p.date,
    note: [p.vendor, p.note].filter(Boolean).join(' · ') || null,
  }
}

/** รวมสองแหล่งเป็นรายการเดียว ใหม่สุดอยู่บน */
export function mergeEntries(purchases = [], expenses = []) {
  return [...purchases.map(entryFromPurchase), ...expenses.map(entryFromExpense)]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function totalOf(entries = []) {
  return entries.reduce((s, e) => s + (e.amount ?? 0), 0)
}

/**
 * รวมยอดตามชื่อ — น้ำแข็งซื้อทุกวันจะเหลือแถวเดียวพร้อมยอดทั้งเดือน
 * จำนวนรวมนับเฉพาะเมื่อหน่วยตรงกันทุกครั้ง ถุงบวกกิโลไม่มีความหมาย
 */
export function summarizeByName(entries = []) {
  const map = new Map()
  entries.forEach((e) => {
    const key = nameKey(e.name)
    if (!key) return
    if (!map.has(key)) {
      map.set(key, { key, name: e.name.trim(), total: 0, times: 0, qty: 0, unit: e.unit, mixedUnits: false })
    }
    const row = map.get(key)
    row.total += e.amount ?? 0
    row.times += 1
    if (e.qty) row.qty += e.qty
    if (e.unit !== row.unit) row.mixedUnits = true
  })
  return [...map.values()]
    .map((r) => (r.mixedUnits ? { ...r, qty: 0, unit: null } : r))
    .sort((a, b) => b.total - a.total)
}

/**
 * ชื่อที่เคยจด เอาไว้ให้กดเลือกแทนการพิมพ์
 *
 * เรียงตามความถี่ ของที่ซื้อทุกวันขึ้นก่อน พร้อมหน่วยและราคาของครั้งล่าสุด
 * กดเลือกแล้วเติมให้ทั้งสามช่อง ส่วนใหญ่ราคาเท่าเดิม แก้นิดเดียวก็บันทึกได้
 */
export function nameSuggestions(entries = [], search = '', max = 12) {
  const map = new Map()
  // entries เรียงใหม่ไปเก่า ตัวแรกที่เจอของแต่ละชื่อคือครั้งล่าสุด
  entries.forEach((e) => {
    const key = nameKey(e.name)
    if (!key) return
    const found = map.get(key)
    if (found) {
      found.times += 1
      return
    }
    map.set(key, { key, name: e.name.trim(), unit: e.unit, amount: e.amount, qty: e.qty, times: 1 })
  })
  const term = nameKey(search)
  return [...map.values()]
    .filter((s) => !term || s.key.includes(term))
    .sort((a, b) => {
      // พิมพ์มาแล้วตรงตัวหน้า เอาขึ้นก่อน — พิมพ์ "น้ำ" ควรเห็น "น้ำแข็ง" ก่อน "ขวดน้ำ"
      if (term) {
        const ap = a.key.startsWith(term) ? 0 : 1
        const bp = b.key.startsWith(term) ? 0 : 1
        if (ap !== bp) return ap - bp
      }
      return b.times - a.times
    })
    .slice(0, max)
}

/** ตรวจฟอร์มก่อนบันทึก คืนข้อความผิดหรือ payload ที่พร้อมเขียน */
export function buildExpensePayload({ name, amount, qty, unit, date, note }) {
  const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!cleanName) return { error: 'ใส่ชื่อรายการก่อน' }
  const cleanAmount = Number(amount)
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) return { error: 'ใส่ราคาที่จ่ายไป' }
  if (!date) return { error: 'เลือกวันที่' }
  return {
    payload: {
      name: cleanName,
      amount: Math.round(cleanAmount * 100) / 100,
      qty: cleanNumber(qty),
      unit: String(unit ?? '').trim() || null,
      date,
      note: String(note ?? '').trim() || null,
    },
  }
}

export async function createExpense(payload) {
  await addDoc(collection(db, 'expenses'), {
    ...payload,
    source: 'manual',
    created_at: serverTimestamp(),
  })
}

export function updateExpense(id, payload) {
  return updateDoc(doc(db, 'expenses', id), { ...payload, updated_at: serverTimestamp() })
}

/** ลบได้ทั้งรายการใหม่และรายการซื้อวัตถุดิบแบบเก่า */
export function deleteEntry(entry) {
  return deleteDoc(doc(db, entry.source === 'purchases' ? 'purchases' : 'expenses', entry.id))
}
