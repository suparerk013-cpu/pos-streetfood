import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE, UNCATEGORIZED_COLOR, categoryColorMap, colorOfCategory } from '../categoryColors'

describe('สีประจำหมวด', () => {
  it('หมวดแรกตามลำดับในคลังได้สีแรก ลำดับเดิมได้สีเดิมเสมอ', () => {
    const products = [
      { category: 'หอย', sort_order: 2 },
      { category: 'หมึก', sort_order: 1 },
      { category: 'หมึก', sort_order: 3 },
    ]
    const map = categoryColorMap(products)
    expect(map.get('หมึก')).toBe(CATEGORY_PALETTE[0])
    expect(map.get('หอย')).toBe(CATEGORY_PALETTE[1])
    expect(categoryColorMap([...products].reverse()).get('หมึก')).toBe(CATEGORY_PALETTE[0])
  })

  it('หมวดเกินจำนวนสี วนกลับมาสีแรก', () => {
    const products = Array.from({ length: CATEGORY_PALETTE.length + 1 }, (_, i) => ({ category: `c${i}`, sort_order: i }))
    expect(categoryColorMap(products).get(`c${CATEGORY_PALETTE.length}`)).toBe(CATEGORY_PALETTE[0])
  })

  it('ไม่มีหมวด ได้สีกลาง', () => {
    expect(colorOfCategory(new Map(), undefined)).toBe(UNCATEGORIZED_COLOR)
    expect(colorOfCategory(null, 'x')).toBe(UNCATEGORIZED_COLOR)
  })
})
