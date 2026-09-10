/**
 * ของจะหมดเมื่อไหร่ — วัดจากสูตรน้ำจิ้มที่บันทึกไว้จริง
 *
 * ไม่ให้ตั้งเลขขั้นต่ำเอง เพราะต้องมานั่งตั้งทีละตัวว่าพริกเหลือกี่โลถึงเตือน
 * ตั้งไม่ครบก็ไม่เตือน ตั้งมั่วก็เตือนพร่ำเพรื่อจนคนเลิกสนใจ
 *
 * ใช้สูตรหารกับสต็อกแทน — พริกใช้ 0.2 กก./หม้อ เหลือ 0.3 กก. ก็ทำได้อีก 1 หม้อ
 * ตัวไหนหารได้น้อยสุดคือตัวที่จะหมดก่อน ไม่ต้องตั้งอะไรเลยและแม่นตามการใช้จริง
 */
import { lineBaseQty } from './sauceCost'

/** ทำได้อีกน้อยกว่าเท่านี้ถือว่าใกล้หมด — 2 หม้อพอให้มีเวลาไปตลาดก่อนของขาด */
export const LOW_POTS = 2

/** อยากให้ซื้อแล้วของพอทำอีกกี่หม้อ ใช้คำนวณจำนวนที่แนะนำในรายการซื้อของ */
export const TARGET_POTS = 5

/** หน่วยที่ซื้อเป็นจำนวนเต็ม แนะนำให้ซื้อ 0.25 ขวดไม่มีความหมาย */
const WHOLE_UNITS = new Set(['ขวด', 'ถุง', 'ลูก', 'กำ', 'มัด', 'ห่อ', 'แพ็ค', 'กระสอบ', 'ถัง', 'ชิ้น', 'กระปุก'])

/**
 * วัตถุดิบที่สูตรนี้ใช้ต่อ 1 หม้อ นับเป็นหน่วยที่ซื้อมา
 *
 * รวมบรรทัดที่ใส่วัตถุดิบตัวเดียวกันหลายรอบเข้าด้วยกัน (ใส่พริกสองรอบก็คือพริกตัวเดียว)
 * ไม่งั้นจะคิดว่าของพอทั้งที่จริงใช้เป็นสองเท่า
 */
export function needPerPot(sauce, ingredientById) {
  const need = new Map()
  ;(sauce?.recipe ?? []).forEach((line) => {
    const qty = lineBaseQty(line, ingredientById)
    if (!line?.ingredient_id || qty <= 0) return
    need.set(line.ingredient_id, (need.get(line.ingredient_id) ?? 0) + qty)
  })
  return need
}

/**
 * สูตรนี้ทำได้อีกกี่หม้อ และตัวไหนจะหมดก่อน
 *
 * วัตถุดิบที่ยังไม่เคยนับสต็อกจะไม่ถูกนับเป็นของหมด แต่แยกไว้เป็น "ยังไม่ได้นับ"
 * ของเก่าในทะเบียนที่มีมาก่อนระบบสต็อกจะไม่มีตัวเลขนี้ ถ้านับรวมเป็นศูนย์
 * หน้าจอจะขึ้นแดงรัวตั้งแต่วันแรกจนคนเลิกเชื่อคำเตือน
 */
export function sauceStock(sauce, ingredientById, { lowPots = LOW_POTS } = {}) {
  const lines = []
  needPerPot(sauce, ingredientById).forEach((need, ingredientId) => {
    const ingredient = ingredientById?.get(ingredientId)
    const tracked = Number.isFinite(Number(ingredient?.stock_qty))
    const have = Number(ingredient?.stock_qty) || 0
    const pots = tracked ? Math.floor(have / need) : null
    lines.push({
      ingredient_id: ingredientId,
      name: ingredient?.name ?? '(ถูกลบไปแล้ว)',
      unit: ingredient?.unit ?? '',
      need,
      have,
      tracked,
      pots,
      level: !tracked ? 'unknown' : pots <= 0 ? 'out' : pots <= lowPots ? 'low' : 'ok',
    })
  })

  lines.sort((a, b) => (a.pots ?? Infinity) - (b.pots ?? Infinity))

  const trackedLines = lines.filter((l) => l.tracked)
  const pots = trackedLines.length > 0 ? Math.min(...trackedLines.map((l) => l.pots)) : null
  const blocking = lines.filter((l) => l.level === 'out')
  const low = lines.filter((l) => l.level === 'low')
  const unknown = lines.filter((l) => l.level === 'unknown')

  return {
    sauce_id: sauce?.id,
    name: sauce?.name ?? '',
    icon: sauce?.icon ?? '🍲',
    hasRecipe: lines.length > 0,
    lines,
    pots,
    blocking,
    low,
    unknown,
    level: blocking.length > 0 ? 'out' : low.length > 0 ? 'low' : lines.length === 0 ? 'unknown' : 'ok',
  }
}

export function allSauceStock(sauces = [], ingredientById, options) {
  return sauces.filter((s) => (s?.recipe ?? []).length > 0).map((s) => sauceStock(s, ingredientById, options))
}

/** จำนวนสูตรที่ทำหม้อถัดไปไม่ได้ — ใช้เป็นตัวเลขแดงบนแท็บ */
export function sauceAlertCount(sauces = [], ingredientById, options) {
  return allSauceStock(sauces, ingredientById, options).filter((s) => s.level === 'out').length
}

/**
 * รายการที่ต้องซื้อ — รวมทุกสูตร ตัดตัวซ้ำ
 *
 * ดูที่ตัววัตถุดิบตรง ๆ ไม่ขึ้นกับว่าจะทำสูตรไหน จึงเป็นตัวหลักเวลาไปตลาด
 * ต่างจากเลข "ทำได้อีกกี่หม้อ" รายสูตร ที่คิดบนสมมติฐานว่าเอาของทั้งหมดมาทำสูตรเดียว
 *
 * ของที่ใช้หลายสูตรคิดจากสูตรที่กินเยอะสุด เพราะซื้อเผื่อไว้ดีกว่าซื้อขาด
 */
export function shoppingSuggestions(sauces = [], ingredientById, { targetPots = TARGET_POTS, lowPots = LOW_POTS } = {}) {
  const worst = new Map()

  sauces.forEach((sauce) => {
    needPerPot(sauce, ingredientById).forEach((need, ingredientId) => {
      const entry = worst.get(ingredientId) ?? { need: 0, usedBy: [] }
      entry.need = Math.max(entry.need, need)
      if (!entry.usedBy.includes(sauce?.name)) entry.usedBy.push(sauce?.name ?? '')
      worst.set(ingredientId, entry)
    })
  })

  const rows = []
  worst.forEach(({ need, usedBy }, ingredientId) => {
    const ingredient = ingredientById?.get(ingredientId)
    if (!ingredient) return
    const tracked = Number.isFinite(Number(ingredient.stock_qty))
    const have = Number(ingredient.stock_qty) || 0
    const pots = tracked ? Math.floor(have / need) : null
    const shortfall = Math.max(0, targetPots * need - have)

    rows.push({
      ingredient_id: ingredientId,
      name: ingredient.name ?? '',
      unit: ingredient.unit ?? '',
      category: ingredient.category ?? 'other',
      lastPrice: Number(ingredient.last_price) || 0,
      need,
      have,
      tracked,
      pots,
      usedBy,
      suggestQty: roundUpBuy(shortfall, ingredient),
      level: !tracked ? 'unknown' : pots <= 0 ? 'out' : pots <= lowPots ? 'low' : 'ok',
    })
  })

  // ตัวที่จะหมดก่อนอยู่บนสุด ตัวที่ยังไม่ได้นับไปท้ายสุดเพราะยังไม่รู้ว่าขาดจริงไหม
  const rank = { out: 0, low: 1, ok: 2, unknown: 3 }
  return rows.sort((a, b) => rank[a.level] - rank[b.level] || (a.pots ?? 0) - (b.pots ?? 0))
}

/** ปัดจำนวนที่แนะนำให้ซื้อได้จริงในตลาด — ของนับเป็นชิ้นปัดเต็มหน่วย ของชั่งปัดทีละ 0.25 */
export function roundUpBuy(qty, ingredient) {
  if (qty <= 0) return 0
  const whole = WHOLE_UNITS.has(ingredient?.unit) || Number(ingredient?.content_qty) > 0
  if (whole) return Math.ceil(qty)
  return Math.ceil(qty * 4) / 4
}
