import { describe, expect, it } from 'vitest'
import { OUTLINE_SAMPLE, outlineToSlides, parseOutline } from './outline'
import { totalSteps } from './model/reveal'
import { validateSlideCode, slideToCode } from './model/validate'

describe('outline to slides', () => {
  it('parses titles, sections and bullets', () => {
    const b = parseOutline('# Intro\n> Part 1\nWhy\n  - a\n  - b\n      - nested\n')
    expect(b.map((x) => [x.title, x.section, x.bullets.length])).toEqual([['Intro', true, 1], ['Why', false, 3]])
    expect(b[1].bullets.map((x) => x.depth)).toEqual([0, 0, 1])
  })
  it('makes a section slide with an eyebrow and content slides with one click per top-level bullet', () => {
    const s = outlineToSlides(OUTLINE_SAMPLE)
    expect(s.map((x) => x.layout)).toEqual(['section', 'content', 'content'])
    expect(s[0]).toMatchObject({ title: 'What is system design?', eyebrow: 'Part 1' })
    expect(s[1].elements).toHaveLength(3); expect(totalSteps(s[1])).toBe(3)
    expect(s[2].elements).toHaveLength(3)
    expect((s[2].elements[1] as { text: string }).text).toContain('under 100 ms')   // nested bullet stays on its parent's click
    for (const sl of s.slice(1)) expect(validateSlideCode(slideToCode(sl))).toBeNull()
  })
  it('can show everything at once, and survives odd input', () => {
    expect(totalSteps(outlineToSlides('A\n - x\n - y', { stepByStep: false })[0])).toBe(0)
    expect(outlineToSlides('')).toEqual([]); expect(outlineToSlides('   \n\n')).toEqual([])
    expect(outlineToSlides('- orphan bullet')[0].title).toBe('orphan bullet')
  })
  it('keeps long lists on the page', () => {
    const els = outlineToSlides('Big\n' + Array.from({ length: 9 }, (_, i) => `  - item ${i}`).join('\n'))[0].elements
    expect(Math.max(...els.map((e) => e.y + e.h))).toBeLessThanOrEqual(900)
  })
})
