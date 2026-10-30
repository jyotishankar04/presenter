import type { Accent, BoxEl, ArrowEl, El } from './types'

export interface DiagramNode { id: string; label: string; icon?: string; accent?: Accent; muted?: boolean }
export interface DiagramEdge { from: string; to: string }
export type RevealMode = 'level' | 'node' | 'none'

const LEVEL_ACCENTS: Accent[] = ['amber', 'blue', 'green', 'ink', 'red']
const AREA = { x: 60, y: 200, w: 1480, h: 640 }
const MIN_GAP = 80 // room for an arrow between columns

/** Rough width a box needs for its label (icon + padding included). */
const labelWidth = (n: DiagramNode) => n.label.length * 14 + (n.icon ? 70 : 44)

/** Column index per node: longest path from a source, tolerant of cycles and unknown ids. */
export function levels(nodes: DiagramNode[], edges: DiagramEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id))
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
  const lvl = new Map(nodes.map((n) => [n.id, 0]))
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false
    for (const e of valid) {
      const want = lvl.get(e.from)! + 1
      if (want > lvl.get(e.to)! && want < nodes.length) { lvl.set(e.to, want); changed = true }
    }
    if (!changed) break
  }
  return lvl
}

/**
 * Lays a node/edge graph out left-to-right as boxes and arrows with reveal steps.
 * reveal: 'level' = each column appears on its own click, 'node' = one click per box, 'none' = all visible.
 */
export function layoutDiagram(nodes: DiagramNode[], edges: DiagramEdge[], reveal: RevealMode = 'level'): El[] {
  const lvl = levels(nodes, edges)
  const cols = new Map<number, DiagramNode[]>()
  for (const n of nodes) cols.set(lvl.get(n.id)!, [...(cols.get(lvl.get(n.id)!) ?? []), n])
  const colIdx = [...cols.keys()].sort((a, b) => a - b)
  const L = colIdx.length
  const widest = Math.max(...nodes.map(labelWidth))
  const fits = L > 1 ? (AREA.w - MIN_GAP * (L - 1)) / L : 400
  const bw = Math.round(Math.max(200, Math.min(widest, 400, fits)))
  const stepX = L > 1 ? Math.min(bw + 190, (AREA.w - bw) / (L - 1)) : 0
  const totalW = bw + stepX * (colIdx.length - 1)
  const x0 = AREA.x + (AREA.w - totalW) / 2

  const out: BoxEl[] = []
  let nodeClick = 0
  colIdx.forEach((c, ci) => {
    const col = cols.get(c)!
    const gap = col.length > 6 ? 10 : 36
    const bh = Math.max(24, Math.min(96, (AREA.h - gap * (col.length - 1)) / col.length))
    const colH = bh * col.length + gap * (col.length - 1)
    const y0 = AREA.y + (AREA.h - colH) / 2
    col.forEach((n, ri) => {
      nodeClick++
      out.push({
        id: n.id, type: 'box', label: n.label, icon: n.icon, muted: n.muted,
        accent: n.accent ?? LEVEL_ACCENTS[ci % LEVEL_ACCENTS.length],
        x: Math.round(x0 + stepX * ci), y: Math.round(y0 + ri * (bh + gap)), w: bw, h: Math.round(bh),
        reveal: reveal === 'none' ? 0 : reveal === 'level' ? ci + 1 : nodeClick,
      })
    })
  })

  const byId = new Map(out.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const arrows: ArrowEl[] = []
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to)
    const key = `${e.from}>${e.to}`
    if (!a || !b || a === b || seen.has(key)) continue
    seen.add(key)
    arrows.push({ id: `e-${e.from}-${e.to}`, type: 'arrow', x: 0, y: 0, w: 0, h: 0, from: e.from, to: e.to, accent: 'ink', reveal: Math.max(a.reveal, b.reveal) })
  }
  return [...out, ...arrows]
}
