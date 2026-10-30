import { toSql } from './sqlGen'
import type { Column, Dialect, Relationship, Schema, Table } from './types'

export interface ColumnChange { column: string; from: Column; to: Column; what: string[] }
export interface TableChange { table: string; addedColumns: Column[]; removedColumns: Column[]; changedColumns: ColumnChange[] }
export interface SchemaDiff {
  addedTables: Table[]
  removedTables: Table[]
  changedTables: TableChange[]
  addedRelationships: { from: string; to: string; rel: Relationship }[]
  removedRelationships: { from: string; to: string; rel: Relationship }[]
}

const key = (s: string) => s.toLowerCase()
const find = <T extends { name: string }>(list: T[], name: string) => list.find((x) => key(x.name) === key(name))

/** Names of the properties that differ between two versions of a column. */
function columnDiffs(a: Column, b: Column): string[] {
  const out: string[] = []
  if (key(a.type.replace(/\s+/g, '')) !== key(b.type.replace(/\s+/g, ''))) out.push('type')
  if (!!a.notNull !== !!b.notNull && !(a.pk && b.pk)) out.push('nullability')
  if (!!a.pk !== !!b.pk) out.push('primary key')
  if (!!a.unique !== !!b.unique) out.push('unique')
  if ((a.default ?? '') !== (b.default ?? '')) out.push('default')
  return out
}

const relLabel = (s: Schema, r: Relationship) => {
  const t = s.tables.find((x) => x.id === r.from.table), c = t?.columns.find((x) => x.id === r.from.column)
  const t2 = s.tables.find((x) => x.id === r.to.table), c2 = t2?.columns.find((x) => x.id === r.to.column)
  return { from: `${t?.name}.${c?.name}`, to: `${t2?.name}.${c2?.name}` }
}

/** What changed going from `a` to `b`. Tables and columns are matched by name (renames show up as remove + add). */
export function diffSchemas(a: Schema, b: Schema): SchemaDiff {
  const diff: SchemaDiff = { addedTables: [], removedTables: [], changedTables: [], addedRelationships: [], removedRelationships: [] }
  for (const t of b.tables) if (!find(a.tables, t.name)) diff.addedTables.push(t)
  for (const t of a.tables) {
    const nt = find(b.tables, t.name)
    if (!nt) { diff.removedTables.push(t); continue }
    const ch: TableChange = { table: nt.name, addedColumns: [], removedColumns: [], changedColumns: [] }
    for (const c of nt.columns) { const old = find(t.columns, c.name); if (!old) ch.addedColumns.push(c); else { const what = columnDiffs(old, c); if (what.length) ch.changedColumns.push({ column: c.name, from: old, to: c, what }) } }
    for (const c of t.columns) if (!find(nt.columns, c.name)) ch.removedColumns.push(c)
    if (ch.addedColumns.length || ch.removedColumns.length || ch.changedColumns.length) diff.changedTables.push(ch)
  }
  const ra = new Map(a.relationships.map((r) => { const l = relLabel(a, r); return [`${key(l.from)}>${key(l.to)}`, { ...l, rel: r }] }))
  const rb = new Map(b.relationships.map((r) => { const l = relLabel(b, r); return [`${key(l.from)}>${key(l.to)}`, { ...l, rel: r }] }))
  for (const [k, v] of rb) if (!ra.has(k)) diff.addedRelationships.push(v)
  for (const [k, v] of ra) if (!rb.has(k)) diff.removedRelationships.push(v)
  return diff
}

export const isEmptyDiff = (d: SchemaDiff) => !d.addedTables.length && !d.removedTables.length && !d.changedTables.length && !d.addedRelationships.length && !d.removedRelationships.length

/** Plain-language lines describing the diff. */
export function describeDiff(d: SchemaDiff): string[] {
  const out: string[] = []
  for (const t of d.addedTables) out.push(`+ table ${t.name}`)
  for (const t of d.removedTables) out.push(`- table ${t.name}`)
  for (const t of d.changedTables) {
    for (const c of t.addedColumns) out.push(`+ ${t.table}.${c.name} (${c.type})`)
    for (const c of t.removedColumns) out.push(`- ${t.table}.${c.name}`)
    for (const c of t.changedColumns) out.push(`~ ${t.table}.${c.column}: ${c.what.join(', ')} changed`)
  }
  for (const r of d.addedRelationships) out.push(`+ foreign key ${r.from} → ${r.to}`)
  for (const r of d.removedRelationships) out.push(`- foreign key ${r.from} → ${r.to}`)
  return out
}

const quoter = (d: Dialect) => (n: string) => (d === 'mysql' ? '`' + n + '`' : '"' + n + '"')

function colDef(c: Column, q: (n: string) => string, d: Dialect): string {
  let s = `${q(c.name)} ${c.type || 'text'}`
  if (c.notNull || c.pk) s += ' NOT NULL'
  if (c.unique && !c.pk) s += ' UNIQUE'
  if (c.default) s += ` DEFAULT ${c.default}`
  void d
  return s
}

/** SQL that turns schema `a` into schema `b` for the given dialect. Review it before running: renames become drop + add. */
export function migrationSql(a: Schema, b: Schema, dialect: Dialect = b.dialect): string {
  const d = diffSchemas(a, b)
  const q = quoter(dialect)
  const out: string[] = []
  if (d.addedTables.length) {
    const sub: Schema = { ...b, tables: d.addedTables, relationships: b.relationships.filter((r) => d.addedTables.some((t) => t.id === r.from.table) && d.addedTables.some((t) => t.id === r.to.table)) }
    out.push(toSql(sub, dialect).trim())
  }
  for (const t of d.changedTables) {
    const T = q(t.table)
    for (const c of t.addedColumns) out.push(`ALTER TABLE ${T} ADD COLUMN ${colDef(c, q, dialect)};`)
    for (const c of t.removedColumns) out.push(`ALTER TABLE ${T} DROP COLUMN ${q(c.name)};`)
    for (const ch of t.changedColumns) {
      const n = q(ch.column)
      if (dialect === 'sqlite') { out.push(`-- SQLite cannot alter ${T}.${n} (${ch.what.join(', ')}); recreate the table to change it.`); continue }
      if (dialect === 'mysql') { out.push(`ALTER TABLE ${T} MODIFY COLUMN ${colDef(ch.to, q, dialect)};`); continue }
      if (ch.what.includes('type')) out.push(`ALTER TABLE ${T} ALTER COLUMN ${n} TYPE ${ch.to.type};`)
      if (ch.what.includes('nullability')) out.push(`ALTER TABLE ${T} ALTER COLUMN ${n} ${ch.to.notNull ? 'SET' : 'DROP'} NOT NULL;`)
      if (ch.what.includes('default')) out.push(ch.to.default ? `ALTER TABLE ${T} ALTER COLUMN ${n} SET DEFAULT ${ch.to.default};` : `ALTER TABLE ${T} ALTER COLUMN ${n} DROP DEFAULT;`)
      if (ch.what.includes('unique')) out.push(ch.to.unique ? `ALTER TABLE ${T} ADD CONSTRAINT ${q(`uq_${t.table}_${ch.column}`)} UNIQUE (${n});` : `ALTER TABLE ${T} DROP CONSTRAINT ${q(`${t.table}_${ch.column}_key`)};`)
      if (ch.what.includes('primary key')) out.push(`-- primary key of ${T} changed: review constraints by hand.`)
    }
  }
  for (const r of d.addedRelationships) {
    const [ft, fc] = r.from.split('.'), [tt, tc] = r.to.split('.')
    if (dialect === 'sqlite') { out.push(`-- SQLite cannot add the foreign key ${r.from} → ${r.to} to an existing table.`); continue }
    out.push(`ALTER TABLE ${q(ft)} ADD CONSTRAINT ${q(r.rel.name ?? `fk_${ft}_${fc}`)} FOREIGN KEY (${q(fc)}) REFERENCES ${q(tt)} (${q(tc)})${r.rel.onDelete ? ' ON DELETE ' + r.rel.onDelete : ''};`)
  }
  for (const r of d.removedRelationships) {
    const [ft, fc] = r.from.split('.')
    out.push(dialect === 'sqlite' ? `-- SQLite cannot drop the foreign key ${r.from} → ${r.to}.` : dialect === 'mysql' ? `ALTER TABLE ${q(ft)} DROP FOREIGN KEY ${q(r.rel.name ?? `fk_${ft}_${fc}`)};` : `ALTER TABLE ${q(ft)} DROP CONSTRAINT ${q(r.rel.name ?? `fk_${ft}_${fc}`)};`)
  }
  for (const t of d.removedTables) out.push(`DROP TABLE ${q(t.name)};`)
  return out.length ? out.join('\n\n') + '\n' : '-- No differences.\n'
}
