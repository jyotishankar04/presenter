import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Slide } from '../src/model/types'
import { layoutSchema } from '../src/schema/layout'
import { addTable as addTableOp, connectColumns, mergeImported, removeColumn, removeTable, uniqueName, freeSpot } from '../src/schema/ops'
import { parseSql } from '../src/schema/sqlParse'
import { toDbml, toMermaid, toSql } from '../src/schema/sqlGen'
import { DIALECTS, emptySchema, findColumn, findTable, newColumn, sid, type Column, type Dialect, type Schema, type Table } from '../src/schema/types'
import { validateSchema } from '../src/schema/validate'
import { deleteSchema, listSchemas, readDeck, readSchema, safeId, schemaExists, writeDeck, writeSchema } from '../server/store'
import { guarded, RO, rid, slugify, ToolError, WEB, WR } from './common'

const DIALECT_VALUES = DIALECTS.map((d) => d.value) as [Dialect, ...Dialect[]]
const ACCENTS = ['blue', 'green', 'amber', 'red', 'ink', 'muted'] as const
const schemaRef = z.string().describe('Schema id, as returned by list_schemas')
const tableRef = z.string().describe('Table name (case-insensitive) or id')
const urls = (id: string) => ({ edit: `${WEB}/schema/${id}` })

const columnInput = z.object({
  name: z.string(), type: z.string().default('text').describe('SQL type as you would write it, e.g. uuid, varchar(255), numeric(10,2), timestamptz'),
  pk: z.boolean().optional(), notNull: z.boolean().optional(), unique: z.boolean().optional(), autoIncrement: z.boolean().optional(),
  default: z.string().optional().describe('SQL default expression, e.g. now(), 0, \'active\''), comment: z.string().optional(),
})

async function load(id: string): Promise<Schema> { return readSchema(id) }

function check(s: Schema) {
  const problem = validateSchema(s)
  if (problem) throw new ToolError(`Not saved. ${problem}`)
}

async function save(s: Schema) {
  check(s)
  await writeSchema(s)
  return { ok: true, schema: s.id, tables: s.tables.length, relationships: s.relationships.length, ...urls(s.id) }
}

function table(s: Schema, ref: string): Table {
  const t = findTable(s, ref)
  if (!t) throw new ToolError(`No table "${ref}" in "${s.id}". Tables: ${s.tables.map((x) => x.name).join(', ') || '(none)'}`)
  return t
}
function column(t: Table, ref: string): Column {
  const c = findColumn(t, ref)
  if (!c) throw new ToolError(`No column "${ref}" in table "${t.name}". Columns: ${t.columns.map((x) => x.name).join(', ') || '(none)'}`)
  return c
}

const toColumn = (c: z.infer<typeof columnInput>): Column => ({
  id: sid(), name: c.name, type: c.type || 'text',
  ...(c.pk ? { pk: true, notNull: true } : {}), ...(c.notNull && !c.pk ? { notNull: true } : {}), ...(c.unique ? { unique: true } : {}),
  ...(c.autoIncrement ? { autoIncrement: true } : {}), ...(c.default !== undefined ? { default: c.default } : {}), ...(c.comment ? { comment: c.comment } : {}),
})

/** Compact, readable description of a schema for agents. */
function outline(s: Schema) {
  const name = (tid: string) => s.tables.find((t) => t.id === tid)?.name
  const col = (tid: string, cid: string) => s.tables.find((t) => t.id === tid)?.columns.find((c) => c.id === cid)?.name
  return {
    id: s.id, name: s.name, dialect: s.dialect, ...urls(s.id),
    tables: s.tables.map((t) => ({
      name: t.name, ...(t.comment ? { comment: t.comment } : {}),
      columns: t.columns.map((c) => `${c.name} ${c.type}${c.pk ? ' PK' : ''}${c.notNull && !c.pk ? ' NOT NULL' : ''}${c.unique && !c.pk ? ' UNIQUE' : ''}${c.autoIncrement ? ' AUTO_INCREMENT' : ''}${c.default ? ` DEFAULT ${c.default}` : ''}`),
    })),
    relationships: s.relationships.map((r) => `${name(r.from.table)}.${col(r.from.table, r.from.column)} -> ${name(r.to.table)}.${col(r.to.table, r.to.column)} (${r.kind}${r.onDelete ? ', ON DELETE ' + r.onDelete : ''})`),
  }
}

export function registerSchemaTools(server: McpServer) {
  server.registerTool('list_schemas', { title: 'List database schemas', description: 'List saved database schemas (ER designs): id, name, dialect, table and relationship counts.', inputSchema: {}, annotations: RO },
    guarded(async () => ({ schemas: await listSchemas() })))

  server.registerTool('get_schema', { title: 'Get database schema', description: 'Outline of a schema: tables with columns (types, keys, defaults) and relationships, plus the editor URL.', inputSchema: { schema: schemaRef }, annotations: RO },
    guarded(async ({ schema }) => outline(await load(schema))))

  server.registerTool('export_schema', { title: 'Export schema as SQL / Mermaid / DBML', description: 'Generate DDL for PostgreSQL, MySQL or SQLite, a Mermaid erDiagram, DBML, or the raw JSON.',
    inputSchema: { schema: schemaRef, format: z.enum(['postgres', 'mysql', 'sqlite', 'mermaid', 'dbml', 'json']).default('postgres') }, annotations: RO },
    guarded(async ({ schema, format }) => {
      const s = await load(schema)
      return format === 'mermaid' ? toMermaid(s) : format === 'dbml' ? toDbml(s) : format === 'json' ? JSON.stringify(s, null, 2) : toSql(s, format)
    }))

  server.registerTool('create_schema', { title: 'Create database schema', description: 'Create a schema, empty or from SQL (CREATE TABLE / ALTER TABLE ... FOREIGN KEY, PostgreSQL / MySQL / SQLite flavours). Tables from SQL are laid out automatically. Returns warnings for any statement it could not read.',
    inputSchema: { name: z.string().min(1), dialect: z.enum(DIALECT_VALUES).default('postgres'), sql: z.string().optional().describe('Optional SQL DDL to import'), id: z.string().optional() }, annotations: WR },
    guarded(async ({ name, dialect, sql, id }) => {
      let sid0 = id ?? slugify(name, 'schema')
      if (!safeId(sid0)) throw new ToolError(`"${sid0}" is not a valid id (letters, numbers, - and _)`)
      if (await schemaExists(sid0)) { if (id) throw new ToolError(`A schema with id "${sid0}" already exists`); sid0 += '-' + rid().slice(0, 3) }
      let s = emptySchema(sid0, name, dialect)
      let warnings: string[] = []
      if (sql) {
        const r = parseSql(sql); warnings = r.warnings
        if (!r.schema.tables.length) throw new ToolError(`No tables found in the SQL. ${warnings.join(' ')}`)
        s = layoutSchema({ ...s, ...r.schema })
      }
      return { ...(await save(s)), ...(warnings.length ? { warnings } : {}) }
    }))

  server.registerTool('import_sql', { title: 'Import SQL into a schema', description: 'Parse SQL DDL and add its tables (mode "add": existing table names are skipped) or replace the whole schema (mode "replace").',
    inputSchema: { schema: schemaRef, sql: z.string(), mode: z.enum(['add', 'replace']).default('add') }, annotations: WR },
    guarded(async ({ schema, sql, mode }) => {
      const s = await load(schema); const r = parseSql(sql)
      if (!r.schema.tables.length) throw new ToolError(`No tables found in the SQL. ${r.warnings.join(' ')}`)
      const laid = layoutSchema({ ...s, ...r.schema })
      let out: Schema, extra: Record<string, unknown> = {}
      if (mode === 'replace') out = { ...s, tables: laid.tables, relationships: laid.relationships }
      else { const m = mergeImported(s, { tables: laid.tables, relationships: laid.relationships }); out = m.schema; extra = { added: m.added, skipped: m.skipped } }
      return { ...(await save(out)), ...extra, ...(r.warnings.length ? { warnings: r.warnings } : {}) }
    }))

  server.registerTool('update_schema', { title: 'Update schema name / dialect', description: 'Rename a schema or change its SQL dialect.', inputSchema: { schema: schemaRef, name: z.string().optional(), dialect: z.enum(DIALECT_VALUES).optional() }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ schema, name, dialect }) => { const s = await load(schema); if (name) s.name = name; if (dialect) s.dialect = dialect; return save(s) }))

  server.registerTool('delete_schema', { title: 'Delete schema', description: 'Permanently delete a schema file. Requires confirm: true. Ask the user first.', inputSchema: { schema: schemaRef, confirm: z.literal(true) }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ schema }) => { await load(schema); await deleteSchema(schema); return { ok: true, deleted: schema } }))

  server.registerTool('add_table', { title: 'Add table', description: 'Add a table with its columns. Without columns it gets an "id uuid PRIMARY KEY". The table is placed in free space; call layout_schema to tidy everything.',
    inputSchema: { schema: schemaRef, name: z.string().min(1), columns: z.array(columnInput).optional(), comment: z.string().optional(), color: z.enum(ACCENTS).optional() }, annotations: WR },
    guarded(async ({ schema, name, columns, comment, color }) => {
      const s = await load(schema)
      if (findTable(s, name)) throw new ToolError(`A table named "${name}" already exists`)
      const base = addTableOp(s, freeSpot(s, { x: 0, y: 0 }), name)
      const t = base.schema.tables.find((x) => x.id === base.id)!
      if (columns?.length) {
        const seen = new Set<string>()
        t.columns = columns.map((c) => { if (seen.has(c.name.toLowerCase())) throw new ToolError(`Duplicate column "${c.name}"`); seen.add(c.name.toLowerCase()); return toColumn(c) })
      }
      if (comment) t.comment = comment
      if (color) t.color = color
      return { ...(await save(base.schema)), table: t.name }
    }))

  server.registerTool('update_table', { title: 'Update table', description: 'Rename a table, change its comment or colour.', inputSchema: { schema: schemaRef, table: tableRef, name: z.string().optional(), comment: z.string().optional(), color: z.enum(ACCENTS).optional() }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ schema, table: ref, name, comment, color }) => {
      const s = await load(schema); const t = table(s, ref)
      if (name && name.toLowerCase() !== t.name.toLowerCase() && findTable(s, name)) throw new ToolError(`A table named "${name}" already exists`)
      if (name) t.name = name
      if (comment !== undefined) t.comment = comment || undefined
      if (color) t.color = color
      return save(s)
    }))

  server.registerTool('delete_table', { title: 'Delete table', description: 'Delete a table and every relationship attached to it.', inputSchema: { schema: schemaRef, table: tableRef }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ schema, table: ref }) => { const s = await load(schema); const t = table(s, ref); return save(removeTable(s, t.id)) }))

  server.registerTool('add_column', { title: 'Add column', description: 'Add a column to a table.', inputSchema: { schema: schemaRef, table: tableRef, column: columnInput }, annotations: WR },
    guarded(async ({ schema, table: ref, column: c }) => {
      const s = await load(schema); const t = table(s, ref)
      if (findColumn(t, c.name)) throw new ToolError(`Table "${t.name}" already has a column "${c.name}"`)
      t.columns.push(toColumn(c)); return save(s)
    }))

  server.registerTool('update_column', { title: 'Update column', description: 'Change a column: rename, type, keys, nullability, default, comment. Only the fields you pass change.',
    inputSchema: { schema: schemaRef, table: tableRef, column: z.string().describe('Column name or id'), changes: columnInput.partial() }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ schema, table: ref, column: cref, changes }) => {
      const s = await load(schema); const t = table(s, ref); const c = column(t, cref)
      if (changes.name && changes.name.toLowerCase() !== c.name.toLowerCase() && findColumn(t, changes.name)) throw new ToolError(`Table "${t.name}" already has a column "${changes.name}"`)
      Object.assign(c, changes)
      if (c.pk) c.notNull = true
      return save(s)
    }))

  server.registerTool('delete_column', { title: 'Delete column', description: 'Delete a column and relationships that use it.', inputSchema: { schema: schemaRef, table: tableRef, column: z.string() }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ schema, table: ref, column: cref }) => { const s = await load(schema); const t = table(s, ref); const c = column(t, cref); return save(removeColumn(s, t.id, c.id)) }))

  const end = z.object({ table: tableRef, column: z.string().describe('Column name or id') })
  server.registerTool('add_relationship', { title: 'Add relationship (foreign key)', description: 'Link a foreign-key column ("from") to the column it references ("to"). kind N:1 (default) = many rows of from point at one row of to; 1:1; 1:N.',
    inputSchema: { schema: schemaRef, from: end, to: end, kind: z.enum(['N:1', '1:1', '1:N']).optional(), onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT']).optional(), onUpdate: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT']).optional(), name: z.string().optional() }, annotations: WR },
    guarded(async ({ schema, from, to, kind, onDelete, onUpdate, name }) => {
      const s = await load(schema)
      const ft = table(s, from.table), fc = column(ft, from.column), tt = table(s, to.table), tc = column(tt, to.column)
      const r = connectColumns(s, { table: ft.id, column: fc.id }, { table: tt.id, column: tc.id })
      if (!r) throw new ToolError('That relationship already exists (or both ends are the same column)')
      const rel = r.schema.relationships.find((x) => x.id === r.id)!
      // connectColumns may have swapped the ends so the foreign key sits on the non-key side; honour an explicit request
      if (rel.from.table !== ft.id || rel.from.column !== fc.id) { rel.from = { table: ft.id, column: fc.id }; rel.to = { table: tt.id, column: tc.id } }
      if (kind) rel.kind = kind
      if (onDelete) rel.onDelete = onDelete
      if (onUpdate) rel.onUpdate = onUpdate
      if (name) rel.name = name
      return { ...(await save(r.schema)), relationship: r.id }
    }))

  server.registerTool('delete_relationship', { title: 'Delete relationship', description: 'Remove the foreign key from one column.', inputSchema: { schema: schemaRef, from: end }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ schema, from }) => {
      const s = await load(schema); const t = table(s, from.table); const c = column(t, from.column)
      const before = s.relationships.length
      s.relationships = s.relationships.filter((r) => !(r.from.table === t.id && r.from.column === c.id))
      if (s.relationships.length === before) throw new ToolError(`${t.name}.${c.name} has no relationship`)
      return save(s)
    }))

  server.registerTool('layout_schema', { title: 'Auto-layout schema', description: 'Re-arrange all tables so related tables sit together (parents left, children right).', inputSchema: { schema: schemaRef }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ schema }) => save(layoutSchema(await load(schema)))))

  server.registerTool('add_schema_slide', { title: 'Add a schema to a deck as a slide', description: 'Copy a saved schema into a presentation deck as a "schema" slide. reveal "one_by_one" makes tables appear left to right, one per click; "all" shows everything at once.',
    inputSchema: { deck: z.string().describe('Deck id'), schema: schemaRef, title: z.string().optional(), reveal: z.enum(['one_by_one', 'all']).default('one_by_one'), index: z.number().int().min(1).optional() }, annotations: WR },
    guarded(async ({ deck, schema, title, reveal, index }) => {
      const d = await readDeck(deck); const s = await load(schema)
      if (!s.tables.length) throw new ToolError('That schema has no tables yet')
      const order = [...s.tables].sort((a, b) => a.x - b.x || a.y - b.y).map((t) => t.id)
      const copy: Schema = { ...structuredClone(s), id: 'slide', tables: s.tables.map((t) => ({ ...structuredClone(t), reveal: reveal === 'all' ? 0 : order.indexOf(t.id) + 1 })) }
      const slide: Slide = { id: rid(), layout: 'schema', title: title ?? s.name, elements: [], schema: copy }
      const at = index ? Math.min(index - 1, d.slides.length) : d.slides.length
      d.slides.splice(at, 0, slide)
      await writeDeck(d)
      return { ok: true, deck: d.id, slide: slide.id, number: at + 1, clicks: reveal === 'all' ? 0 : s.tables.length, edit: `${WEB}/edit/${d.id}`, present: `${WEB}/present/${d.id}#${at}.0` }
    }))
}

export { uniqueName, newColumn }
