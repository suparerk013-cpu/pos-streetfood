import { describe, expect, it } from 'vitest'
import { matchesQuery, searchProducts } from '../productSearch'

const products = [
  { id: 'p1', name: 'ปลาหมึกย่าง (เนื้อล้วน)', category: 'ปลาหมึก', unit: 'ไม้' },
  { id: 'p2', name: 'ปลาหมึกกรอบ', category: 'ปลาหมึก', unit: 'ถุง' },
  { id: 'p3', name: 'หอยแมลงภู่นึ่ง', category: 'หอยแมลงภู่', unit: 'ถุง' },
  { id: 'p4', name: 'ลูกชิ้นปิ้ง', category: 'ลูกชิ้น', unit: 'ไม้' },
  { id: 'p5', name: 'Cola', category: 'เครื่องดื่ม', unit: 'ขวด' },
]

const ids = (rows) => rows.map((p) => p.id)

describe('ค้นหาสินค้า', () => {
  it('ไม่พิมพ์อะไรเลย เห็นทุกตัว', () => {
    expect(searchProducts(products, '')).toBe(products)
    expect(searchProducts(products, '   ')).toBe(products)
  })

  it('พิมพ์บางส่วนของชื่อก็เจอ', () => {
    expect(ids(searchProducts(products, 'หมึก'))).toEqual(['p1', 'p2'])
    expect(ids(searchProducts(products, 'ลูกชิ้น'))).toEqual(['p4'])
  })

  it('พิมพ์ชื่อหมวดเจอทั้งหมวด', () => {
    expect(ids(searchProducts(products, 'หอยแมลงภู่'))).toEqual(['p3'])
    expect(ids(searchProducts(products, 'เครื่องดื่ม'))).toEqual(['p5'])
  })

  it('พิมพ์หน่วยนับก็ค้นได้', () => {
    expect(ids(searchProducts(products, 'ขวด'))).toEqual(['p5'])
  })

  it('พิมพ์หลายคำต้องเจอครบทุกคำ แต่ไม่ต้องเรียงติดกัน', () => {
    expect(ids(searchProducts(products, 'หมึก ย่าง'))).toEqual(['p1'])
    expect(ids(searchProducts(products, 'ย่าง หมึก'))).toEqual(['p1'])
    expect(ids(searchProducts(products, 'หมึก ลูกชิ้น'))).toEqual([])
  })

  it('ช่องว่างเกินหรือเว้นหลายเคาะ ไม่ทำให้หาไม่เจอ', () => {
    expect(ids(searchProducts(products, '  หมึก   ย่าง  '))).toEqual(['p1'])
  })

  it('ตัวพิมพ์ใหญ่เล็กไม่มีผลกับชื่อภาษาอังกฤษ', () => {
    expect(ids(searchProducts(products, 'COLA'))).toEqual(['p5'])
    expect(ids(searchProducts(products, 'cola'))).toEqual(['p5'])
  })

  it('หาไม่เจอคืนลิสต์ว่าง ไม่ใช่ทุกตัว', () => {
    expect(searchProducts(products, 'กุ้งเผา')).toEqual([])
  })

  it('สินค้าที่ข้อมูลไม่ครบไม่ทำให้พัง', () => {
    expect(matchesQuery({ id: 'x' }, 'หมึก')).toBe(false)
    expect(matchesQuery({ id: 'x' }, '')).toBe(true)
    expect(matchesQuery(undefined, 'หมึก')).toBe(false)
  })
})
