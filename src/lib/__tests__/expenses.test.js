import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({}))

const {
  buildExpensePayload,
  entryFromExpense,
  mergeEntries,
  nameSuggestions,
  summarizeByName,
  totalOf,
} = await import('../expenses')

const exp = (fields) => ({ id: Math.random().toString(36).slice(2), amount: 40, date: '2026-11-12', ...fields })

describe('รวมรายจ่ายแบบใหม่กับรายการซื้อวัตถุดิบเก่า', () => {
  it('รายการเก่าไม่หาย อ่านจาก purchases มารวมเป็นรูปเดียวกัน ใหม่สุดอยู่บน', () => {
    const purchases = [{ id: 'p1', ingredient_name: 'ปลาหมึกสด', total_amount: 400, qty: 2, unit: 'กก.', date: '2026-11-01' }]
    const expenses = [exp({ id: 'e1', name: 'น้ำแข็ง', unit: 'ถุง', qty: 2, date: '2026-11-12' })]
    const rows = mergeEntries(purchases, expenses)
    expect(rows.map((r) => r.name)).toEqual(['น้ำแข็ง', 'ปลาหมึกสด'])
    expect(rows[1]).toMatchObject({ source: 'purchases', amount: 400, qty: 2, unit: 'กก.' })
    expect(totalOf(rows)).toBe(440)
  })

  it('ค่าใช้จ่ายเก่าที่เลือกหมวดไว้ ใช้ชื่อหมวดเป็นชื่อรายการ', () => {
    expect(entryFromExpense({ id: 'x', category: 'utility_electric', amount: 900 }).name).toBe('ค่าไฟ')
    expect(entryFromExpense({ id: 'y', category: 'other', custom_label: 'ซ่อมเตา', amount: 300 }).name).toBe('ซ่อมเตา')
  })
})

describe('summarizeByName — จ่ายไปกับอะไรบ้าง', () => {
  it('ชื่อเดียวกันที่พิมพ์เว้นวรรคต่างกันนับเป็นรายการเดียว เรียงจากจ่ายมากไปน้อย', () => {
    const rows = summarizeByName([
      exp({ name: 'น้ำแข็ง', qty: 2, unit: 'ถุง' }),
      exp({ name: ' น้ำแข็ง ', qty: 3, unit: 'ถุง' }),
      exp({ name: 'ถ่าน', amount: 200 }),
    ].map(entryFromExpense))
    expect(rows.map((r) => r.name)).toEqual(['ถ่าน', 'น้ำแข็ง'])
    expect(rows[1]).toMatchObject({ total: 80, times: 2, qty: 5, unit: 'ถุง' })
  })

  it('หน่วยไม่ตรงกัน ไม่รวมจำนวน ถุงบวกกิโลไม่มีความหมาย', () => {
    const [row] = summarizeByName([
      exp({ name: 'พริก', qty: 1, unit: 'กิโล' }),
      exp({ name: 'พริก', qty: 2, unit: 'ถุง' }),
    ].map(entryFromExpense))
    expect(row.qty).toBe(0)
    expect(row.unit).toBe(null)
    expect(row.total).toBe(80)
  })
})

describe('nameSuggestions — ชื่อที่เคยจดให้กดเลือก', () => {
  const recent = [
    exp({ name: 'น้ำแข็ง', amount: 45, unit: 'ถุง', qty: 3, date: '2026-11-12' }),
    exp({ name: 'น้ำแข็ง', amount: 40, unit: 'ถุง', qty: 2, date: '2026-11-11' }),
    exp({ name: 'ขวดน้ำ', amount: 60, unit: 'แพ็ค', date: '2026-11-11' }),
    exp({ name: 'น้ำแข็ง', amount: 40, unit: 'ถุง', date: '2026-11-10' }),
    exp({ name: 'ถ่าน', amount: 120, unit: 'ถุง', date: '2026-11-09' }),
  ].map(entryFromExpense)

  it('ไม่พิมพ์อะไร เรียงตามที่จดบ่อย ราคาเป็นของครั้งล่าสุด', () => {
    const list = nameSuggestions(recent)
    expect(list[0]).toMatchObject({ name: 'น้ำแข็ง', amount: 45, qty: 3, unit: 'ถุง', times: 3 })
  })

  it('พิมพ์ไปบางส่วน กรองเหลือที่ตรง ตัวที่ขึ้นต้นตรงมาก่อน', () => {
    expect(nameSuggestions(recent, 'น้ำ').map((s) => s.name)).toEqual(['น้ำแข็ง', 'ขวดน้ำ'])
    expect(nameSuggestions(recent, 'ถ่')).toHaveLength(1)
  })
})

describe('buildExpensePayload — ตรวจก่อนบันทึก', () => {
  it('ต้องมีชื่อกับราคา จำนวนกับหน่วยไม่บังคับ', () => {
    expect(buildExpensePayload({ name: ' ', amount: '40', date: '2026-11-12' }).error).toBeTruthy()
    expect(buildExpensePayload({ name: 'น้ำแข็ง', amount: '', date: '2026-11-12' }).error).toBeTruthy()
    const { payload } = buildExpensePayload({ name: '  น้ำแข็ง  ', amount: '40', qty: '', unit: '', date: '2026-11-12' })
    expect(payload).toEqual({ name: 'น้ำแข็ง', amount: 40, qty: null, unit: null, date: '2026-11-12', note: null })
  })

  it('เก็บจำนวนกับหน่วยเมื่อกรอก', () => {
    const { payload } = buildExpensePayload({ name: 'ผักชี', amount: '30', qty: '2', unit: 'มัด', date: '2026-11-12' })
    expect(payload).toMatchObject({ qty: 2, unit: 'มัด' })
  })
})
