import { newColumn, newTable, sid, TABLE_W, type Column, type RelKind, type Schema, type Table } from './types'

/** "users" -> "users_2" -> "users_3" when the name is taken (case-insensitive). */
export function uniqueName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  let i = 2
  while (taken.has(`${base}_${i}`.toLowerCase())) i++
  return `${base}_${i}`
}

const clone = <T,>(v: T): T => structuredClone(v)

export function addTable(s: Schema, at?: { x: number; y: number }, name = 'new_table'): { schema: Schema; id: string } {
  const out = clone(s)
  const t = newTable(uniqueName(name, out.tables.map((x) => x.name)), at?.x ?? 0, at?.y ?? 0)
  out.tables.push(t)
  return { schema: out, id: t.id }
}

export function removeTable(s: Schema, id: string): Schema {
  const out = clone(s)
  out.tables = out.tables.filter((t) => t.id !== id)
  out.relationships = out.relationships.filter((r) => r.from.table !== id && r.to.table !== id)
  return out
}

export function duplicateTable(s: Schema, id: string, offset = 40): { schema: Schema; id: string } | null {
  const src = s.tables.find((t) => t.id === id)
  if (!src) return null
  const out = clone(s)
  const copy: Table = { ...clone(src), id: sid(), name: uniqueName(src.name + '_copy', out.tables.map((t) => t.name)), x: src.x + offset, y: src.y + offset, columns: src.columns.map((c) => ({ ...clone(c), id: sid() })) }
  out.tables.push(copy)
  return { schema: out, id: copy.id }
}

export function addColumn(s: Schema, tableId: string, partial: Partial<Column> = {}): { schema: Schema; id: string } | null {
  const out = clone(s)
  const t = out.tables.find((x) => x.id === tableId)
  if (!t) return null
  const col = { ...newColumn(uniqueName(partial.name ?? 'column', t.columns.map((c) => c.name)), partial.type ?? 'text'), ...partial }
  col.name = uniqueName(partial.name ?? 'column', t.columns.map((c) => c.name))
  t.columns.push(col)
  return { schema: out, id: col.id }
}

export function removeColumn(s: Schema, tableId: string, colId: string): Schema {
  const out = clone(s)
  const t = out.tables.find((x) => x.id === tableId)
  if (t) {
    t.columns = t.columns.filter((c) => c.id !== colId)
    if (t.indexes) { t.indexes = t.indexes.map((i) => ({ ...i, columns: i.columns.filter((c) => c !== colId) })).filter((i) => i.columns.length); if (!t.indexes.length) delete t.indexes }
  }
  out.relationships = out.relationships.filter((r) => !((r.from.table === tableId && r.from.column === colId) || (r.to.table === tableId && r.to.column === colId)))
  return out
}

export function moveColumn(s: Schema, tableId: string, colId: string, dir: -1 | 1): Schema {
  const out = clone(s)
  const t = out.tables.find((x) => x.id === tableId)
  if (!t) return out
  const i = t.columns.findIndex((c) => c.id === colId), j = i + dir
  if (i < 0 || j < 0 || j >= t.columns.length) return out
  ;[t.columns[i], t.columns[j]] = [t.columns[j], t.columns[i]]
  return out
}

export function relKindFor(from: Column, to: Column): RelKind {
  return from.pk || from.unique ? (to.pk || to.unique ? '1:1' : '1:N') : 'N:1'
}

/**
 * Draws a foreign key between two columns. If you dragged from the key side to the referencing side the ends are swapped,
 * so the foreign key always sits on the "from" end. Returns null for an identical column or an existing link.
 */
export function connectColumns(s: Schema, a: { table: string; column: string }, b: { table: string; column: string }): { schema: Schema; id: string } | null {
  const ta = s.tables.find((t) => t.id === a.table), tb = s.tables.find((t) => t.id === b.table)
  const ca = ta?.columns.find((c) => c.id === a.column), cb = tb?.columns.find((c) => c.id === b.column)
  if (!ta || !tb || !ca || !cb || (a.table === b.table && a.column === b.column)) return null
  let from = a, to = b, fc = ca, tc = cb
  if (ca.pk && !cb.pk) { from = b; to = a; fc = cb; tc = ca }
  if (s.relationships.some((r) => r.from.table === from.table && r.from.column === from.column && r.to.table === to.table && r.to.column === to.column)) return null
  const out = clone(s)
  const id = sid()
  out.relationships.push({ id, from: { ...from }, to: { ...to }, kind: relKindFor(fc, tc) === '1:N' ? 'N:1' : relKindFor(fc, tc) })
  return { schema: out, id }
}

/** Merge SQL-imported tables into a schema: skips tables whose names already exist, keeps positions of new ones in a free column to the right. */
export function mergeImported(s: Schema, imported: Pick<Schema, 'tables' | 'relationships'>): { schema: Schema; added: number; skipped: string[] } {
  const out = clone(s)
  const have = new Set(out.tables.map((t) => t.name.toLowerCase()))
  const skipped: string[] = []
  const keep = new Set<string>()
  let x = out.tables.length ? Math.max(...out.tables.map((t) => t.x + TABLE_W)) + 120 : 0
  for (const t of imported.tables) {
    if (have.has(t.name.toLowerCase())) { skipped.push(t.name); continue }
    keep.add(t.id); out.tables.push({ ...clone(t), x: t.x + x, y: t.y }); have.add(t.name.toLowerCase())
  }
  for (const r of imported.relationships) if (keep.has(r.from.table) && keep.has(r.to.table)) out.relationships.push(clone(r))
  return { schema: out, added: keep.size, skipped }
}

/** Where a free spot for a new table is: starts at the wanted point and slides right/down until nothing overlaps. */
export function freeSpot(s: Schema, want: { x: number; y: number }, h = 200): { x: number; y: number } {
  const hits = (x: number, y: number) => s.tables.some((t) => x < t.x + TABLE_W + 30 && x + TABLE_W + 30 > t.x && y < t.y + 44 + t.columns.length * 30 + 38 && y + h > t.y)
  let { x, y } = { x: Math.round(want.x / 10) * 10, y: Math.round(want.y / 10) * 10 }
  for (let i = 0; i < 60 && hits(x, y); i++) { if (i % 8 === 7) { x -= 7 * (TABLE_W + 40); y += 260 } else x += TABLE_W + 40 }
  return { x, y }
}
