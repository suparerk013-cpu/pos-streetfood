import { INGREDIENT_CATEGORIES } from './ingredientCategories'

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

/**
 * รวมการซื้อของวัตถุดิบเดียวกันทุกครั้งในช่วงให้เหลือบรรทัดเดียว
 * ผักชีซื้อ 18 ครั้งในเดือน จะสรุปเป็นแถวเดียวพร้อมราคาต่ำสุด/สูงสุด/เฉลี่ย
 */
export function summarizePurchases(purchases) {
  const map = new Map()
  purchases.forEach((row) => {
    const key = row.ingredient_id ?? row.ingredient_name
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: row.ingredient_name,
        category: row.category ?? 'other',
        unit: row.unit ?? '',
        times: 0,
        qty: 0,
        total: 0,
        minPrice: Infinity,
        maxPrice: 0,
      })
    }
    const entry = map.get(key)
    entry.times += 1
    entry.qty += row.qty ?? 0
    entry.total += row.total_amount ?? 0
    const unitPrice = row.unit_price ?? 0
    if (unitPrice > 0) {
      entry.minPrice = Math.min(entry.minPrice, unitPrice)
      entry.maxPrice = Math.max(entry.maxPrice, unitPrice)
    }
  })

  return [...map.values()]
    .map((e) => ({
      ...e,
      minPrice: e.minPrice === Infinity ? 0 : e.minPrice,
      avgPrice: e.qty > 0 ? e.total / e.qty : 0,
    }))
    .sort((a, b) => b.total - a.total)
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
 * ไฟล์ Excel สรุปวัตถุดิบ 3 ชีต
 * โหลด exceljs แบบ dynamic เฉพาะตอนกดปุ่ม เพื่อไม่ให้บันเดิลหน้าขายหนักขึ้น
 */
export async function exportIngredientWorkbook({
  purchases,
  expenses = [],
  totalSales = 0,
  periodLabel,
  filename,
  shopName = '',
}) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = shopName || 'POS Street Food'
  workbook.created = new Date()

  const summary = summarizePurchases(purchases)
  const grandTotal = summary.reduce((s, r) => s + r.total, 0)

  /* ───── ชีต 1: สรุปรายเดือน ───── */
  const s1 = workbook.addWorksheet('สรุปรายเดือน', {
    views: [{ state: 'frozen', ySplit: 3 }],
  })
  s1.mergeCells('A1:J1')
  s1.getCell('A1').value = `สรุปวัตถุดิบ ${periodLabel}${shopName ? ` — ${shopName}` : ''}`
  s1.getCell('A1').font = { bold: true, size: 14 }
  s1.getRow(2).height = 6

  s1.columns = [
    { key: 'name', width: 22 },
    { key: 'category', width: 14 },
    { key: 'times', width: 10 },
    { key: 'qty', width: 12 },
    { key: 'unit', width: 8 },
    { key: 'avg', width: 13 },
    { key: 'min', width: 11 },
    { key: 'max', width: 11 },
    { key: 'total', width: 14 },
    { key: 'share', width: 10 },
  ]
  const head1 = s1.addRow({
    name: 'วัตถุดิบ', category: 'หมวด', times: 'จำนวนครั้ง', qty: 'ปริมาณรวม', unit: 'หน่วย',
    avg: 'ราคาเฉลี่ย/หน่วย', min: 'ต่ำสุด', max: 'สูงสุด', total: 'ยอดรวม (฿)', share: '% ของทั้งหมด',
  })
  styleHeader(head1)
  const firstDataRow = s1.rowCount + 1

  summary.forEach((row) => {
    s1.addRow({
      name: row.name,
      category: INGREDIENT_CATEGORIES[row.category] ?? 'อื่นๆ',
      times: row.times,
      qty: row.qty,
      unit: row.unit,
      avg: row.avgPrice,
      min: row.minPrice,
      max: row.maxPrice,
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
  ;['avg', 'min', 'max', 'total'].forEach((key) => { s1.getColumn(key).numFmt = BAHT_FORMAT })
  s1.getColumn('share').numFmt = '0.0%'

  /* ───── ชีต 2: รายการซื้อทั้งหมด ───── */
  const s2 = workbook.addWorksheet('รายการซื้อทั้งหมด', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  s2.columns = [
    { key: 'date', width: 13 },
    { key: 'name', width: 22 },
    { key: 'category', width: 14 },
    { key: 'qty', width: 10 },
    { key: 'unit', width: 8 },
    { key: 'unitPrice', width: 13 },
    { key: 'total', width: 13 },
    { key: 'vendor', width: 20 },
    { key: 'note', width: 26 },
  ]
  const head2 = s2.addRow({
    date: 'วันที่', name: 'วัตถุดิบ', category: 'หมวด', qty: 'จำนวน', unit: 'หน่วย',
    unitPrice: 'ราคา/หน่วย', total: 'รวม (฿)', vendor: 'ร้านที่ซื้อ', note: 'หมายเหตุ',
  })
  styleHeader(head2)

  ;[...purchases]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((row) => {
      s2.addRow({
        date: row.date,
        name: row.ingredient_name,
        category: INGREDIENT_CATEGORIES[row.category] ?? 'อื่นๆ',
        qty: row.qty,
        unit: row.unit,
        unitPrice: row.unit_price,
        total: row.total_amount,
        vendor: row.vendor ?? '',
        note: row.note ?? '',
      })
    })
  zebra(s2, 2)
  s2.getColumn('qty').numFmt = QTY_FORMAT
  s2.getColumn('unitPrice').numFmt = BAHT_FORMAT
  s2.getColumn('total').numFmt = BAHT_FORMAT

  /* ───── ชีต 3: ภาพรวม ───── */
  const s3 = workbook.addWorksheet('ภาพรวม')
  s3.columns = [{ key: 'label', width: 28 }, { key: 'value', width: 16 }]
  s3.mergeCells('A1:B1')
  s3.getCell('A1').value = `ภาพรวม ${periodLabel}`
  s3.getCell('A1').font = { bold: true, size: 14 }
  s3.addRow({})

  const otherExpenseTotal = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const netProfit = totalSales - grandTotal - otherExpenseTotal

  const rows = [
    { label: 'ยอดขายรวม', value: totalSales },
    { label: 'หัก ค่าวัตถุดิบ', value: -grandTotal },
  ]
  const byCategory = {}
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.amount ?? 0)
  })
  const OTHER_LABELS = {
    utility_water: 'หัก ค่าน้ำ',
    utility_electric: 'หัก ค่าไฟ',
    rent: 'หัก ค่าเช่า',
    labor: 'หัก ค่าแรง',
    other: 'หัก ค่าใช้จ่ายอื่น',
    raw_material: 'หัก วัตถุดิบ (รายการเก่า)',
  }
  Object.entries(byCategory).forEach(([key, value]) => {
    rows.push({ label: OTHER_LABELS[key] ?? 'หัก อื่นๆ', value: -value })
  })

  rows.forEach((r) => s3.addRow(r))
  const profitRow = s3.addRow({ label: 'กำไรสุทธิ', value: netProfit })
  profitRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_SOFT } }
    cell.border = { top: { style: 'double', color: { argb: ORANGE } } }
  })
  const marginRow = s3.addRow({
    label: 'อัตรากำไร',
    value: totalSales > 0 ? netProfit / totalSales : 0,
  })
  marginRow.getCell('value').numFmt = '0.0%'
  s3.getColumn('value').numFmt = BAHT_FORMAT
  marginRow.getCell('value').numFmt = '0.0%'

  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, filename)
}
