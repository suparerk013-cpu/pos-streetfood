import { Timestamp } from 'firebase/firestore'

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** 'YYYY-MM-DD' ตามเวลาเครื่อง — ใช้เป็นคีย์วันที่ทั่วทั้งแอป */
export function toDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** แปลงช่วงวันที่แบบสตริงเป็น Timestamp สำหรับใส่ใน where() ของ Firestore */
export function rangeToTimestamps(fromStr, toStr) {
  const start = fromDateString(fromStr)
  const end = fromDateString(toStr)
  end.setHours(23, 59, 59, 999)
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) }
}

export function shiftDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function getMonthRange(cursor) {
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  return { from: toDateString(from), to: toDateString(to) }
}

/** ช่วงเวลาสำเร็จรูปที่หน้ารายงานและหน้าค่าใช้จ่ายใช้ร่วมกัน */
export function getPresetRange(preset, monthCursor = new Date()) {
  const today = new Date()
  const todayStr = toDateString(today)
  if (preset === '7days') return { from: toDateString(shiftDays(today, -6)), to: todayStr }
  if (preset === '30days') return { from: toDateString(shiftDays(today, -29)), to: todayStr }
  if (preset === 'month') return getMonthRange(monthCursor)
  return { from: todayStr, to: todayStr }
}

/**
 * ช่วงเวลาก่อนหน้าที่ยาวเท่ากัน ใช้เปรียบเทียบ "เทียบช่วงก่อน" ในแดชบอร์ด
 * 7 วันนี้ เทียบกับ 7 วันก่อนหน้า / เดือนนี้ เทียบกับเดือนที่แล้ว
 */
export function getPreviousRange(from, to) {
  const start = fromDateString(from)
  const end = fromDateString(to)
  const days = Math.round((end - start) / 86400000) + 1
  return {
    from: toDateString(shiftDays(start, -days)),
    to: toDateString(shiftDays(start, -1)),
  }
}

/** รายชื่อวันทั้งหมดในช่วง ใช้วาดกราฟให้มีแท่งครบทุกวันแม้วันนั้นไม่มียอดขาย */
export function eachDateInRange(from, to) {
  const dates = []
  const cursor = fromDateString(from)
  const end = fromDateString(to)
  while (cursor <= end) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function formatThaiDate(dateStr) {
  const d = fromDateString(dateStr)
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`
}

export function formatThaiMonth(cursor) {
  return `${THAI_MONTHS[cursor.getMonth()]} ${cursor.getFullYear() + 543}`
}

/** วันที่ของบิล/log จาก Firestore Timestamp เป็นสตริง 'YYYY-MM-DD' */
export function docDateStr(docData, field = 'created_at') {
  const ts = docData?.[field]
  if (!ts?.toDate) return null
  return toDateString(ts.toDate())
}

export function formatTime(ts) {
  if (!ts?.toDate) return '--:--'
  return ts.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}
