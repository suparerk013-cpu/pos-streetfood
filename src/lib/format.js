export const PAYMENT_METHOD_LABELS = {
  cash: 'เงินสด',
  promptpay: 'โมบายแบงค์กิ้ง',
  delivery: 'เดลิเวอรี่',
}

export const PAYMENT_METHOD_SHORT_LABELS = {
  cash: 'เงินสด',
  promptpay: 'โมบาย',
  delivery: 'เดลิ',
}

export const PAYMENT_METHOD_ICONS = {
  cash: '💵',
  promptpay: '📱',
  delivery: '🛵',
}

export function formatTime(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function formatDateTime(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function elapsed(ts) {
  if (!ts?.toDate) return ''
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 60000)
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`
}
