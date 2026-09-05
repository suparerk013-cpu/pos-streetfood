import { beforeEach, describe, expect, it, vi } from 'vitest'

const commits = []
const store = new Map()

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }),
  getDocs: async ({ name }) => ({
    docs: (store.get(name) ?? []).map((id) => ({ id, ref: `${name}/${id}` })),
  }),
  writeBatch: () => {
    const deletes = []
    return {
      delete: (ref) => deletes.push(ref),
      commit: async () => commits.push(deletes),
    }
  },
}))

const { RESET_COLLECTIONS, clearCollection, resetAllData } = await import('../resetData')

const fill = (name, count) =>
  store.set(name, Array.from({ length: count }, (_, i) => `${name}-${i}`))

beforeEach(() => {
  commits.length = 0
  store.clear()
})

describe('ล้างข้อมูลทดสอบ', () => {
  it('ไม่แตะการตั้งค่าร้าน — ชื่อร้าน โลโก้ ค่า GP ต้องอยู่ครบ', () => {
    expect(RESET_COLLECTIONS.map((c) => c.name)).not.toContain('settings')
  })

  it('ลบบิลขายก่อนสินค้า ระหว่างลบจะได้ไม่มีบิลที่อ้างสินค้าที่หายไปแล้ว', () => {
    const names = RESET_COLLECTIONS.map((c) => c.name)
    expect(names.indexOf('orders')).toBeLessThan(names.indexOf('products'))
    expect(names.indexOf('stock_logs')).toBeLessThan(names.indexOf('products'))
    expect(names.indexOf('purchases')).toBeLessThan(names.indexOf('ingredients'))
  })

  it('collection ว่างไม่ต้องส่งคำสั่งลบเลย', async () => {
    expect(await clearCollection('orders')).toBe(0)
    expect(commits).toHaveLength(0)
  })

  it('ลบครบทุกเอกสาร', async () => {
    fill('orders', 7)
    expect(await clearCollection('orders')).toBe(7)
    expect(commits.flat()).toHaveLength(7)
  })

  it('เอกสารเยอะกว่าที่ Firestore รับต่อชุด ต้องแตกเป็นหลายชุด ไม่ใช่ชุดเดียว', async () => {
    fill('orders', 950)
    expect(await clearCollection('orders')).toBe(950)
    expect(commits).toHaveLength(3)
    commits.forEach((batch) => expect(batch.length).toBeLessThanOrEqual(500))
    expect(commits.flat()).toHaveLength(950)
  })

  it('รายงานความคืบหน้าทีละ collection และสรุปยอดรวมได้', async () => {
    fill('orders', 3)
    fill('products', 2)
    const seen = []
    const removed = await resetAllData((p) => seen.push(p))

    expect(seen).toHaveLength(RESET_COLLECTIONS.length)
    expect(seen.at(-1).done).toBe(RESET_COLLECTIONS.length)
    expect(removed.reduce((sum, r) => sum + r.count, 0)).toBe(5)
  })
})
