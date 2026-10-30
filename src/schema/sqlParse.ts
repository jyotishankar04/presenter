import { newColumn, newTable, sid, type Column, type TableIndex, type RefAction, type RelKind, type Relationship, type Schema, type Table } from './types'

export interface ParseResult { schema: Pick<Schema, 'tables' | 'relationships'>; warnings: string[] }

/** Removes -- and slash-star comments (outside string literals). */
function stripComments(sql: string): string {
  let out = '', i = 0
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1]
    if (c === "'" || c === '"' || c === '`') { const q = c; out += c; i++; while (i < sql.length && sql[i] !== q) { out += sql[i]; if (sql[i] === '\\') { out += sql[i + 1] ?? ''; i++ } i++ } out += sql[i] ?? ''; i++; continue }
    if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue }
    if (c === '/' && n === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue }
    out += c; i++
  }
  return out
}

/** Split on a separator that is outside quotes and parentheses. */
function splitTop(s: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = '', q: string | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { cur += c; if (c === q) q = null; continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

const unq = (s: string) => s.trim().replace(/^["`[]|["`\]]$/g, '').replace(/^"|"$/g, '')
const lastName = (s: string) => unq(s.split('.').map((p) => p.trim()).filter(Boolean).pop() ?? '')
const identList = (s: string) => splitTop(s, ',').map((p) => unq(p.replace(/\s+(ASC|DESC)$/i, '')))

const CONSTRAINT_START = /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|KEY|INDEX|FULLTEXT|SPATIAL|EXCLUDE|PERIOD)\b/i
const COLUMN_KEYWORDS = /^(NOT|NULL|DEFAULT|PRIMARY|REFERENCES|UNIQUE|CHECK|COLLATE|GENERATED|AUTO_INCREMENT|AUTOINCREMENT|COMMENT|CONSTRAINT|ON|IDENTITY|AS|CHARACTER\s+SET|CHARSET|STORED|VIRTUAL)\b/i
const ACTIONS = ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION']

/** Reads one token (identifier / word / parenthesised group / string) from the start of s. */
function readTokenAt(s: string): { tok: string; rest: string } {
  const t = s.trimStart()
  if (!t) return { tok: '', rest: '' }
  const c = t[0]
  if (c === '"' || c === '`' || c === "'") { const e = t.indexOf(c, 1); const end = e < 0 ? t.length : e + 1; return { tok: t.slice(0, end), rest: t.slice(end) } }
  if (c === '[') { const e = t.indexOf(']'); const end = e < 0 ? t.length : e + 1; return { tok: t.slice(0, end), rest: t.slice(end) } }
  if (c === '(') { let d = 0, i = 0; for (; i < t.length; i++) { if (t[i] === '(') d++; if (t[i] === ')') { d--; if (d === 0) { i++; break } } } return { tok: t.slice(0, i), rest: t.slice(i) } }
  const m = t.match(/^[^\s(),]+/)
  return { tok: m ? m[0] : c, rest: t.slice(m ? m[0].length : 1) }
}

const action = (s: string | undefined): RefAction | undefined => (s ? (ACTIONS.find((a) => a === s.toUpperCase().replace(/\s+/g, ' ')) as RefAction | undefined) : undefined)

interface PendingFk { table: string; cols: string[]; refTable: string; refCols: string[]; onDelete?: RefAction; onUpdate?: RefAction; name?: string }

function parseReferences(s: string): { refTable: string; refCols: string[]; onDelete?: RefAction; onUpdate?: RefAction } | null {
  const m = s.match(/REFERENCES\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+))*)\s*(\(([^)]*)\))?/i)
  if (!m) return null
  const del = s.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i)?.[1]
  const upd = s.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i)?.[1]
  return { refTable: lastName(m[1]), refCols: m[3] ? identList(m[3]) : [], onDelete: action(del), onUpdate: action(upd) }
}

function parseColumn(def: string, tableName: string, fks: PendingFk[]): Column | null {
  const first = readTokenAt(def)
  if (!first.tok) return null
  const col = newColumn(unq(first.tok), '')
  let rest = first.rest.trim()
  // type: words (and one parenthesised group each) until a constraint keyword
  const typeParts: string[] = []
  while (rest && !COLUMN_KEYWORDS.test(rest)) {
    const { tok, rest: r } = readTokenAt(rest)
    if (!tok) break
    typeParts.push(tok); rest = r.trim()
  }
  col.type = typeParts.join(' ').replace(/\s+\(/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s*,\s*/g, ',') || 'text'
  const up = rest
  if (/\bNOT\s+NULL\b/i.test(up)) col.notNull = true
  if (/\bPRIMARY\s+KEY\b/i.test(up)) { col.pk = true; col.notNull = true }
  if (/\bUNIQUE\b/i.test(up)) col.unique = true
  if (/\b(AUTO_INCREMENT|AUTOINCREMENT)\b/i.test(up)) col.autoIncrement = true
  const d = up.match(/\bDEFAULT\s+((?:'(?:[^']|'')*'|"[^"]*"|\([^)]*(?:\([^)]*\)[^)]*)*\)|[^\s,]+(?:\([^)]*\))?)(?:\s*::\s*[\w\s]+)?)/i)
  if (d) col.default = d[1].trim()
  const cm = up.match(/\bCOMMENT\s+'((?:[^']|'')*)'/i)
  if (cm) col.comment = cm[1].replace(/''/g, "'")
  const ref = parseReferences(up)
  if (ref) fks.push({ table: tableName, cols: [col.name], refTable: ref.refTable, refCols: ref.refCols, onDelete: ref.onDelete, onUpdate: ref.onUpdate })
  return col
}

function addIndex(table: Table, name: string, colNames: string[], unique: boolean) {
  const ids = colNames.map((n) => table.columns.find((c) => c.name === n)?.id).filter((x): x is string => !!x)
  if (!ids.length || ids.length !== colNames.length) return
  const idx: TableIndex = { id: sid(), name, columns: ids, ...(unique ? { unique: true } : {}) }
  table.indexes = [...(table.indexes ?? []), idx]
}

function applyTableConstraint(item: string, table: Table, fks: PendingFk[]) {
  let s = item.replace(/^CONSTRAINT\s+(?:"[^"]+"|`[^`]+`|[\w$]+)\s+/i, '')
  const cname = item.match(/^CONSTRAINT\s+("[^"]+"|`[^`]+`|[\w$]+)/i)?.[1]
  const colsOf = (txt: string) => identList(txt)
  let m: RegExpMatchArray | null
  if ((m = s.match(/^PRIMARY\s+KEY\s*(?:\w+\s*)?\(([^)]*)\)/i))) {
    for (const n of colsOf(m[1])) { const c = table.columns.find((x) => x.name === n); if (c) { c.pk = true; c.notNull = true } }
  } else if ((m = s.match(/^FOREIGN\s+KEY\s*(?:[\w"`]+\s*)?\(([^)]*)\)\s*(REFERENCES[\s\S]*)$/i))) {
    const ref = parseReferences(m[2])
    if (ref) fks.push({ table: table.name, cols: colsOf(m[1]), refTable: ref.refTable, refCols: ref.refCols, onDelete: ref.onDelete, onUpdate: ref.onUpdate, name: cname ? unq(cname) : undefined })
  } else if ((m = s.match(/^UNIQUE\s*(?:KEY|INDEX)?\s*([\w"`]+)?\s*\(([^)]*)\)/i))) {
    const cols = colsOf(m[2])
    if (cols.length === 1) { const c = table.columns.find((x) => x.name === cols[0]); if (c) c.unique = true }
    else addIndex(table, m[1] ? unq(m[1]) : `uq_${table.name}_${cols.join('_')}`, cols, true)
  } else if ((m = s.match(/^(?:KEY|INDEX)\s*([\w"`]+)?\s*\(([^)]*)\)/i))) {
    addIndex(table, m[1] ? unq(m[1]) : `idx_${table.name}_${colsOf(m[2]).join('_')}`, colsOf(m[2]), false)
  }
}

/**
 * Reads CREATE TABLE / ALTER TABLE ... ADD FOREIGN KEY / COMMENT ON statements into tables and relationships.
 * Understands PostgreSQL, MySQL and SQLite flavours. Anything it does not understand becomes a warning, never an error.
 */
export function parseSql(input: string): ParseResult {
  const warnings: string[] = []
  const tables: Table[] = []
  const fks: PendingFk[] = []
  const comments: { table: string; column?: string; text: string }[] = []
  const statements = splitTop(stripComments(input), ';')

  for (const stmt of statements) {
    let m: RegExpMatchArray | null
    if ((m = stmt.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+|LOCAL\s+)?(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+))*)\s*\(/i))) {
      const name = lastName(m[1])
      const open = stmt.indexOf('(', m[0].length - 1)
      let depth = 0, close = -1
      for (let i = open; i < stmt.length; i++) { if (stmt[i] === '(') depth++; if (stmt[i] === ')') { depth--; if (depth === 0) { close = i; break } } }
      if (close < 0) { warnings.push(`Table "${name}": unbalanced parentheses`); continue }
      const table = newTable(name)
      table.columns = []
      const items = splitTop(stmt.slice(open + 1, close), ',')
      const constraints: string[] = []
      for (const item of items) {
        if (CONSTRAINT_START.test(item)) { constraints.push(item); continue }
        const col = parseColumn(item, name, fks)
        if (col) table.columns.push(col); else warnings.push(`Table "${name}": could not read "${item.slice(0, 40)}"`)
      }
      for (const c of constraints) applyTableConstraint(c, table, fks)
      const tc = stmt.slice(close + 1).match(/COMMENT\s*=?\s*'((?:[^']|'')*)'/i)
      if (tc) table.comment = tc[1].replace(/''/g, "'")
      tables.push(table)
    } else if ((m = stmt.match(/^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|[\w$]+))*)\s+ADD\s+([\s\S]*)$/i))) {
      const name = lastName(m[1])
      const holder = tables.find((t) => t.name === name) ?? newTable(name)
      const before = fks.length
      applyTableConstraint(m[2].replace(/^COLUMN\s+/i, ''), holder, fks)
      if (!tables.includes(holder)) { if (fks.length === before) warnings.push(`ALTER TABLE ${name}: table not defined above`); }
    } else if ((m = stmt.match(/^COMMENT\s+ON\s+(TABLE|COLUMN)\s+([\w."`$]+)\s+IS\s+'((?:[^']|'')*)'/i))) {
      const parts = m[2].split('.').map(unq)
      if (m[1].toUpperCase() === 'TABLE') comments.push({ table: parts[parts.length - 1], text: m[3].replace(/''/g, "'") })
      else comments.push({ table: parts[parts.length - 2], column: parts[parts.length - 1], text: m[3].replace(/''/g, "'") })
    } else if ((m = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|[\w$]+)\s+ON\s+(?:ONLY\s+)?((?:"[^"]+"|`[^`]+`|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|[\w$]+))*)\s*(?:USING\s+\w+\s*)?\(([^)]*)\)/i))) {
      const t = tables.find((x) => x.name === lastName(m![3])); const cols = identList(m[4])
      if (t && cols.length === 1 && m[1]) { const c = t.columns.find((x) => x.name === cols[0]); if (c) c.unique = true }
      else if (t) addIndex(t, unq(m[2]), cols, !!m[1])
    } else if (/^(CREATE\s+(?:EXTENSION|TYPE|SEQUENCE|SCHEMA|VIEW|OR\s+REPLACE\s+VIEW)|SET|USE|BEGIN|COMMIT|DROP|INSERT|GRANT|ALTER\s+SEQUENCE|PRAGMA|START\s+TRANSACTION)\b/i.test(stmt)) {
      // irrelevant to the diagram
    } else warnings.push(`Skipped: ${stmt.replace(/\s+/g, ' ').slice(0, 60)}…`)
  }

  for (const c of comments) {
    const t = tables.find((x) => x.name === c.table); if (!t) continue
    if (c.column) { const col = t.columns.find((x) => x.name === c.column); if (col) col.comment = c.text } else t.comment = c.text
  }

  const relationships: Relationship[] = []
  for (const fk of fks) {
    const from = tables.find((t) => t.name === fk.table), to = tables.find((t) => t.name === fk.refTable)
    if (!from || !to) { warnings.push(`Foreign key ${fk.table} → ${fk.refTable}: table not found`); continue }
    const refCols = fk.refCols.length ? fk.refCols : to.columns.filter((c) => c.pk).map((c) => c.name)
    fk.cols.forEach((cn, i) => {
      const fc = from.columns.find((c) => c.name === cn), tc = to.columns.find((c) => c.name === (refCols[i] ?? refCols[0]))
      if (!fc || !tc) { warnings.push(`Foreign key ${fk.table}.${cn} → ${fk.refTable}: column not found`); return }
      const single = from.columns.filter((c) => c.pk).length === 1 && fc.pk
      const kind: RelKind = fc.unique || single ? '1:1' : 'N:1'
      relationships.push({ id: sid(), from: { table: from.id, column: fc.id }, to: { table: to.id, column: tc.id }, kind, ...(fk.name ? { name: fk.name } : {}), ...(fk.onDelete ? { onDelete: fk.onDelete } : {}), ...(fk.onUpdate ? { onUpdate: fk.onUpdate } : {}) })
    })
  }
  if (!tables.length) warnings.unshift('No CREATE TABLE statements found')
  return { schema: { tables, relationships }, warnings }
}
