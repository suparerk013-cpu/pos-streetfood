import { summarizeByName, totalOf } from './expenses'

const ORANGE = 'FFEA580C'
const ORANGE_SOFT = 'FFFFF7ED'
const GREY_SOFT = 'FFF8F8F8'
const BAHT_FORMAT = '#,##0.00'
const QTY_FORMAT = '#,##0.##'

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
  })
  row.height = 26
}

function zebra(sheet, startRow) {
  for (let i = startRow; i <= sheet.rowCount; i += 1) {
    if ((i - startRow) % 2 === 1) {
      sheet.getRow(i).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_SOFT } }
      })
    }
  }
}

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * ไฟล์ Excel รายจ่าย 3 ชีต: สรุปตามรายการ · รายการทั้งหมด · รับ-จ่าย
 * โหลด exceljs แบบ dynamic เฉพาะตอนกดปุ่ม เพื่อไม่ให้บันเดิลหน้าขายหนักขึ้น
 *
 * `entries` คือรายจ่ายที่รวมแล้ว (mergeEntries) ทั้งแบบใหม่และรายการซื้อวัตถุดิบเก่า
 */
export async function exportExpenseWorkbook({
  entries = [],
  sales = { gross: 0, net: 0, gpFee: 0 },
  periodLabel,
  filename,
  shopName = '',
}) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = shopName || 'POS Street Food'
  workbook.created = new Date()

  const summary = summarizeByName(entries)
  const grandTotal = totalOf(entries)

  /* ───── ชีต 1: สรุปตามรายการ ───── */
  const s1 = workbook.addWorksheet('สรุปตามรายการ', { views: [{ state: 'frozen', ySplit: 3 }] })
  s1.mergeCells('A1:F1')
  s1.getCell('A1').value = `รายจ่าย ${periodLabel}${shopName ? ` — ${shopName}` : ''}`
  s1.getCell('A1').font = { bold: true, size: 14 }
  s1.getRow(2).height = 6
  s1.columns = [
    { key: 'name', width: 24 },
    { key: 'times', width: 11 },
    { key: 'qty', width: 12 },
    { key: 'unit', width: 9 },
    { key: 'total', width: 14 },
    { key: 'share', width: 11 },
  ]
  styleHeader(s1.addRow({
    name: 'รายการ', times: 'จดกี่ครั้ง', qty: 'จำนวนรวม', unit: 'หน่วย', total: 'ยอดรวม (฿)', share: '% ของทั้งหมด',
  }))
  const firstDataRow = s1.rowCount + 1
  summary.forEach((row) => {
    s1.addRow({
      name: row.name,
      times: row.times,
      qty: row.qty > 0 ? row.qty : null,
      unit: row.qty > 0 ? row.unit ?? '' : '',
      total: row.total,
      share: grandTotal > 0 ? row.total / grandTotal : 0,
    })
  })
  zebra(s1, firstDataRow)
  const totalRow = s1.addRow({
    name: 'รวมทั้งหมด',
    times: summary.reduce((s, r) => s + r.times, 0),
    total: grandTotal,
    share: grandTotal > 0 ? 1 : 0,
  })
  totalRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_SOFT } }
    cell.border = { top: { style: 'double', color: { argb: ORANGE } } }
  })
  s1.getColumn('qty').numFmt = QTY_FORMAT
  s1.getColumn('total').numFmt = BAHT_FORMAT
  s1.getColumn('share').numFmt = '0.0%'

  /* ───── ชีต 2: รายการทั้งหมด ───── */
  const s2 = workbook.addWorksheet('รายการทั้งหมด', { views: [{ state: 'frozen', ySplit: 1 }] })
  s2.columns = [
    { key: 'date', width: 13 },
    { key: 'name', width: 24 },
    { key: 'qty', width: 10 },
    { key: 'unit', width: 9 },
    { key: 'amount', width: 13 },
    { key: 'note', width: 28 },
  ]
  styleHeader(s2.addRow({ date: 'วันที่', name: 'รายการ', qty: 'จำนวน', unit: 'หน่วย', amount: 'จ่าย (฿)', note: 'โน้ต' }))
  ;[...entries]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((e) => {
      s2.addRow({ date: e.date, name: e.name, qty: e.qty, unit: e.unit ?? '', amount: e.amount, note: e.note ?? '' })
    })
  zebra(s2, 2)
  s2.getColumn('qty').numFmt = QTY_FORMAT
  s2.getColumn('amount').numFmt = BAHT_FORMAT

  /* ───── ชีต 3: รับ-จ่าย ───── */
  const s3 = workbook.addWorksheet('รับ-จ่าย')
  s3.columns = [{ key: 'label', width: 30 }, { key: 'value', width: 16 }]
  s3.mergeCells('A1:B1')
  s3.getCell('A1').value = `รายรับเทียบรายจ่าย ${periodLabel}`
  s3.getCell('A1').font = { bold: true, size: 14 }
  s3.addRow({})
  const left = sales.net - grandTotal
  ;[
    { label: 'ยอดขายรวม (นับตามกะ)', value: sales.gross },
    { label: 'หัก ค่า GP เดลิเวอรี', value: -sales.gpFee },
    { label: 'เงินเข้าจริง', value: sales.net },
    { label: 'หัก รายจ่ายที่จดไว้', value: -grandTotal },
  ].forEach((r) => s3.addRow(r))
  const leftRow = s3.addRow({ label: 'เหลือ', value: left })
  leftRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_SOFT } }
    cell.border = { top: { style: 'double', color: { argb: ORANGE } } }
  })
  s3.getColumn('value').numFmt = BAHT_FORMAT

  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, filename)
}
