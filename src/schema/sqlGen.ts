import { findColumn, findTable, type Column, type Dialect, type Relationship, type Schema, type Table } from './types'

const quoter = (d: Dialect) => (n: string) => (d === 'mysql' ? '`' + n.replace(/`/g, '``') + '`' : '"' + n.replace(/"/g, '""') + '"')
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

function typeFor(c: Column, d: Dialect): string {
  const t = c.type || 'text'
  if (c.autoIncrement) {
    if (d === 'sqlite') return 'INTEGER'
    if (d === 'postgres') return /big/i.test(t) ? 'bigserial' : /small/i.test(t) ? 'smallserial' : 'serial'
  }
  return t
}

function columnSql(t: Table, c: Column, d: Dialect, q: (n: string) => string, inlinePk: boolean): string {
  const parts = [q(c.name), typeFor(c, d)]
  if (inlinePk && c.pk) { parts.push('PRIMARY KEY'); if (c.autoIncrement && d === 'sqlite') parts.push('AUTOINCREMENT') }
  else if (c.notNull || c.pk) parts.push('NOT NULL')
  if (c.autoIncrement && d === 'mysql') parts.push('AUTO_INCREMENT')
  if (c.unique && !c.pk) parts.push('UNIQUE')
  if (c.default !== undefined && c.default !== '') parts.push('DEFAULT ' + c.default)
  if (d === 'mysql' && c.comment) parts.push('COMMENT ' + lit(c.comment))
  void t
  return parts.join(' ')
}

const refSql = (s: Schema, r: Relationship, q: (n: string) => string) => {
  const to = s.tables.find((t) => t.id === r.to.table)!, tc = to.columns.find((c) => c.id === r.to.column)!
  return `REFERENCES ${q(to.name)} (${q(tc.name)})${r.onDelete ? ' ON DELETE ' + r.onDelete : ''}${r.onUpdate ? ' ON UPDATE ' + r.onUpdate : ''}`
}

const validRel = (s: Schema, r: Relationship) => {
  const f = s.tables.find((t) => t.id === r.from.table), t = s.tables.find((x) => x.id === r.to.table)
  return !!f?.columns.some((c) => c.id === r.from.column) && !!t?.columns.some((c) => c.id === r.to.column)
}

/** CREATE TABLE statements plus foreign keys (as ALTER TABLE, or inline for SQLite which cannot add them later). */
export function toSql(s: Schema, dialect: Dialect = s.dialect): string {
  const q = quoter(dialect)
  const rels = s.relationships.filter((r) => validRel(s, r))
  const out: string[] = []
  for (const t of s.tables) {
    const pks = t.columns.filter((c) => c.pk)
    const inlinePk = pks.length === 1
    const lines = t.columns.map((c) => '  ' + columnSql(t, c, dialect, q, inlinePk && dialect === 'sqlite' && !!c.autoIncrement))
    if (pks.length && !(dialect === 'sqlite' && pks.length === 1 && pks[0].autoIncrement)) lines.push(`  PRIMARY KEY (${pks.map((c) => q(c.name)).join(', ')})`)
    if (dialect === 'sqlite') for (const r of rels.filter((r) => r.from.table === t.id)) {
      const fc = t.columns.find((c) => c.id === r.from.column)!
      lines.push(`  FOREIGN KEY (${q(fc.name)}) ${refSql(s, r, q)}`)
    }
    let stmt = `CREATE TABLE ${q(t.name)} (\n${lines.join(',\n')}\n)`
    if (dialect === 'mysql' && t.comment) stmt += ` COMMENT=${lit(t.comment)}`
    out.push(stmt + ';')
  }
  if (dialect !== 'sqlite') {
    for (const r of rels) {
      const f = s.tables.find((t) => t.id === r.from.table)!, fc = f.columns.find((c) => c.id === r.from.column)!
      const name = r.name ?? `fk_${f.name}_${fc.name}`
      out.push(`ALTER TABLE ${q(f.name)} ADD CONSTRAINT ${q(name)} FOREIGN KEY (${q(fc.name)}) ${refSql(s, r, q)};`)
    }
  }
  for (const t of s.tables) {
    for (const ix of t.indexes ?? []) {
      const cols = ix.columns.map((id) => t.columns.find((c) => c.id === id)?.name).filter(Boolean) as string[]
      if (cols.length) out.push(`CREATE ${ix.unique ? 'UNIQUE ' : ''}INDEX ${q(ix.name)} ON ${q(t.name)} (${cols.map((c) => q(c)).join(', ')});`)
    }
  }
  if (dialect === 'postgres' || dialect === 'generic') {
    for (const t of s.tables) {
      if (t.comment) out.push(`COMMENT ON TABLE ${q(t.name)} IS ${lit(t.comment)};`)
      for (const c of t.columns) if (c.comment) out.push(`COMMENT ON COLUMN ${q(t.name)}.${q(c.name)} IS ${lit(c.comment)};`)
    }
  }
  return out.join('\n\n') + (out.length ? '\n' : '')
}

const mermaidType = (t: string) => (t || 'text').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'text'
const mermaidName = (n: string) => n.replace(/[^A-Za-z0-9_]+/g, '_') || 'T'

/** Mermaid erDiagram source. */
export function toMermaid(s: Schema): string {
  const fk = new Set(s.relationships.map((r) => `${r.from.table}:${r.from.column}`))
  const lines = ['erDiagram']
  for (const t of s.tables) {
    lines.push(`  ${mermaidName(t.name)} {`)
    for (const c of t.columns) {
      const keys = [c.pk ? 'PK' : '', fk.has(`${t.id}:${c.id}`) ? 'FK' : '', c.unique && !c.pk ? 'UK' : ''].filter(Boolean).join(', ')
      lines.push(`    ${mermaidType(c.type)} ${mermaidName(c.name)}${keys ? ' ' + keys : ''}${c.comment ? ` "${c.comment.replace(/"/g, "'")}"` : ''}`)
    }
    lines.push('  }')
  }
  for (const r of s.relationships.filter((r) => validRel(s, r))) {
    const f = s.tables.find((t) => t.id === r.from.table)!, to = s.tables.find((t) => t.id === r.to.table)!
    const fc = f.columns.find((c) => c.id === r.from.column)!
    const sym = r.kind === '1:1' ? '||--||' : r.kind === '1:N' ? '||--o{' : '}o--||'
    lines.push(`  ${mermaidName(f.name)} ${sym} ${mermaidName(to.name)} : "${fc.name}"`)
  }
  return lines.join('\n') + '\n'
}

/** DBML (dbdiagram.io / ChartDB compatible) source. */
export function toDbml(s: Schema): string {
  const out: string[] = []
  for (const t of s.tables) {
    const rows = t.columns.map((c) => {
      const attrs = [c.pk ? 'pk' : '', c.autoIncrement ? 'increment' : '', c.notNull && !c.pk ? 'not null' : '', c.unique && !c.pk ? 'unique' : '', c.default ? `default: ${c.default.startsWith("'") || /^[\w.()+-]+$/.test(c.default) ? (c.default.startsWith("'") ? c.default : /^-?\d/.test(c.default) ? c.default : '`' + c.default + '`') : '`' + c.default + '`'}` : '', c.comment ? `note: ${lit(c.comment)}` : ''].filter(Boolean)
      return `  "${c.name}" ${c.type || 'text'}${attrs.length ? ` [${attrs.join(', ')}]` : ''}`
    })
    out.push(`Table "${t.name}" {\n${rows.join('\n')}${t.comment ? `\n\n  Note: ${lit(t.comment)}` : ''}\n}`)
  }
  for (const r of s.relationships.filter((r) => validRel(s, r))) {
    const f = s.tables.find((t) => t.id === r.from.table)!, to = s.tables.find((t) => t.id === r.to.table)!
    const fc = f.columns.find((c) => c.id === r.from.column)!, tc = to.columns.find((c) => c.id === r.to.column)!
    const sym = r.kind === '1:1' ? '-' : r.kind === '1:N' ? '<' : '>'
    out.push(`Ref: "${f.name}"."${fc.name}" ${sym} "${to.name}"."${tc.name}"`)
  }
  return out.join('\n\n') + '\n'
}

export { findColumn, findTable }
