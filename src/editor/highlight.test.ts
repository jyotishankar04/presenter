import { describe, expect, it } from 'vitest'
import { errorPosition, tokenizeJson } from './highlight'

describe('json highlighting', () => {
  it('classifies keys, strings, numbers, literals and punctuation', () => {
    const t = tokenizeJson('{ "a": "x", "n": -1.5e2, "ok": true, "z": null }').filter((k) => k.kind !== 'plain')
    expect(t.map((k) => k.kind)).toEqual(['punct', 'key', 'punct', 'string', 'punct', 'key', 'punct', 'number', 'punct', 'key', 'punct', 'literal', 'punct', 'key', 'punct', 'literal', 'punct'])
  })
  it('round-trips any input exactly, including broken JSON', () => {
    for (const s of ['{ "layout": "content", ', '', '[1,2,\n  {"a": "unterminated', 'not json at all ::: 123 "x']) expect(tokenizeJson(s).map((t) => t.text).join('')).toBe(s)
  })
  it('handles escaped quotes inside strings', () => {
    const t = tokenizeJson('"say \\"hi\\""')
    expect(t).toHaveLength(1); expect(t[0].kind).toBe('string')
  })
  it('reads the error position out of a JSON.parse message', () => {
    expect(errorPosition('Expected double-quoted property name in JSON at position 23 (line 1 column 24)')).toBe(23)
    expect(errorPosition('elements[0] (box): "x" must be a number')).toBeNull()
  })
})
