import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'
import { totalSteps } from './model/reveal'
import { slideToCode, validateSlideCode } from './model/validate'
import { validateFlow } from './flow/validate'
import { validateSchema } from './schema/validate'

describe('slide templates', () => {
  it('every template builds valid slides with fresh ids and at least one click or a title', () => {
    for (const t of TEMPLATES) {
      const a = t.build(), b = t.build()
      expect(a.length, t.id).toBeGreaterThan(0)
      expect(a[0].id, t.id).not.toBe(b[0].id)
      for (const s of a) {
        expect(['content', 'section', 'flow', 'schema']).toContain(s.layout)
        if (s.layout === 'content' || s.layout === 'section') expect(validateSlideCode(slideToCode(s)), t.id).toBeNull()
        if (s.layout === 'flow') expect(validateFlow(s.flow), t.id).toBeNull()
        if (s.layout === 'schema') expect(validateSchema(s.schema), t.id).toBeNull()
      }
    }
    expect(TEMPLATES.map((t) => t.id)).toContain('architecture')
  })
  it('reveal templates really have steps', () => {
    for (const id of ['architecture', 'compare', 'code', 'request', 'points', 'schema']) expect(totalSteps(TEMPLATES.find((t) => t.id === id)!.build()[0]), id).toBeGreaterThan(1)
  })
})
