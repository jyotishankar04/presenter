import { describe, expect, it } from 'vitest'
import { validateFlow } from './validate'

const node = (id: string, extra = {}) => ({ id, type: 'box', position: { x: 0, y: 0 }, data: { label: id, accent: 'blue', reveal: 0 }, ...extra })
describe('flow validation', () => {
  it('accepts a valid graph', () => expect(validateFlow({ nodes: [node('a'), node('b')], edges: [{ id: 'e', source: 'a', target: 'b' }] })).toBeNull())
  it('explains what is wrong', () => {
    expect(validateFlow(null)).toMatch(/object/)
    expect(validateFlow({ nodes: [node('a'), node('a')], edges: [] })).toMatch(/duplicate id "a"/)
    expect(validateFlow({ nodes: [node('a', { type: 'blob' })], edges: [] })).toMatch(/type must be one of/)
    expect(validateFlow({ nodes: [node('a', { position: { x: 'l', y: 0 } })], edges: [] })).toMatch(/position/)
    expect(validateFlow({ nodes: [node('a')], edges: [{ id: 'e', source: 'a', target: 'zzz' }] })).toMatch(/"target" points at "zzz"/)
    expect(validateFlow({ nodes: [{ ...node('a'), data: { label: 'a', accent: 'pink', reveal: 0 } }], edges: [] })).toMatch(/accent/)
    expect(validateFlow({ nodes: [{ ...node('a'), data: { label: 'a', accent: 'blue', reveal: -1 } }], edges: [] })).toMatch(/reveal/)
  })
})
