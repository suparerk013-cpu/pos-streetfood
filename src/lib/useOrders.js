import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { ORDER_PAGE_SIZE } from './constants'
import { rangeToTimestamps } from './dates'
import { db } from './firebase'

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
    })
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
    })
  }, [shiftId])

  return { orders, loading }
}
