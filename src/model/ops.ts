import type { El, Slide } from './types'

export interface Box { x: number; y: number; w: number; h: number }

export const rectsIntersect = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Rect from two drag corners, in any direction. */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Box {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

/** Ids of movable (non-arrow) elements touched by the marquee. */
export function idsInRect(els: El[], rect: Box): string[] {
  return els.filter((e) => e.type !== 'arrow' && rectsIntersect(rect, e)).map((e) => e.id)
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

export function alignElements(els: El[], ids: string[], how: Align): void {
  const t = els.filter((e) => ids.includes(e.id) && e.type !== 'arrow')
  if (t.length < 2) return
  const minX = Math.min(...t.map((e) => e.x)), maxX = Math.max(...t.map((e) => e.x + e.w))
  const minY = Math.min(...t.map((e) => e.y)), maxY = Math.max(...t.map((e) => e.y + e.h))
  for (const e of t) {
    if (how === 'left') e.x = minX
    else if (how === 'right') e.x = maxX - e.w
    else if (how === 'center') e.x = (minX + maxX) / 2 - e.w / 2
    else if (how === 'top') e.y = minY
    else if (how === 'bottom') e.y = maxY - e.h
    else e.y = (minY + maxY) / 2 - e.h / 2
  }
}

/** Even gaps between elements along an axis (needs 3+). */
export function distributeElements(els: El[], ids: string[], axis: 'h' | 'v'): void {
  const t = els.filter((e) => ids.includes(e.id) && e.type !== 'arrow')
  if (t.length < 3) return
  const pos = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'h'
  t.sort((a, b) => a[pos] - b[pos])
  const total = t[t.length - 1][pos] + t[t.length - 1][size] - t[0][pos]
  const gap = (total - t.reduce((s, e) => s + e[size], 0)) / (t.length - 1)
  let cursor = t[0][pos]
  for (const e of t) { e[pos] = cursor; cursor += e[size] + gap }
}

/** Copy elements with fresh ids; arrows between copied boxes are re-pointed, others dropped. */
export function cloneElements(els: El[], ids: string[], offset: number, newId: () => string): El[] {
  const picked = els.filter((e) => ids.includes(e.id))
  const map = new Map(picked.map((e) => [e.id, newId()]))
  const out: El[] = []
  for (const e of picked) {
    const c = structuredClone(e)
    c.id = map.get(e.id)!
    if (c.type === 'arrow') {
      if (!map.has(c.from) || !map.has(c.to)) continue
      c.from = map.get(c.from)!; c.to = map.get(c.to)!
    } else { c.x += offset; c.y += offset }
    out.push(c)
  }
  return out
}

/** Remove elements and any arrows attached to them. */
export function removeElements(slide: Slide, ids: string[]): void {
  const gone = new Set(ids)
  slide.elements = slide.elements.filter((e) => !gone.has(e.id) && !(e.type === 'arrow' && (gone.has(e.from) || gone.has(e.to))))
}

/** Move the slides at `indices` so they sit together before original index `before` (0..n). */
export function moveSlides<T>(slides: T[], indices: number[], before: number): { slides: T[]; newIndices: number[] } {
  const set = new Set(indices)
  const moving = slides.filter((_, i) => set.has(i))
  const rest = slides.filter((_, i) => !set.has(i))
  const insertAt = before - indices.filter((i) => i < before).length
  const out = [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
  return { slides: out, newIndices: moving.map((_, k) => insertAt + k) }
}

/** Contiguous range between two indices, inclusive (shift-click). */
export const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i)
