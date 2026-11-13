import {
  Timestamp,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore'
import { logSnapshotError } from './snapshotError'
import { useEffect, useState } from 'react'
import { ORDER_PAGE_SIZE } from './constants'
import { rangeToTimestamps } from './dates'
import { db } from './firebase'

/** เพดานรวมกันพังเงียบ ๆ ถ้ามีบั๊กวนลูป — 20 หน้า × 500 = หมื่นบิล เกินกว่าที่ร้านขายในเดือนเดียว */
const MAX_PAGES = 20

/**
 * บิลในช่วงวันที่ที่เลือกเท่านั้น
 * เดิมทุกหน้าดึง orders ทั้ง collection มากรองในเบราว์เซอร์ ทำให้ค่า Firestore reads
 * โตตามจำนวนบิลสะสมไม่มีเพดาน — ตอนนี้กรองที่ฝั่งเซิร์ฟเวอร์และจำกัดจำนวน
 */
export function useOrdersInRange(from, to, { includeVoided = false } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    setLoading(true)
    const { start, end } = rangeToTimestamps(from, to)
    const q = query(
      collection(db, 'orders'),
      where('created_at', '>=', start),
      where('created_at', '<=', end),
      orderBy('created_at', 'desc'),
      limit(ORDER_PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setOrders(includeVoided ? rows : rows.filter((o) => !o.is_voided))
      setLoading(false)
    }, logSnapshotError('บิลขาย'))
  }, [from, to, includeVoided])

  return { orders, loading }
}

/** บิลของกะที่ระบุ — ค้นด้วย shift_id ตรง ๆ ไม่ใช่เดาจากเวลาเปิดกะ */
export function useOrdersForShift(shiftId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shiftId) {
      setOrders([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const q = query(
      collection(db, 'orders'),
      where('shift_id', '==', shiftId),
      orderBy('created_at', 'desc'),
      limit(ORDER_PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.is_voided))
      setLoading(false)
    }, logSnapshotError('บิลขายในกะ'))
  }, [shiftId])

  return { orders, loading }
}

/**
 * บิลทั้งหมดในช่วงเวลา ดึงทีละหน้าจนครบ
 *
 * เดิมดึงหน้าเดียว 500 ใบแล้วจบ เรียงใหม่ไปเก่า ถ้าเดือนนั้นขายเกิน 500 บิล
 * (แค่วันละ 17 บิลก็ถึง) บิลเก่าจะถูกตัดทิ้งเงียบ ๆ รายงานเดือนยอดต่ำกว่าจริงโดยไม่มีคำเตือน
 *
 * ไม่ฟังแบบสดเพราะเป็นข้อมูลย้อนหลัง ถ้าฟังสดหลายหน้า บิลใหม่เข้ามาใบเดียวจะดันขอบหน้า
 * ให้ต้องอ่านทุกหน้าใหม่หมด ส่วนกะที่ยังเปิดอยู่ หน้ารายงานเอาบิลสดของกะนั้นมาเติมให้เอง
 */
export function useOrdersBetween(start, end) {
  const [state, setState] = useState({ orders: [], loading: true, truncated: false })
  const startMs = start?.getTime?.() ?? null
  const endMs = end?.getTime?.() ?? null

  useEffect(() => {
    if (startMs == null || endMs == null) return undefined
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    ;(async () => {
      const docs = []
      let cursor = null
      let truncated = true
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const parts = [
          collection(db, 'orders'),
          where('created_at', '>=', Timestamp.fromMillis(startMs)),
          where('created_at', '<=', Timestamp.fromMillis(endMs)),
          orderBy('created_at', 'desc'),
        ]
        if (cursor) parts.push(startAfter(cursor))
        parts.push(limit(ORDER_PAGE_SIZE))
        const snap = await getDocs(query(...parts))
        docs.push(...snap.docs)
        if (snap.docs.length < ORDER_PAGE_SIZE) {
          truncated = false
          break
        }
        cursor = snap.docs[snap.docs.length - 1]
      }
      if (cancelled) return
      setState({
        orders: docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => !o.is_voided),
        loading: false,
        truncated,
      })
    })().catch((err) => {
      logSnapshotError('บิลขายย้อนหลัง')(err)
      if (!cancelled) setState((prev) => ({ ...prev, loading: false }))
    })

    return () => { cancelled = true }
  }, [startMs, endMs])

  return state
}

/**
 * กะที่เปิดในช่วงวันที่ที่เลือก
 *
 * กะเป็นเจ้าของวันขาย กะที่เปิดวันที่ 12 แล้วขายถึงตีหนึ่งวันที่ 13 ยังเป็นของวันที่ 12
 * จึงเลือกกะจากเวลาเปิดอย่างเดียว ไม่ดูเวลาปิด
 */
export function useShiftsInRange(from, to) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    setLoading(true)
    const { start, end } = rangeToTimestamps(from, to)
    const q = query(
      collection(db, 'shifts'),
      where('opened_at', '>=', start),
      where('opened_at', '<=', end),
      orderBy('opened_at', 'desc'),
      limit(200),
    )
    return onSnapshot(q, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, logSnapshotError('กะในช่วงที่เลือก'))
  }, [from, to])

  return { shifts, loading }
}
