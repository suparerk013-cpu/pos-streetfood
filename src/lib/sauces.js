/**
 * น้ำจิ้มที่ทำเอง — ของกึ่งสำเร็จรูปที่ไม่ได้ซื้อมาเป็นชิ้น แต่กวนเองทีละหม้อ
 *
 * ต่างจากวัตถุดิบซื้อมาตรงที่ราคาต่อชิ้นไม่มีอยู่ตั้งแต่แรก ต้องรู้ก่อนว่า
 * หม้อนี้ใส่อะไรไปเท่าไหร่ ได้กี่กิโล และใช้ได้กี่ชิ้น ถึงจะหารออกมาเป็นต้นทุนต่อไม้ได้
 *
 * ปริมาณผักไม่ตายตัวในแต่ละวัน (พริกแพงก็ใส่น้อยลง ผักชีมัดใหญ่บ้างเล็กบ้าง)
 * ระบบจึงเก็บ "สูตร" ไว้เป็นค่าตั้งต้นให้กรอกเร็ว แต่ตัวเลขที่คิดเงินจริง
 * มาจากหม้อล่าสุดที่บันทึกไว้เสมอ ทำน้ำจิ้มใหม่เมื่อไหร่ต้นทุนก็ขยับตามวันนั้น
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { SAUCE_ICONS, batchTotals, cleanRecipe } from './sauceCost'

export {
  SAUCE_ICONS,
  batchTotals,
  cleanRecipe,
  entryUnitsFor,
  lineAmount,
  lineBaseQty,
  lineStockUse,
  linesMissingPrice,
  linesOverStock,
  sauceCostFor,
  saucePerServe,
} from './sauceCost'

/** Firestore รับได้ 500 คำสั่งต่อชุด เผื่อไว้ให้ต่ำกว่านั้น */
const BATCH_LIMIT = 400

// ─────────────────────────────────────────────────────────────
// อ่าน/เขียน Firestore
// ─────────────────────────────────────────────────────────────

export async function addSauce({ name, icon, unit, recipe = [], sortOrder = 0 }) {
  const ref = await addDoc(collection(db, 'sauces'), {
    name: String(name ?? '').trim(),
    icon: icon || SAUCE_ICONS[0],
    unit: unit || 'กก.',
    recipe: cleanRecipe(recipe),
    last_batch: null,
    sort_order: sortOrder,
    is_active: true,
    created_at: serverTimestamp(),
  })
  return ref.id
}

export function updateSauce(sauceId, updates) {
  const payload = { ...updates }
  if (payload.recipe) payload.recipe = cleanRecipe(payload.recipe)
  return updateDoc(doc(db, 'sauces', sauceId), payload)
}

/**
 * บันทึกว่าทำน้ำจิ้มไป 1 หม้อ
 *
 * เขียนสองที่พร้อมกัน — ประวัติหม้อไว้ดูย้อนหลัง กับสรุปหม้อล่าสุดบนตัวสูตรเอง
 * ที่ต้องเก็บซ้ำบนตัวสูตรเพราะหน้าขายกับหน้ารายงานคิดต้นทุนสินค้าทุกครั้งที่วาดจอ
 * ถ้าต้องไปไล่หาหม้อล่าสุดจาก collection ประวัติทุกรอบจะช้าและเปลืองโควตาอ่าน
 */
export async function recordSauceBatch({ sauceId, sauceName, lines, yieldQty, serves, note, ingredientById }) {
  const totals = batchTotals(lines, { yieldQty, serves, ingredientById })
  const batch = writeBatch(db)

  const batchRef = doc(collection(db, 'sauce_batches'))
  const summary = {
    total_cost: totals.totalCost,
    yield_qty: totals.yieldQty,
    serves: totals.serves,
    cost_per_yield: totals.costPerYield,
    cost_per_serve: totals.costPerServe,
  }

  batch.set(batchRef, {
    sauce_id: sauceId,
    sauce_name: sauceName ?? '',
    lines: totals.lines,
    ...summary,
    note: String(note ?? '').trim(),
    created_at: serverTimestamp(),
  })

  // จำสูตรที่เพิ่งใช้ไว้เป็นค่าตั้งต้นของหม้อถัดไป วันหลังกรอกแทบไม่ต้องแก้
  batch.update(doc(db, 'sauces', sauceId), {
    recipe: cleanRecipe(lines),
    last_batch: { ...summary, batch_id: batchRef.id, at: Date.now() },
  })

  // ตัดของออกจากสต็อกวัตถุดิบไปในชุดเดียวกับที่บันทึกหม้อ
  // ถ้าแยกเป็นสองคำสั่งแล้วเน็ตหลุดคั่นกลาง จะได้หม้อที่ไม่ได้ตัดของ หรือของหายโดยไม่มีหม้อ
  // รวมบรรทัดที่ใช้วัตถุดิบตัวเดียวกันก่อน เพราะ Firestore ห้ามแตะเอกสารเดิมซ้ำในชุดเดียว
  const usedByIngredient = new Map()
  totals.lines.forEach((line) => {
    // base_qty คิดไว้แล้วตอนสรุปหม้อ ใช้ค่าเดียวกับที่คิดเงิน สต็อกกับต้นทุนจึงตรงกันเสมอ
    const use = Number(line.base_qty) || 0
    if (use <= 0) return
    usedByIngredient.set(line.ingredient_id, (usedByIngredient.get(line.ingredient_id) ?? 0) + use)
  })
  usedByIngredient.forEach((used, ingredientId) => {
    batch.update(doc(db, 'ingredients', ingredientId), { stock_qty: increment(-used) })
  })

  await batch.commit()
  return batchRef.id
}

/**
 * ลบหม้อที่บันทึกผิด
 *
 * ถ้าลบหม้อที่กำลังใช้คิดต้นทุนอยู่ ต้องเลื่อนไปใช้หม้อก่อนหน้าแทน
 * ไม่งั้นต้นทุนสินค้าจะค้างอยู่ที่ตัวเลขของหม้อที่ไม่มีอยู่แล้ว
 */
export async function deleteSauceBatch(sauceId, batchId) {
  await deleteDoc(doc(db, 'sauce_batches', batchId))

  const snap = await getDocs(query(collection(db, 'sauce_batches'), where('sauce_id', '==', sauceId)))
  const remaining = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => millis(b.created_at) - millis(a.created_at))

  const latest = remaining[0]
  await updateDoc(doc(db, 'sauces', sauceId), {
    last_batch: latest
      ? {
          total_cost: latest.total_cost ?? 0,
          yield_qty: latest.yield_qty ?? 0,
          serves: latest.serves ?? 0,
          cost_per_yield: latest.cost_per_yield ?? 0,
          cost_per_serve: latest.cost_per_serve ?? 0,
          batch_id: latest.id,
          at: millis(latest.created_at) || Date.now(),
        }
      : null,
  })
}

/**
 * ลบสูตรทิ้งทั้งสูตร
 *
 * ลบประวัติหม้อกับตัดสายที่สินค้าผูกไว้ออกด้วย ไม่งั้นสินค้าจะชี้ไปที่สูตรที่หายไปแล้ว
 * แล้วต้นทุนน้ำจิ้มของสินค้านั้นจะกลายเป็น 0 เงียบ ๆ โดยไม่มีใครรู้ว่าทำไม
 */
export async function deleteSauce(sauceId) {
  const [batches, products] = await Promise.all([
    getDocs(query(collection(db, 'sauce_batches'), where('sauce_id', '==', sauceId))),
    getDocs(query(collection(db, 'products'), where('sauce_id', '==', sauceId))),
  ])

  const ops = [
    ...batches.docs.map((d) => ({ type: 'delete', ref: d.ref })),
    ...products.docs.map((d) => ({ type: 'update', ref: d.ref, data: { sauce_id: null } })),
    { type: 'delete', ref: doc(db, 'sauces', sauceId) },
  ]
  await commitOps(ops)
}

/**
 * ถอนระบบน้ำจิ้มออกทั้งหมด — สำหรับตอนลองแล้วไม่ชอบ
 *
 * ลบทั้งสูตรและประวัติหม้อ แล้วตัดสายที่สินค้าผูกไว้ทุกตัว
 * ต้นทุนสินค้าจะกลับไปเป็นสูตรเดิมก่อนติดตั้งระบบนี้ทันที ข้อมูลขายไม่ถูกแตะ
 */
export async function purgeSauceSystem(onProgress) {
  const [sauces, batches, allProducts] = await Promise.all([
    getDocs(collection(db, 'sauces')),
    getDocs(collection(db, 'sauce_batches')),
    getDocs(collection(db, 'products')),
  ])

  // กรองฝั่งนี้แทนการ query ด้วย != null เพราะสินค้าที่ไม่เคยผูกสูตรจะไม่มีฟิลด์นี้เลย
  // ซึ่ง Firestore จะไม่คืนมาให้ และรายการสินค้าก็ไม่ได้เยอะจนต้องกรองที่ฝั่งเซิร์ฟเวอร์
  const products = allProducts.docs.filter((d) => d.data().sauce_id)

  onProgress?.('กำลังตัดสูตรน้ำจิ้มออกจากสินค้า')
  await commitOps(products.map((d) => ({ type: 'update', ref: d.ref, data: { sauce_id: null } })))

  onProgress?.('กำลังลบประวัติการทำน้ำจิ้ม')
  await commitOps(batches.docs.map((d) => ({ type: 'delete', ref: d.ref })))

  onProgress?.('กำลังลบสูตรน้ำจิ้ม')
  await commitOps(sauces.docs.map((d) => ({ type: 'delete', ref: d.ref })))

  return { sauces: sauces.size, batches: batches.size, products: products.length }
}

async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref)
      else batch.update(op.ref, op.data)
    })
    await batch.commit()
  }
}

function millis(timestamp) {
  if (!timestamp) return 0
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  return Number(timestamp) || 0
}
