import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearList,
  listTotal,
  loadList,
  newItem,
  priceChange,
  readyItems,
  saveList,
  unitPriceOf,
} from '../shoppingList'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}

beforeEach(() => store.clear())

describe('เก็บรายการไว้ในเครื่อง', () => {
  it('บันทึกแล้วอ่านกลับมาได้ครบ', () => {
    saveList([newItem({ name: 'พริก', unit: 'กก.' })])
    expect(loadList()).toHaveLength(1)
    expect(loadList()[0].name).toBe('พริก')
  })

  it('ยังไม่เคยบันทึก คืนรายการว่าง ไม่พัง', () => {
    expect(loadList()).toEqual([])
  })

  it('ข้อมูลในเครื่องเสีย ไม่ทำให้แอปพัง', () => {
    store.set('pos-shopping-list-v1', 'ไม่ใช่ JSON')
    expect(loadList()).toEqual([])
  })

  it('เก็บของที่ไม่ใช่อาร์เรย์ไว้ ก็ยังคืนอาร์เรย์ว่าง', () => {
    store.set('pos-shopping-list-v1', '{"a":1}')
    expect(loadList()).toEqual([])
  })

  it('ล้างรายการแล้วหายจริง', () => {
    saveList([newItem({ name: 'พริก' })])
    clearList()
    expect(loadList()).toEqual([])
  })
})

describe('แถวที่พร้อมบันทึกเข้าคลัง', () => {
  const bought = (fields) => ({ ...newItem({ name: 'พริก', unit: 'กก.' }), bought: true, ...fields })

  it('ต้องติ๊กว่าซื้อแล้ว และมีทั้งจำนวนกับเงิน', () => {
    const items = [
      bought({ qty: '1', amount: '180' }),
      bought({ qty: '1', amount: '' }),
      bought({ qty: '', amount: '50' }),
      { ...newItem({ name: 'ยังไม่ซื้อ' }), qty: '1', amount: '20' },
    ]
    expect(readyItems(items)).toHaveLength(1)
  })

  it('ยอดรวมนับเฉพาะแถวที่พร้อม', () => {
    expect(listTotal([bought({ qty: '1', amount: '180' }), bought({ qty: '2', amount: '150' })])).toBe(330)
  })

  it('จำนวนเป็นศูนย์ไม่หารเป็นอนันต์', () => {
    expect(unitPriceOf({ qty: '0', amount: '100' })).toBe(0)
  })
})

describe('เทียบราคากับครั้งก่อน', () => {
  it('บอกว่าแพงขึ้นกี่เปอร์เซ็นต์', () => {
    const change = priceChange({ qty: '1', amount: '180', lastPrice: 150 })
    expect(change.now).toBe(180)
    expect(Math.round(change.percent)).toBe(20)
    expect(change.suspicious).toBe(false)
  })

  it('ต่างเกินเท่าตัวถือว่าน่าจะพิมพ์ผิด', () => {
    const change = priceChange({ qty: '1', amount: '1500', lastPrice: 150 })
    expect(change.suspicious).toBe(true)
  })

  it('ยังไม่เคยซื้อมาก่อน ไม่มีอะไรให้เทียบ', () => {
    expect(priceChange({ qty: '1', amount: '180', lastPrice: 0 })).toBe(null)
  })
})
