import type { El, Slide } from './types'
import { sceneSteps } from '../canvas/reveal'
import { flowSteps } from '../flow/reveal'
import { schemaSteps } from '../schema/reveal'

/** Reveal steps contributed by one element (cards / messages carry their own). */
export function elementSteps(el: El): number[] {
  const steps = [el.reveal]
  if (el.type === 'cardList') steps.push(...el.cards.map((c) => c.reveal))
  if (el.type === 'sequence') steps.push(...el.messages.map((m) => m.reveal))
  if (el.type === 'code') steps.push(...el.focus.map((f) => f.reveal))
  return steps
}

/** Number of clicks needed to show everything on the slide. */
export function totalSteps(slide: Slide): number {
  if (slide.layout === 'canvas') return sceneSteps(slide.scene)
  if (slide.layout === 'flow') return flowSteps(slide.flow)
  if (slide.layout === 'schema') return schemaSteps(slide.schema)
  let max = 0
  for (const el of slide.elements) for (const s of elementSteps(el)) max = Math.max(max, s)
  return max
}

export function isVisible(reveal: number, step: number): boolean {
  return reveal <= step
}

export function visibleElements(slide: Slide, step: number): El[] {
  return slide.elements.filter((el) => isVisible(el.reveal, step))
}

export interface Position {
  slide: number
  step: number
}

/** Advance one click; moves to the next slide once all steps are shown. */
export function next(slides: Slide[], pos: Position): Position {
  const total = totalSteps(slides[pos.slide])
  if (pos.step < total) return { slide: pos.slide, step: pos.step + 1 }
  if (pos.slide < slides.length - 1) return { slide: pos.slide + 1, step: 0 }
  return pos
}

/** Go back one click; moves to the previous slide fully revealed. */
export function prev(slides: Slide[], pos: Position): Position {
  if (pos.step > 0) return { slide: pos.slide, step: pos.step - 1 }
  if (pos.slide > 0) {
    const s = pos.slide - 1
    return { slide: s, step: totalSteps(slides[s]) }
  }
  return pos
}

/** Parse "1-3,6" into a set of 1-based line numbers. */
export function parseLines(spec: string): Set<number> {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i)
  }
  return out
}

/** Lines in focus at `step` (latest focus whose reveal <= step), or null for no focus. */
export function focusedLines(focus: { lines: string; reveal: number }[], step: number): Set<number> | null {
  let active: { lines: string; reveal: number } | null = null
  for (const f of focus) if (f.reveal <= step && (!active || f.reveal >= active.reveal)) active = f
  return active ? parseLines(active.lines) : null
}
