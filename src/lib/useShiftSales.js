import { useMemo } from 'react'
import { useAppData } from './appDataContext'
import { effectiveRates } from './payoutMath'
import { netOfOrders, orderWindow, ordersInShiftRange } from './shiftSales'
import { usePayouts } from './usePurchases'
import { useOrdersBetween, useOrdersForShift, useShiftsInRange } from './useOrders'

/**
 * ยอดขายของช่วงวันที่ นับแบบรายกะเหมือนหน้าแดชบอร์ด
 *
 * กะที่เปิดในวันที่เลือกนับทั้งกะ รวมบิลหลังเที่ยงคืน ตัวเลขรายรับในหน้ารายจ่ายจึงตรงกับแดชบอร์ด
 * ไม่ใช่นับตามปฏิทินแล้วบิลตีหนึ่งไปโผล่เป็นของวันรุ่งขึ้น
 */
export function useShiftSales(from, to) {
  const { gpRateFor } = useAppData()
  const { shifts, loading: shiftsLoading } = useShiftsInRange(from, to)
  const openShift = useMemo(() => shifts.find((s) => s.status === 'open') ?? null, [shifts])
  const { orders: liveOrders } = useOrdersForShift(openShift?.id)

  // ขอบเวลาไม่ใช้กะที่ยังเปิด บิลกะนั้นมาจากตัวฟังสด — ถ้าเอาเวลาตอนนี้เป็นขอบจะดึงใหม่ไม่หยุด
  const window = useMemo(
    () => (from && to ? orderWindow(from, to, shifts.filter((s) => s.status === 'closed')) : null),
    [from, to, shifts],
  )
  const { orders: pastOrders, loading: pastLoading, truncated } = useOrdersBetween(window?.start, window?.end)

  const orders = useMemo(() => {
    const past = openShift ? pastOrders.filter((o) => o.shift_id !== openShift.id) : pastOrders
    const merged = openShift ? [...past, ...liveOrders] : past
    return ordersInShiftRange(merged, shifts, from, to)
  }, [pastOrders, liveOrders, openShift, shifts, from, to])

  const payouts = usePayouts()
  const rateFor = useMemo(() => effectiveRates(payouts, gpRateFor), [payouts, gpRateFor])

  return useMemo(() => {
    const gross = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const net = netOfOrders(orders, rateFor)
    return {
      gross,
      net,
      gpFee: gross - net,
      orderCount: orders.length,
      shiftCount: shifts.length,
      loading: shiftsLoading || pastLoading,
      truncated,
    }
  }, [orders, rateFor, shifts.length, shiftsLoading, pastLoading, truncated])
}
