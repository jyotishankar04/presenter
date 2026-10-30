import type { Column, Schema, Table } from './types'

const pascal = (s: string) => s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ?? '').toUpperCase()).replace(/^./, (c) => c.toUpperCase()) || 'Model'
const camel = (s: string) => { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1) }
const singular = (s: string) => s.replace(/ies$/i, 'y').replace(/(sses|xes|ches|shes)$/i, (m) => m.slice(0, -2)).replace(/s$/i, '')
const baseType = (t: string) => t.toLowerCase().replace(/\(.*\)/, '').replace(/\s+/g, ' ').trim()
const args = (t: string) => (t.match(/\(([^)]*)\)/)?.[1] ?? '').split(',').map((x) => x.trim()).filter(Boolean)

// ---------------------------------------------------------------- Prisma

function prismaType(c: Column): { type: string; attrs: string[]; auto: boolean } {
  const b = baseType(c.type), a = args(c.type)
  const attrs: string[] = []
  switch (b) {
    case 'uuid': return { type: 'String', attrs: ['@db.Uuid'], auto: false }
    case 'varchar': case 'character varying': case 'char': case 'character': return { type: 'String', attrs: a[0] ? [`@db.${b.startsWith('char') && !b.includes('var') ? 'Char' : 'VarChar'}(${a[0]})`] : [], auto: false }
    case 'serial': case 'smallserial': return { type: 'Int', attrs, auto: true }
    case 'bigserial': return { type: 'BigInt', attrs, auto: true }
    case 'int': case 'integer': case 'int4': case 'smallint': case 'tinyint': case 'mediumint': return { type: 'Int', attrs, auto: !!c.autoIncrement }
    case 'bigint': case 'int8': return { type: 'BigInt', attrs, auto: !!c.autoIncrement }
    case 'boolean': case 'bool': return { type: 'Boolean', attrs, auto: false }
    case 'numeric': case 'decimal': return { type: 'Decimal', attrs: a.length ? [`@db.Decimal(${a.join(', ')})`] : [], auto: false }
    case 'real': case 'float': case 'float4': case 'float8': case 'double': case 'double precision': return { type: 'Float', attrs, auto: false }
    case 'timestamptz': case 'timestamp with time zone': return { type: 'DateTime', attrs: ['@db.Timestamptz(6)'], auto: false }
    case 'timestamp': case 'datetime': case 'timestamp without time zone': return { type: 'DateTime', attrs, auto: false }
    case 'date': return { type: 'DateTime', attrs: ['@db.Date'], auto: false }
    case 'json': case 'jsonb': return { type: 'Json', attrs, auto: false }
    case 'bytea': case 'blob': case 'binary': case 'varbinary': return { type: 'Bytes', attrs, auto: false }
    default: return { type: 'String', attrs, auto: false }
  }
}

function prismaDefault(c: Column, auto: boolean): string | null {
  if (auto) return '@default(autoincrement())'
  const d = (c.default ?? '').trim()
  if (!d) return null
  if (/^(now\(\)|current_timestamp(\(\))?)$/i.test(d)) return '@default(now())'
  if (/^(gen_random_uuid\(\)|uuid_generate_v4\(\)|uuid\(\))$/i.test(d)) return '@default(uuid())'
  if (/^'.*'$/.test(d)) return `@default(${JSON.stringify(d.slice(1, -1).replace(/''/g, "'"))})`
  if (/^-?\d+(\.\d+)?$/.test(d) || /^(true|false)$/i.test(d)) return `@default(${d.toLowerCase()})`
  return `@default(dbgenerated(${JSON.stringify(d)}))`
}

/** Prisma schema.prisma text (PostgreSQL / MySQL / SQLite). Foreign keys become relation fields on both sides. */
export function toPrisma(s: Schema): string {
  const provider = s.dialect === 'mysql' ? 'mysql' : s.dialect === 'sqlite' ? 'sqlite' : 'postgresql'
  const model = new Map(s.tables.map((t) => [t.id, pascal(singular(t.name))]))
  // relation fields to add, per table id
  const extra = new Map<string, string[]>()
  const push = (tid: string, line: string) => extra.set(tid, [...(extra.get(tid) ?? []), line])
  const used = new Map<string, Set<string>>(s.tables.map((t) => [t.id, new Set(t.columns.map((c) => camel(c.name)))]))
  const unique = (tid: string, base: string) => { const set = used.get(tid)!; let n = base, i = 2; while (set.has(n)) n = `${base}${i++}`; set.add(n); return n }
  const multi = new Map<string, number>()
  for (const r of s.relationships) multi.set(`${r.from.table}>${r.to.table}`, (multi.get(`${r.from.table}>${r.to.table}`) ?? 0) + 1)

  for (const r of s.relationships) {
    const from = s.tables.find((t) => t.id === r.from.table), to = s.tables.find((t) => t.id === r.to.table)
    const fc = from?.columns.find((c) => c.id === r.from.column), tc = to?.columns.find((c) => c.id === r.to.column)
    if (!from || !to || !fc || !tc) continue
    const dup = (multi.get(`${from.id}>${to.id}`) ?? 0) > 1
    const relName = dup ? `${pascal(from.name)}_${camel(fc.name)}` : undefined
    const fwd = unique(from.id, camel(singular(to.name)))
    const back = unique(to.id, r.kind === '1:1' ? camel(singular(from.name)) : camel(from.name))
    const opt = fc.notNull || fc.pk ? '' : '?'
    const onDel = r.onDelete ? `, onDelete: ${({ CASCADE: 'Cascade', 'SET NULL': 'SetNull', RESTRICT: 'Restrict', 'NO ACTION': 'NoAction', 'SET DEFAULT': 'SetDefault' } as const)[r.onDelete]}` : ''
    const rel = `@relation(${relName ? JSON.stringify(relName) + ', ' : ''}fields: [${camel(fc.name)}], references: [${camel(tc.name)}]${onDel})`
    push(from.id, `  ${fwd} ${model.get(to.id)}${opt} ${rel}`)
    push(to.id, r.kind === '1:1' ? `  ${back} ${model.get(from.id)}?${relName ? ` @relation(${JSON.stringify(relName)})` : ''}` : `  ${back} ${model.get(from.id)}[]${relName ? ` @relation(${JSON.stringify(relName)})` : ''}`)
  }

  const out = [`generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`]
  for (const t of s.tables) out.push(prismaModel(t, model.get(t.id)!, extra.get(t.id) ?? []))
  return out.join('\n\n') + '\n'
}

function prismaModel(t: Table, name: string, rels: string[]): string {
  const pks = t.columns.filter((c) => c.pk)
  const lines = t.columns.map((c) => {
    const { type, attrs, auto } = prismaType(c)
    const parts = [`  ${camel(c.name)} ${type}${c.notNull || c.pk ? '' : '?'}`]
    if (pks.length === 1 && c.pk) parts.push('@id')
    const def = prismaDefault(c, auto && (c.pk || !!c.autoIncrement || /serial/i.test(c.type))); if (def) parts.push(def)
    if (c.unique && !c.pk) parts.push('@unique')
    parts.push(...attrs)
    if (camel(c.name) !== c.name) parts.push(`@map(${JSON.stringify(c.name)})`)
    return parts.join(' ')
  })
  const tail: string[] = []
  if (pks.length > 1) tail.push(`  @@id([${pks.map((c) => camel(c.name)).join(', ')}])`)
  for (const ix of t.indexes ?? []) {
    const cols = ix.columns.map((id) => t.columns.find((c) => c.id === id)).filter(Boolean).map((c) => camel(c!.name))
    if (cols.length) tail.push(`  ${ix.unique ? '@@unique' : '@@index'}([${cols.join(', ')}])`)
  }
  if (name.toLowerCase() !== t.name.toLowerCase() || name !== t.name) tail.push(`  @@map(${JSON.stringify(t.name)})`)
  return `model ${name} {\n${[...lines, ...rels].join('\n')}${tail.length ? '\n\n' + tail.join('\n') : ''}\n}`
}

// ---------------------------------------------------------------- Drizzle (PostgreSQL)

function drizzleCol(c: Column): { fn: string; code: string } {
  const b = baseType(c.type), a = args(c.type), n = JSON.stringify(c.name)
  const withLen = (fn: string) => ({ fn, code: a[0] ? `${fn}(${n}, { length: ${a[0]} })` : `${fn}(${n})` })
  switch (b) {
    case 'uuid': return { fn: 'uuid', code: `uuid(${n})` }
    case 'text': case 'longtext': case 'mediumtext': return { fn: 'text', code: `text(${n})` }
    case 'varchar': case 'character varying': return withLen('varchar')
    case 'char': case 'character': return withLen('char')
    case 'serial': return { fn: 'serial', code: `serial(${n})` }
    case 'smallserial': return { fn: 'smallserial', code: `smallserial(${n})` }
    case 'bigserial': return { fn: 'bigserial', code: `bigserial(${n}, { mode: 'number' })` }
    case 'int': case 'integer': case 'int4': return { fn: 'integer', code: `integer(${n})` }
    case 'smallint': case 'tinyint': return { fn: 'smallint', code: `smallint(${n})` }
    case 'bigint': case 'int8': return { fn: 'bigint', code: `bigint(${n}, { mode: 'number' })` }
    case 'boolean': case 'bool': return { fn: 'boolean', code: `boolean(${n})` }
    case 'numeric': case 'decimal': return { fn: 'numeric', code: a.length ? `numeric(${n}, { precision: ${a[0]}${a[1] ? `, scale: ${a[1]}` : ''} })` : `numeric(${n})` }
    case 'real': case 'float4': case 'float': return { fn: 'real', code: `real(${n})` }
    case 'double': case 'double precision': case 'float8': return { fn: 'doublePrecision', code: `doublePrecision(${n})` }
    case 'timestamptz': case 'timestamp with time zone': return { fn: 'timestamp', code: `timestamp(${n}, { withTimezone: true })` }
    case 'timestamp': case 'datetime': case 'timestamp without time zone': return { fn: 'timestamp', code: `timestamp(${n})` }
    case 'date': return { fn: 'date', code: `date(${n})` }
    case 'json': return { fn: 'json', code: `json(${n})` }
    case 'jsonb': return { fn: 'jsonb', code: `jsonb(${n})` }
    default: return { fn: 'text', code: `text(${n})` }
  }
}

const drizzleDefault = (c: Column): string => {
  const d = (c.default ?? '').trim()
  if (!d) return ''
  if (/^(now\(\)|current_timestamp(\(\))?)$/i.test(d)) return '.defaultNow()'
  if (/^(gen_random_uuid\(\)|uuid_generate_v4\(\))$/i.test(d)) return '.defaultRandom()'
  if (/^'.*'$/.test(d)) return `.default(${JSON.stringify(d.slice(1, -1).replace(/''/g, "'"))})`
  if (/^-?\d+(\.\d+)?$/.test(d)) return `.default(${/numeric|decimal/i.test(c.type) ? JSON.stringify(d) : d})`
  if (/^(true|false)$/i.test(d)) return `.default(${d.toLowerCase()})`
  return `.default(sql\`${d.replace(/`/g, '\\`')}\`)`
}

/** Drizzle ORM table definitions for PostgreSQL (drizzle-orm/pg-core). */
export function toDrizzle(s: Schema): string {
  const ident = new Map(s.tables.map((t) => [t.id, camel(t.name)]))
  const fns = new Set<string>(['pgTable']); let needSql = false
  const body = s.tables.map((t) => {
    const pks = t.columns.filter((c) => c.pk)
    const rows = t.columns.map((c) => {
      const { fn, code } = drizzleCol(c); fns.add(fn)
      let line = code
      if (pks.length === 1 && c.pk) line += '.primaryKey()'
      else if (c.notNull || c.pk) line += '.notNull()'
      if (c.unique && !c.pk) line += '.unique()'
      const d = drizzleDefault(c); if (d) { line += d; if (d.includes('sql`')) needSql = true }
      const rel = s.relationships.find((r) => r.from.table === t.id && r.from.column === c.id)
      if (rel) {
        const target = s.tables.find((x) => x.id === rel.to.table), tc = target?.columns.find((x) => x.id === rel.to.column)
        if (target && tc) line += `.references(() => ${ident.get(target.id)}.${camel(tc.name)}${rel.onDelete ? `, { onDelete: '${rel.onDelete.toLowerCase()}' }` : ''})`
      }
      return `  ${camel(c.name)}: ${line},`
    })
    let extra = ''
    const ix: string[] = []
    if (pks.length > 1) { fns.add('primaryKey'); ix.push(`  pk: primaryKey({ columns: [${pks.map((c) => `table.${camel(c.name)}`).join(', ')}] }),`) }
    for (const i of t.indexes ?? []) {
      const cols = i.columns.map((id) => t.columns.find((c) => c.id === id)).filter(Boolean).map((c) => `table.${camel(c!.name)}`)
      if (cols.length) { const f = i.unique ? 'uniqueIndex' : 'index'; fns.add(f); ix.push(`  ${camel(i.name)}: ${f}(${JSON.stringify(i.name)}).on(${cols.join(', ')}),`) }
    }
    if (ix.length) extra = `, (table) => ({\n${ix.join('\n')}\n})`
    return `export const ${ident.get(t.id)} = pgTable(${JSON.stringify(t.name)}, {\n${rows.join('\n')}\n}${extra})`
  })
  const head = `import { ${[...fns].sort().join(', ')} } from 'drizzle-orm/pg-core'${needSql ? "\nimport { sql } from 'drizzle-orm'" : ''}`
  return `${head}\n\n${body.join('\n\n')}\n`
}
