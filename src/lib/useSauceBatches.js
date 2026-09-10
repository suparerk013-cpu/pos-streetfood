import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'
import { logSnapshotError } from './snapshotError'

/**
 * ประวัติการทำน้ำจิ้ม
 *
 * ทุก query ต้องมีเพดานเสมอ Firestore คิดเงินตามจำนวนเอกสารที่อ่าน
 * ทำน้ำจิ้มวันละหม้อ ปีเดียวก็ 300 กว่าเอกสาร ถ้าดึงทั้งหมดทุกครั้งที่กดเข้าแท็บ
 * ค่าใช้จ่ายจะโตไปเรื่อย ๆ โดยที่หน้าจอแสดงจริงแค่ไม่กี่แถว
 */

const RECENT_LIMIT = 100
const RANGE_LIMIT = 500

/** หม้อล่าสุด — พอสำหรับแท็บประวัติที่คนเลื่อนดูย้อนหลังไม่กี่สิบรายการ */
export function useRecentSauceBatches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'sauce_batches'), orderBy('created_at', 'desc'), limit(RECENT_LIMIT))
    return onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, logSnapshotError('ประวัติการทำน้ำจิ้ม'))
  }, [])

  return { batches, loading, atLimit: batches.length >= RECENT_LIMIT }
}

/** หม้อในช่วงวันที่ที่เลือก สำหรับแท็บรายงาน */
export function useSauceBatchesInRange(from, to) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'sauce_batches'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(RANGE_LIMIT),
    )
    return onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, logSnapshotError('รายงานการทำน้ำจิ้ม'))
  }, [from, to])

  return { batches, loading }
}
