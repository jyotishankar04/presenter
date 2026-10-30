import { describe, expect, it } from 'vitest'
import { slideToCode, validateSlideCode } from './validate'

const box = (id: string, extra = {}) => ({ id, type: 'box', x: 0, y: 0, w: 100, h: 50, reveal: 0, label: id, accent: 'blue', ...extra })
const slide = (elements: any[], extra = {}) => ({ layout: 'content', title: 'T', elements, ...extra })

describe('slide code validation', () => {
  it('accepts a valid slide', () => expect(validateSlideCode(slide([box('a'), box('b'), { id: 'ar', type: 'arrow', x: 0, y: 0, w: 0, h: 0, reveal: 1, from: 'a', to: 'b', accent: 'ink' }]))).toBeNull())
  it('rejects non-objects and canvas layout', () => {
    expect(validateSlideCode([])).toMatch(/JSON object/)
    expect(validateSlideCode(slide([], { layout: 'canvas' }))).toMatch(/layout/)
  })
  it('names the element and field that is wrong', () => {
    expect(validateSlideCode(slide([box('a', { x: 'left' })]))).toBe('elements[0] (box): "x" must be a number')
    expect(validateSlideCode(slide([box('a', { reveal: -1 })]))).toMatch(/reveal/)
    expect(validateSlideCode(slide([box('a', { type: 'blob' })]))).toMatch(/unknown type "blob"/)
    expect(validateSlideCode(slide([box('a'), box('a')]))).toMatch(/duplicate id "a"/)
    expect(validateSlideCode(slide([box('a', { label: 5 })]))).toMatch(/"label" must be text/)
  })
  it('rejects arrows pointing at missing boxes', () => {
    const arrow = { id: 'ar', type: 'arrow', x: 0, y: 0, w: 0, h: 0, reveal: 0, from: 'a', to: 'zzz', accent: 'ink' }
    expect(validateSlideCode(slide([box('a'), arrow]))).toMatch(/"to" points at "zzz"/)
  })
  it('slideToCode leaves out the slide id and scene', () => {
    const c = slideToCode({ id: 'x', layout: 'section', title: 'Hi', elements: [], scene: { elements: [], files: {} } })
    expect(Object.keys(c)).toEqual(['layout', 'title', 'elements'])
  })
})
