import { describe, expect, it } from 'vitest'
import { focusedLines, next, parseLines, prev, totalSteps, visibleElements } from './reveal'
import type { Slide, El } from './types'

const box = (id: string, reveal: number): El => ({
  id, type: 'box', x: 0, y: 0, w: 10, h: 10, reveal, label: id, accent: 'amber',
})
const slide = (id: string, els: El[]): Slide => ({ id, layout: 'content', elements: els })

describe('reveal', () => {
  const a = slide('a', [box('1', 0), box('2', 1), box('3', 2)])
  const b = slide('b', [box('4', 0)])
  const list: El = {
    id: 'l', type: 'cardList', x: 0, y: 0, w: 1, h: 1, reveal: 0, header: 'h', accent: 'ink',
    cards: [{ text: 'x', reveal: 1 }, { text: 'y', reveal: 4 }],
  }

  it('counts total steps including nested cards', () => {
    expect(totalSteps(a)).toBe(2)
    expect(totalSteps(slide('c', [list]))).toBe(4)
    expect(totalSteps(slide('e', []))).toBe(0)
  })

  it('shows elements up to the current step', () => {
    expect(visibleElements(a, 0).map((e) => e.id)).toEqual(['1'])
    expect(visibleElements(a, 1).map((e) => e.id)).toEqual(['1', '2'])
  })

  it('steps forward then to next slide, and stops at the end', () => {
    const s = [a, b]
    expect(next(s, { slide: 0, step: 0 })).toEqual({ slide: 0, step: 1 })
    expect(next(s, { slide: 0, step: 2 })).toEqual({ slide: 1, step: 0 })
    expect(next(s, { slide: 1, step: 0 })).toEqual({ slide: 1, step: 0 })
  })

  it('steps back, landing on the previous slide fully revealed', () => {
    const s = [a, b]
    expect(prev(s, { slide: 0, step: 1 })).toEqual({ slide: 0, step: 0 })
    expect(prev(s, { slide: 1, step: 0 })).toEqual({ slide: 0, step: 2 })
    expect(prev(s, { slide: 0, step: 0 })).toEqual({ slide: 0, step: 0 })
  })

  it('parses line specs and picks the latest focus', () => {
    expect([...parseLines('1-3, 6')]).toEqual([1, 2, 3, 6])
    const f = [{ lines: '1', reveal: 1 }, { lines: '2-3', reveal: 3 }]
    expect(focusedLines(f, 0)).toBeNull()
    expect([...focusedLines(f, 2)!]).toEqual([1])
    expect([...focusedLines(f, 3)!]).toEqual([2, 3])
  })
})
