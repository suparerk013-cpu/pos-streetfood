import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

const PAGE_SIZE = 1000

/** การซื้อวัตถุดิบในช่วงวันที่ที่เลือก — date เก็บเป็นสตริง 'YYYY-MM-DD' จึงเทียบตรง ๆ ได้ */
export function usePurchasesInRange(from, to) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'purchases'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [from, to])

  return { purchases, loading }
}

export function useExpensesInRange(from, to) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'expenses'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [from, to])

  return { expenses, loading }
}

export function useDeliveryImportsInRange(from, to) {
  const [imports, setImports] = useState([])

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'delivery_imports'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setImports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [from, to])

  return imports
}
