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

/**
 * ซื้อแล้วให้เหลือเป็นกี่เท่าของจุดสั่งซื้อ
 *
 * ซื้อให้พอดีจุดที่ตั้งไว้เป๊ะ ๆ จะขึ้นเตือนอีกทันทีที่ใช้ไปนิดเดียว
 * เผื่อไว้สามเท่าพอให้ใช้ได้สักพักก่อนต้องไปตลาดรอบหน้า
 */
const REORDER_REFILL = 3

/**
 * จุดสั่งซื้อที่ตั้งเอง แปลงเป็นหน่วยที่ซื้อมา
 *
 * ตั้งเป็นมิลลิลิตรได้ทั้งที่ซื้อเป็นขวด เหมือนตอนกรอกสูตร — เก็บลงฐานข้อมูล
 * เป็นหน่วยที่ซื้อมาเสมอ จะได้เทียบกับสต็อกได้ตรง ๆ โดยไม่ต้องแปลงทุกครั้งที่วาดจอ
 */
export function reorderPoint(ingredient) {
  const qty = Number(ingredient?.reorder_qty)
  return Number.isFinite(qty) && qty > 0 ? qty : null
}

/**
 * เหตุผลที่ต้องซื้อ — ต่ำกว่าจุดที่ตั้งเอง หรือทำหม้อถัดไปไม่ได้
 *
 * ทำงานทั้งคู่ อันไหนถึงก่อนเตือนก่อน เพราะสองอันนี้จับคนละเรื่อง
 * จุดที่ตั้งเองจับสิ่งที่สูตรไม่รู้ (ผักชีเหี่ยวเร็ว ต้องมีสดตลอด ไม่เกี่ยวกับว่าทำน้ำจิ้มบ่อยแค่ไหน)
 * ส่วนสูตรจับสิ่งที่คนตั้งไม่ได้อัปเดต (เปลี่ยนสูตรใส่พริกเยอะขึ้นเท่าตัว เลขที่ตั้งไว้เดือนก่อนจะต่ำเกินไปเงียบ ๆ)
 *
 * ถ้าให้ตัวที่ตั้งเองทับตัวที่คิดจากสูตร จะเกิดช่องโหว่: ตั้งเตือนผักชีที่ 1 กำ
 * แต่สูตรใช้ 2 กำต่อหม้อ เหลือ 1.5 กำ ทำหม้อถัดไปไม่ได้แล้วแต่ไม่มีใครเตือน
 */
export function stockLevelOf({ have, tracked, needPerPot = 0, reorder = null, lowPots = LOW_POTS }) {
  if (!tracked) return { level: 'unknown', reason: null, pots: null }

  const pots = needPerPot > 0 ? Math.floor(have / needPerPot) : null
  const belowReorder = reorder != null && have < reorder
  const cannotMake = pots != null && pots <= 0

  if (belowReorder || cannotMake) {
    return { level: 'out', reason: belowReorder ? 'reorder' : 'recipe', pots }
  }
  if (pots != null && pots <= lowPots) return { level: 'low', reason: 'recipe', pots }
  return { level: 'ok', reason: null, pots }
}

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
    const reorder = reorderPoint(ingredient)
    const { level, reason, pots } = stockLevelOf({ have, tracked, needPerPot: need, reorder, lowPots })
    lines.push({
      ingredient_id: ingredientId,
      name: ingredient?.name ?? '(ถูกลบไปแล้ว)',
      unit: ingredient?.unit ?? '',
      reorder,
      reorder_unit: ingredient?.reorder_unit ?? null,
      need,
      have,
      tracked,
      pots,
      level,
      reason,
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
 *
 * ของที่ตั้งจุดสั่งซื้อไว้เองก็เข้ารายการด้วย ถึงจะไม่ได้อยู่ในสูตรน้ำจิ้มเลย
 * (ถ่าน ถุงพลาสติก ไม้เสียบ) ไม่งั้นตั้งไปก็ไม่มีใครเตือน และรายการนี้จะได้เป็น
 * รายการไปตลาดจริง ๆ ไม่ใช่แค่ของทำน้ำจิ้ม
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

  // ของที่ตั้งจุดสั่งซื้อไว้แต่ไม่ได้อยู่ในสูตรไหนเลย ก็ต้องอยู่ในรายการเหมือนกัน
  ingredientById?.forEach((ingredient, id) => {
    if (ingredient?.is_active === false) return
    if (!worst.has(id) && reorderPoint(ingredient) != null) worst.set(id, { need: 0, usedBy: [] })
  })

  const rows = []
  worst.forEach(({ need, usedBy }, ingredientId) => {
    const ingredient = ingredientById?.get(ingredientId)
    if (!ingredient) return
    const tracked = Number.isFinite(Number(ingredient.stock_qty))
    const have = Number(ingredient.stock_qty) || 0
    const reorder = reorderPoint(ingredient)
    const { level, reason, pots } = stockLevelOf({ have, tracked, needPerPot: need, reorder, lowPots })

    // ตั้งจุดสั่งซื้อเองแล้วให้เลขนั้นเป็นตัวคุมจำนวนที่แนะนำ ไม่ใช่เป้าจำนวนหม้อ
    // เพราะคนตั้งเองรู้เรื่องที่สูตรไม่รู้ — ผักชีตั้งเตือนไว้ 1 กำเพราะมันเหี่ยว
    // ไม่ได้อยากตุนไว้ 10 กำให้พอทำน้ำจิ้มห้าหม้อแล้วทิ้งไปครึ่งหนึ่ง
    // ส่วนการ "เตือน" ยังใช้ทั้งสองเงื่อนไขเหมือนเดิม ตรงนี้คุมแค่ว่าควรซื้อเท่าไหร่
    const shortfall = reorder != null
      ? Math.max(0, reorder * REORDER_REFILL - have)
      : Math.max(0, need > 0 ? targetPots * need - have : 0)

    rows.push({
      ingredient_id: ingredientId,
      name: ingredient.name ?? '',
      unit: ingredient.unit ?? '',
      category: ingredient.category ?? 'other',
      lastPrice: Number(ingredient.last_price) || 0,
      contentQty: Number(ingredient.content_qty) || 0,
      contentUnit: ingredient.content_unit ?? null,
      need,
      have,
      tracked,
      pots,
      reorder,
      reorderUnit: ingredient.reorder_unit ?? null,
      usedBy,
      inRecipe: need > 0,
      reason,
      suggestQty: roundUpBuy(shortfall, ingredient),
      level,
    })
  })

  // ตัวที่จะหมดก่อนอยู่บนสุด ตัวที่ยังไม่ได้นับไปท้ายสุดเพราะยังไม่รู้ว่าขาดจริงไหม
  const rank = { out: 0, low: 1, ok: 2, unknown: 3 }
  return rows.sort((a, b) => rank[a.level] - rank[b.level] || (a.pots ?? 99) - (b.pots ?? 99))
}

/** ปัดจำนวนที่แนะนำให้ซื้อได้จริงในตลาด — ของนับเป็นชิ้นปัดเต็มหน่วย ของชั่งปัดทีละ 0.25 */
export function roundUpBuy(qty, ingredient) {
  if (qty <= 0) return 0
  const whole = WHOLE_UNITS.has(ingredient?.unit) || Number(ingredient?.content_qty) > 0
  if (whole) return Math.ceil(qty)
  return Math.ceil(qty * 4) / 4
}
