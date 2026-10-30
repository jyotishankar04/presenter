import dagre from '@dagrejs/dagre'
import { TABLE_W, tableHeight, type Schema } from './types'

/** Arranges tables with dagre: parents (referenced tables) first, children after, related tables close. Returns a new schema. */
export function layoutSchema(s: Schema, dir: 'LR' | 'TB' = 'LR'): Schema {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: dir, nodesep: 60, ranksep: 130, edgesep: 40, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(s.tables.map((t) => t.id))
  for (const t of s.tables) g.setNode(t.id, { width: TABLE_W, height: tableHeight(t) })
  for (const r of s.relationships) if (ids.has(r.from.table) && ids.has(r.to.table) && r.from.table !== r.to.table) g.setEdge(r.to.table, r.from.table) // referenced (parent) tables first
  dagre.layout(g)
  return { ...s, tables: s.tables.map((t) => { const n = g.node(t.id); return { ...t, x: Math.round(n.x - TABLE_W / 2), y: Math.round(n.y - tableHeight(t) / 2) } }) }
}
