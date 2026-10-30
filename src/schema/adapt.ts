import type { Edge, Node } from '@xyflow/react'
import { relReveal, tableReveal } from './reveal'
import type { Relationship, Schema, Table } from './types'

/** Which side of each table a relationship should attach to, based on where the tables sit. */
export function sides(from: Table, to: Table): { fromSide: 'l' | 'r'; toSide: 'l' | 'r' } {
  const fc = from.x + 140, tc = to.x + 140
  if (Math.abs(fc - tc) < 200) return { fromSide: 'r', toSide: 'r' }
  return fc < tc ? { fromSide: 'r', toSide: 'l' } : { fromSide: 'l', toSide: 'r' }
}

export const fkColumnSet = (s: Schema) => new Set(s.relationships.map((r) => `${r.from.table}:${r.from.column}`))

/** Schema -> React Flow nodes/edges. step = null shows everything (editing). */
export function schemaToRf(s: Schema, step: number | null): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(s.tables.map((t) => [t.id, t]))
  const nodes: Node[] = s.tables.map((t) => ({ id: t.id, type: 'table', position: { x: t.x, y: t.y }, data: { table: t, shown: step === null || tableReveal(t) <= step } }))
  const edges: Edge[] = []
  for (const r of s.relationships) {
    const f = byId.get(r.from.table), t = byId.get(r.to.table)
    if (!f || !t) continue
    const { fromSide, toSide } = sides(f, t)
    edges.push({ id: r.id, type: 'rel', source: f.id, target: t.id, sourceHandle: `${r.from.column}-${fromSide}`, targetHandle: `${r.to.column}-${toSide}`,
      data: { kind: r.kind, accent: 'ink', style: s.edgeStyle, name: r.name && !/^fk_/.test(r.name) ? r.name : undefined, shown: step === null || relReveal(r, s) <= step } })
  }
  return { nodes, edges }
}

export const schemaSignature = (s?: Schema) => (s ? s.tables.map((t) => `${t.id}@${t.x},${t.y}:${t.columns.length}`).join('|') + '#' + s.relationships.map((r) => r.id).join(',') : '')
export type { Relationship }
