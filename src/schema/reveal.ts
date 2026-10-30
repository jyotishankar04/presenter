import type { Relationship, Schema, Table } from './types'

export const tableReveal = (t: Table) => t.reveal ?? 0
export const schemaSteps = (s?: Schema) => (s ? s.tables.reduce((m, t) => Math.max(m, tableReveal(t)), 0) : 0)

/** A relationship appears once both of its tables are visible. */
export function relReveal(r: Relationship, s: Schema): number {
  const a = s.tables.find((t) => t.id === r.from.table), b = s.tables.find((t) => t.id === r.to.table)
  return Math.max(a ? tableReveal(a) : 0, b ? tableReveal(b) : 0)
}
