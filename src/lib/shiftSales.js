/**
 * ยอดขายแบ่งตามกะ — หนึ่งกะคือหนึ่งวันขาย
 *
 * ร้านเปิดสี่โมงเย็นปิดตีหนึ่ง ถ้าแบ่งตามวันในปฏิทินรอบขายเดียวจะถูกผ่าครึ่ง
 * บิลหลังเที่ยงคืนไปโผล่เป็นยอดของวันรุ่งขึ้น ทั้งที่เป็นรอบเดียวกัน
 * บิลทุกใบรู้อยู่แล้วว่าเกิดในกะไหน (shift_id) จึงใช้กะเป็นหน่วยแทนวันที่
 *
 * ฟังก์ชันในไฟล์นี้ไม่แตะฐานข้อมูล รับบิลกับกะที่ดึงมาแล้วเข้ามาคำนวณเฉย ๆ
 */
import { toDateString } from './dates'

export const OUTSIDE_SHIFT_KEY = 'outside'

export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * เงินที่เข้ากระเป๋าจริง — หน้าร้านได้เต็ม เดลิเวอรีโดนแอปหัก GP ก่อนโอน
 *
 * ใช้อัตราเดียวกับที่หน้ารายงานใช้คิดค่า GP (rateFor) ตัวเลขสองที่จะได้ตรงกัน
 */
export function netOfOrders(orders = [], rateFor = () => 0) {
  return orders.reduce((sum, o) => {
    const amount = o.total_amount ?? 0
    if (o.channel !== 'delivery') return sum + amount
    return sum + amount * (1 - (rateFor(o.platform ?? 'เดลิเวอรี่') || 0))
  }, 0)
}

function summarize(orders, rateFor) {
  const gross = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const store = orders
    .filter((o) => o.channel !== 'delivery')
    .reduce((s, o) => s + (o.total_amount ?? 0), 0)
  return {
    gross,
    net: netOfOrders(orders, rateFor),
    store,
    delivery: gross - store,
    count: orders.length,
  }
}

/**
 * ป้ายของกะในกราฟ — วันที่เปิดกะเป็นตัวตั้ง
 * ขายข้ามเที่ยงคืนก็ยังนับเป็นวันที่เปิดร้าน ตรงกับที่คนในร้านพูดถึงวันนั้น
 */
export function shiftLabel(shift) {
  const opened = toDate(shift?.opened_at)
  if (!opened) return 'กะ'
  return `${opened.getDate()}/${opened.getMonth() + 1}`
}

function timeOf(date) {
  if (!date) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** ช่วงเวลาของกะ เช่น "16:10 – 01:05" หรือ "16:10 – ตอนนี้" ถ้ายังไม่ปิด */
export function shiftTimeRange(shift) {
  const opened = toDate(shift?.opened_at)
  const closed = toDate(shift?.closed_at)
  if (!opened) return ''
  return `${timeOf(opened)} – ${closed ? timeOf(closed) : 'ตอนนี้'}`
}

/**
 * แบ่งบิลเป็นแท่งรายกะ เรียงจากกะเก่าไปใหม่ตามที่กราฟอ่านซ้ายไปขวา
 *
 * กะที่เลือกมาแต่ยังไม่มีบิลเลยก็ยังได้แท่งเปล่า วันที่เปิดร้านแต่ขายไม่ออกต้องเห็นเป็นศูนย์
 * ไม่ใช่หายไปจากกราฟจนดูเหมือนวันนั้นปิดร้าน
 *
 * บิลที่ไม่มีกะ (ขายตอนกดปิดหน้าต่างเปิดกะทิ้ง) รวมเป็นแท่ง "นอกกะ" แยกไว้ท้ายสุด
 * เงินก้อนนี้ห้ามหายจากกราฟเงียบ ๆ ต้องเห็นว่ามีอยู่และรู้ว่ามาจากไหน
 */
export function groupByShift(orders = [], shifts = [], { rateFor } = {}) {
  const byShift = new Map(shifts.map((s) => [s.id, []]))
  const outside = []

  orders.forEach((o) => {
    if (o.shift_id && byShift.has(o.shift_id)) byShift.get(o.shift_id).push(o)
    else if (!o.shift_id) outside.push(o)
    // บิลของกะอื่นที่ไม่ได้อยู่ในช่วงนี้ — ตั้งใจทิ้ง
    // เช่นบิลตีหนึ่งของเมื่อวานที่ตกมาอยู่ในช่วงเวลาที่ดึงมา ไม่ใช่ของกะวันนี้
  })

  const rows = [...shifts]
    .sort((a, b) => (toDate(a.opened_at)?.getTime() ?? 0) - (toDate(b.opened_at)?.getTime() ?? 0))
    .map((shift) => ({
      key: shift.id,
      shiftId: shift.id,
      label: shiftLabel(shift),
      timeRange: shiftTimeRange(shift),
      openedAt: toDate(shift.opened_at),
      isOpen: shift.status === 'open',
      ...summarize(byShift.get(shift.id) ?? [], rateFor),
    }))

  if (outside.length > 0) {
    rows.push({
      key: OUTSIDE_SHIFT_KEY,
      shiftId: null,
      label: 'นอกกะ',
      timeRange: 'ขายตอนไม่ได้เปิดกะ',
      openedAt: null,
      isOpen: false,
      isOutside: true,
      ...summarize(outside, rateFor),
    })
  }
  return rows
}

/**
 * แท่งรายชั่วโมงภายในกะเดียว นับจากชั่วโมงที่เปิดกะ
 *
 * แบ่งตามชั่วโมงในนาฬิกาตรง ๆ ไม่ได้ เพราะขายข้ามเที่ยงคืน — เที่ยงคืนครึ่งจะไปอยู่ชั่วโมงที่ 0
 * กลายเป็นแท่งแรกของกราฟทั้งที่เป็นช่วงท้ายของกะ จึงนับชั่วโมงต่อจากเวลาเปิดกะแทน
 */
export function hourlyWithinShift(orders = [], shift, { now = new Date() } = {}) {
  const opened = toDate(shift?.opened_at)
  if (!opened) return []
  const start = new Date(opened)
  start.setMinutes(0, 0, 0)

  const buckets = []
  const counts = []
  orders.forEach((o) => {
    const at = toDate(o.created_at)
    if (!at) return
    const index = Math.max(0, Math.floor((at.getTime() - start.getTime()) / 3600000))
    buckets[index] = (buckets[index] ?? 0) + (o.total_amount ?? 0)
    counts[index] = (counts[index] ?? 0) + 1
  })

  // กราฟยาวถึงชั่วโมงที่ปิดกะ หรือถึงตอนนี้ถ้ายังเปิดอยู่ ชั่วโมงที่ยังไม่มีบิลจะได้เห็นเป็นช่องว่าง
  const end = toDate(shift?.closed_at) ?? (shift?.status === 'open' ? now : null)
  const lastFromClock = end ? Math.floor((end.getTime() - start.getTime()) / 3600000) : 0
  const length = Math.max(buckets.length, lastFromClock + 1, 1)

  return Array.from({ length }, (_, i) => {
    const hour = (start.getHours() + i) % 24
    return {
      key: String(i),
      label: `${hour}:00 น.`,
      shortLabel: String(hour),
      value: buckets[i] ?? 0,
      count: counts[i] ?? 0,
    }
  })
}

/**
 * ช่วงเวลาที่ต้องดึงบิลมาให้ครบทุกกะที่เลือก
 *
 * เริ่มตั้งแต่เที่ยงคืนของวันแรก เพื่อเก็บบิลนอกกะของวันนั้นด้วย
 * จบที่เวลาปิดกะสุดท้าย (หรือตอนนี้ถ้ายังเปิด) ไม่ใช่เที่ยงคืนของวันสุดท้าย
 * ไม่งั้นบิลหลังเที่ยงคืนของกะสุดท้ายจะหลุดไป
 */
export function orderWindow(from, to, shifts = [], { now = new Date() } = {}) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
  let end = new Date(ty, tm - 1, td, 23, 59, 59, 999)

  shifts.forEach((s) => {
    const closeAt = toDate(s.closed_at) ?? (s.status === 'open' ? now : null)
    if (closeAt && closeAt > end) end = closeAt
  })
  return { start, end }
}

/**
 * เก็บเฉพาะบิลที่เป็นของช่วงนี้จริง
 * บิลในกะที่เลือก หรือบิลนอกกะที่เกิดในวันที่เลือก (ตามปฏิทิน เพราะไม่มีกะให้อ้าง)
 */
export function ordersInShiftRange(orders = [], shifts = [], from, to) {
  const ids = new Set(shifts.map((s) => s.id))
  return orders.filter((o) => {
    if (o.shift_id) return ids.has(o.shift_id)
    const day = toDate(o.created_at)
    if (!day) return false
    const date = toDateString(day)
    return date >= from && date <= to
  })
}

/**
 * ยอดรวมจากสรุปที่เก็บไว้ในกะตอนปิด — ใช้เทียบกับช่วงก่อนหน้า
 *
 * ช่วงก่อนหน้าปิดกะไปหมดแล้ว สรุปจึงครบ อ่านจากกะตรง ๆ ถูกกว่านับบิลใหม่หลายสิบเท่า
 * แต่ถ้ามีกะไหนไม่มีสรุป (ปิดไว้ก่อนระบบสรุปจะมี) ไม่เทียบเลยดีกว่า
 * เพราะตัวเลขขาดไปก้อนหนึ่งจะทำให้ลูกศรขึ้นลงหลอกคน
 */
export function totalsFromSummaries(shifts = []) {
  const closed = shifts.filter((s) => s.status === 'closed')
  if (closed.length === 0) return null
  if (closed.some((s) => !s.summary)) return null
  return closed.reduce(
    (acc, s) => ({
      gross: acc.gross + (s.summary.total ?? 0),
      count: acc.count + (s.summary.order_count ?? 0),
    }),
    { gross: 0, count: 0 },
  )
}

/**
 * เทียบรายชั่วโมงสองกะ (กะที่ดูอยู่ กับกะก่อนหน้า) บนแกนเวลาเดียวกัน
 *
 * จัดแกนตามเวลานาฬิกา ไม่ใช่ "ชั่วโมงที่เท่าไหร่ของกะ" — เปิดสี่โมงสิบกับสี่โมงครึ่ง
 * ต้องอยู่แท่งสี่โมงเหมือนกัน คนในร้านคิดว่า "สองทุ่มวันนี้ขายได้เท่าไหร่ เทียบสองทุ่มเมื่อวาน"
 * แกนเริ่มที่ชั่วโมงเปิดร้านที่เช้ากว่า ข้ามเที่ยงคืนต่อไปได้ (เที่ยงคืนครึ่งอยู่ท้ายแกน)
 *
 * `sameTime` = ยอดถึงเวลาเดียวกันของสองกะ ใช้ตอนกะยังเปิดอยู่เท่านั้น
 * ยอดครึ่งกะเทียบกับยอดเต็มกะของเมื่อวานจะดูตกตลอดจนปิดร้าน
 */
export function compareShiftsHourly(orders = [], shift, prevOrders = [], prevShift, { now = new Date() } = {}) {
  const opened = toDate(shift?.opened_at)
  if (!opened) return { bars: [], sameTime: null, previousTotal: 0, currentTotal: 0 }
  const prevOpened = toDate(prevShift?.opened_at)

  // จุดเริ่มแกน = ชั่วโมงเปิดร้านที่เช้ากว่า (นับเป็นนาทีของวัน)
  const openHourOf = (d) => d.getHours()
  const pivot = Math.min(openHourOf(opened), prevOpened ? openHourOf(prevOpened) : 24) * 60
  const minuteOnAxis = (d) => ((d.getHours() * 60 + d.getMinutes() - pivot) % 1440 + 1440) % 1440

  const bucket = (list) => {
    const values = []
    const counts = []
    list.forEach((o) => {
      const at = toDate(o.created_at)
      if (!at) return
      const i = Math.floor(minuteOnAxis(at) / 60)
      values[i] = (values[i] ?? 0) + (o.total_amount ?? 0)
      counts[i] = (counts[i] ?? 0) + 1
    })
    return { values, counts }
  }
  const cur = bucket(orders)
  const prev = bucket(prevShift ? prevOrders : [])

  const isOpen = shift.status === 'open'
  const curEnd = toDate(shift.closed_at) ?? (isOpen ? now : opened)
  const prevEnd = toDate(prevShift?.closed_at)
  const nowIndex = isOpen ? Math.floor(minuteOnAxis(now) / 60) : null
  const length = Math.max(
    cur.values.length,
    prev.values.length,
    Math.floor(minuteOnAxis(curEnd) / 60) + 1,
    prevEnd ? Math.floor(minuteOnAxis(prevEnd) / 60) + 1 : 0,
    1,
  )

  const bars = Array.from({ length }, (_, i) => {
    const hour = (pivot / 60 + i) % 24
    return {
      key: String(i),
      label: `${hour}:00 น.`,
      shortLabel: String(hour),
      value: cur.values[i] ?? 0,
      count: cur.counts[i] ?? 0,
      compare: prevShift ? prev.values[i] ?? 0 : null,
      compareCount: prev.counts[i] ?? 0,
      // ชั่วโมงที่ยังมาไม่ถึง — กะยังเปิดอยู่ ไม่ใช่ขายไม่ได้
      // ถ้ามีบิลอยู่แล้วไม่ซ่อน (นาฬิกาเครื่องนี้อาจช้ากว่าเครื่องที่ออกบิล)
      future: nowIndex !== null && i > nowIndex && !(cur.values[i] > 0),
    }
  })

  const total = (list) => list.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  let sameTime = null
  if (isOpen && prevShift) {
    const cutoff = minuteOnAxis(now)
    const upToNow = prevOrders.filter((o) => {
      const at = toDate(o.created_at)
      return at && minuteOnAxis(at) <= cutoff
    })
    sameTime = {
      current: total(orders),
      currentCount: orders.length,
      previous: total(upToNow),
      previousCount: upToNow.length,
      at: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    }
  }

  return { bars, sameTime, previousTotal: total(prevShift ? prevOrders : []), currentTotal: total(orders) }
}

/** ชื่อเรียกกะก่อนหน้า — เปิดวันก่อนหน้าพอดีเรียกว่า "เมื่อวาน" ไม่งั้นบอกวันที่ */
export function previousShiftName(shift, prevShift) {
  const a = toDate(shift?.opened_at)
  const b = toDate(prevShift?.opened_at)
  if (!a || !b) return 'กะก่อน'
  const dayBefore = new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)
  const sameDay = b.getFullYear() === dayBefore.getFullYear() && b.getMonth() === dayBefore.getMonth() && b.getDate() === dayBefore.getDate()
  return sameDay ? 'เมื่อวาน' : `กะ ${shiftLabel(prevShift)}`
}
