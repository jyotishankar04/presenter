import { describe, expect, it } from 'vitest'
import { elementsAtStep, sceneSteps, setReveal, withBoundText } from './reveal'

const el = (id: string, reveal?: number, extra = {}) => ({ id, version: 1, versionNonce: 1, isDeleted: false, customData: reveal === undefined ? undefined : { reveal }, ...extra })

describe('canvas reveal', () => {
  const els = [el('a'), el('b', 1), el('c', 2), el('d', 3, { isDeleted: true })]
  it('counts steps ignoring deleted elements', () => expect(sceneSteps({ elements: els, files: {} })).toBe(2))
  it('filters by step', () => {
    expect(elementsAtStep(els, 0).map((e) => e.id)).toEqual(['a'])
    expect(elementsAtStep(els, 2).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
  it('bound labels follow their container', () => {
    const list = [el('box', 0, { boundElements: [{ id: 'lbl', type: 'text' }] }), el('lbl', 0, { containerId: 'box' }), el('other')]
    expect([...withBoundText(list, ['box'])].sort()).toEqual(['box', 'lbl'])
    const out = setReveal(list, new Set(['box']), 3)
    expect(out.map((e) => (e as any).customData?.reveal)).toEqual([3, 3, undefined])
    expect(out[0].version).toBe(2)
  })

  it('arrows wait for both connected shapes', () => {
    const list = [el('a', 0), el('b', 2), { ...el('arr', 0), type: 'arrow', startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } }]
    expect(elementsAtStep(list, 1).map((e) => e.id)).toEqual(['a'])
    expect(elementsAtStep(list, 2).map((e) => e.id)).toEqual(['a', 'b', 'arr'])
  })
})
