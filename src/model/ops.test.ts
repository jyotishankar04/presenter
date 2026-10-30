import { describe, expect, it } from 'vitest'
import { alignElements, cloneElements, distributeElements, idsInRect, moveSlides, range, rectFromPoints, removeElements } from './ops'
import type { El, Slide } from './types'

const box = (id: string, x: number, y: number, w = 100, h = 50): El => ({ id, type: 'box', x, y, w, h, reveal: 0, label: id, accent: 'blue' })
const arrow = (id: string, from: string, to: string): El => ({ id, type: 'arrow', x: 0, y: 0, w: 0, h: 0, reveal: 0, from, to, accent: 'ink' })

describe('selection ops', () => {
  it('marquee picks elements it touches, ignoring arrows, in any drag direction', () => {
    const els = [box('a', 0, 0), box('b', 300, 0), arrow('ar', 'a', 'b')]
    expect(idsInRect(els, rectFromPoints(90, 40, -10, -10))).toEqual(['a'])
    expect(idsInRect(els, rectFromPoints(-10, -10, 500, 100))).toEqual(['a', 'b'])
    expect(idsInRect(els, rectFromPoints(150, 0, 250, 50))).toEqual([])
  })

  it('aligns and distributes', () => {
    const els = [box('a', 0, 10), box('b', 200, 40, 60), box('c', 500, 0)]
    alignElements(els, ['a', 'b', 'c'], 'left'); expect(els.map((e) => e.x)).toEqual([0, 0, 0])
    const e2 = [box('a', 0, 0), box('b', 50, 0), box('c', 400, 0)]
    distributeElements(e2, ['a', 'b', 'c'], 'h'); expect(e2.map((e) => e.x)).toEqual([0, 150, 400].map((x, i) => (i === 1 ? 200 : x)))
    const e3 = [box('a', 0, 0), box('b', 10, 20, 100, 50)]
    alignElements(e3, ['a', 'b'], 'middle'); expect(e3[0].y + 25).toBe(e3[1].y + 25)
  })

  it('clone remaps arrows between copied boxes and drops dangling ones', () => {
    let n = 0
    const els = [box('a', 0, 0), box('b', 200, 0), box('c', 400, 0), arrow('ab', 'a', 'b'), arrow('bc', 'b', 'c')]
    const out = cloneElements(els, ['a', 'b', 'ab', 'bc'], 20, () => `n${n++}`)
    expect(out.map((e) => e.id)).toEqual(['n0', 'n1', 'n2'])
    const ar = out.find((e) => e.type === 'arrow') as Extract<El, { type: 'arrow' }>
    expect([ar.from, ar.to]).toEqual(['n0', 'n1'])
    expect(out[0].x).toBe(20)
  })

  it('removing a box removes its arrows', () => {
    const s: Slide = { id: 's', layout: 'content', elements: [box('a', 0, 0), box('b', 1, 1), arrow('x', 'a', 'b')] }
    removeElements(s, ['a'])
    expect(s.elements.map((e) => e.id)).toEqual(['b'])
  })
})

describe('slide ordering', () => {
  it('moves a block of slides before a target index', () => {
    const r = moveSlides(['a', 'b', 'c', 'd', 'e'], [1, 2], 5)
    expect(r.slides).toEqual(['a', 'd', 'e', 'b', 'c']); expect(r.newIndices).toEqual([3, 4])
    expect(moveSlides(['a', 'b', 'c', 'd'], [3], 0).slides).toEqual(['d', 'a', 'b', 'c'])
    expect(moveSlides(['a', 'b', 'c'], [0], 1).slides).toEqual(['a', 'b', 'c']) // dropping onto itself = no-op
  })
  it('range is inclusive both ways', () => { expect(range(1, 3)).toEqual([1, 2, 3]); expect(range(3, 1)).toEqual([1, 2, 3]) })
})
