export interface GBox { x: number; y: number; w: number; h: number }
export interface GuideResult { dx: number; dy: number; v: number[]; h: number[] }

const xs = (b: GBox) => [b.x, b.x + b.w / 2, b.x + b.w]
const ys = (b: GBox) => [b.y, b.y + b.h / 2, b.y + b.h]

function best(mine: number[], theirs: number[], threshold: number): { delta: number; at: number[] } | null {
  let min = Infinity, delta = 0
  for (const m of mine) for (const t of theirs) { const d = t - m; if (Math.abs(d) < Math.abs(min)) { min = d; delta = d } }
  if (Math.abs(min) > threshold) return null
  const at = new Set<number>()
  for (const m of mine) for (const t of theirs) if (Math.abs(t - (m + delta)) < 0.5) at.add(t)
  return { delta, at: [...at] }
}

/**
 * Smart guides: how far to nudge `moving` so its edges/centre line up with another item's edges/centre
 * (or the slide's centre lines), within `threshold` px, plus the guide lines to draw.
 */
export function snapToGuides(moving: GBox, others: GBox[], threshold = 8, stage = { w: 1600, h: 900 }): GuideResult {
  const tx = [stage.w / 2, ...others.flatMap(xs)], ty = [stage.h / 2, ...others.flatMap(ys)]
  const bx = best(xs(moving), tx, threshold), by = best(ys(moving), ty, threshold)
  return { dx: bx?.delta ?? 0, dy: by?.delta ?? 0, v: bx?.at ?? [], h: by?.at ?? [] }
}
