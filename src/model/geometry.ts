export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** Point where the ray from the rect's centre towards `target` leaves the rect. */
export function edgePoint(r: Rect, target: Pt): Pt {
  const c = center(r)
  const dx = target.x - c.x
  const dy = target.y - c.y
  if (dx === 0 && dy === 0) return c
  const sx = dx === 0 ? Infinity : r.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : r.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

/** Start/end points for an arrow between two rects, with a small gap. */
export function connect(a: Rect, b: Rect, gap = 4): { from: Pt; to: Pt } {
  const from = edgePoint(a, center(b))
  const to = edgePoint(b, center(a))
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return {
    from: { x: from.x + (dx / len) * gap, y: from.y + (dy / len) * gap },
    to: { x: to.x - (dx / len) * gap, y: to.y - (dy / len) * gap },
  }
}

export const snap = (v: number, grid = 10) => Math.round(v / grid) * grid
