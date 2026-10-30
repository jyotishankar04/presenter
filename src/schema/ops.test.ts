import { describe, expect, it } from 'vitest'
import { addColumn, addTable, connectColumns, duplicateTable, freeSpot, mergeImported, moveColumn, relKindFor, removeColumn, removeTable, uniqueName } from './ops'
import { parseSql } from './sqlParse'
import { emptySchema, type Schema } from './types'
import { validateSchema } from './validate'

const base = (): Schema => ({ id: 's', name: 'x', dialect: 'postgres', ...parseSql('CREATE TABLE users (id int primary key, email text unique); CREATE TABLE posts (id int primary key, author_id int, slug text unique);').schema })
const ids = (s: Schema) => ({ users: s.tables[0], posts: s.tables[1] })

describe('schema ops', () => {
  it('unique names', () => { expect(uniqueName('t', ['T', 't_2'])).toBe('t_3'); expect(uniqueName('a', [])).toBe('a') })
  it('adds tables with unique names and always-valid schemas', () => {
    let s = emptySchema('s')
    s = addTable(s).schema; s = addTable(s).schema
    expect(s.tables.map((t) => t.name)).toEqual(['new_table', 'new_table_2'])
    expect(validateSchema(s)).toBeNull()
  })
  it('removing a table drops its relationships; removing a column does too', () => {
    const s = base(); const { users, posts } = ids(s)
    const c = connectColumns(s, { table: posts.id, column: posts.columns[1].id }, { table: users.id, column: users.columns[0].id })!.schema
    expect(c.relationships).toHaveLength(1)
    expect(removeTable(c, users.id).relationships).toHaveLength(0)
    expect(removeColumn(c, posts.id, posts.columns[1].id).relationships).toHaveLength(0)
    expect(validateSchema(removeTable(c, users.id))).toBeNull()
  })
  it('duplicates a table with fresh ids and a unique name', () => {
    const s = base(); const d = duplicateTable(s, s.tables[0].id)!
    expect(d.schema.tables).toHaveLength(3); expect(d.schema.tables[2].name).toBe('users_copy')
    expect(d.schema.tables[2].columns[0].id).not.toBe(s.tables[0].columns[0].id)
    expect(validateSchema(d.schema)).toBeNull()
  })
  it('adds columns with unique names; moves them', () => {
    let s = base(); const t = s.tables[0].id
    s = addColumn(s, t, { name: 'email' })!.schema
    expect(s.tables[0].columns.map((c) => c.name)).toEqual(['id', 'email', 'email_2'])
    s = moveColumn(s, t, s.tables[0].columns[2].id, -1)
    expect(s.tables[0].columns.map((c) => c.name)).toEqual(['id', 'email_2', 'email'])
    expect(moveColumn(s, t, s.tables[0].columns[0].id, -1).tables[0].columns[0].name).toBe('id')
  })
  it('connect: foreign key goes on the "from" end even when dragged from the key side; no duplicates, no self links', () => {
    const s = base(); const { users, posts } = ids(s)
    const pkToFk = connectColumns(s, { table: users.id, column: users.columns[0].id }, { table: posts.id, column: posts.columns[1].id })!
    expect(pkToFk.schema.relationships[0]).toMatchObject({ from: { table: posts.id }, to: { table: users.id }, kind: 'N:1' })
    expect(connectColumns(pkToFk.schema, { table: posts.id, column: posts.columns[1].id }, { table: users.id, column: users.columns[0].id })).toBeNull()
    expect(connectColumns(s, { table: users.id, column: users.columns[0].id }, { table: users.id, column: users.columns[0].id })).toBeNull()
    expect(relKindFor({ id: '', name: '', type: '', unique: true }, { id: '', name: '', type: '', pk: true })).toBe('1:1')
  })
  it('merges imported tables, skipping names that already exist and offsetting the rest', () => {
    const s = base()
    const imp = parseSql('CREATE TABLE users (id int); CREATE TABLE tags (id int primary key); CREATE TABLE post_tags (tag_id int references tags(id));').schema
    const m = mergeImported(s, imp)
    expect(m.added).toBe(2); expect(m.skipped).toEqual(['users'])
    expect(m.schema.relationships).toHaveLength(1)
    expect(m.schema.tables.at(-1)!.x).toBeGreaterThan(300)
    expect(validateSchema(m.schema)).toBeNull()
  })
  it('free spot avoids existing tables', () => {
    const s = base(); s.tables[0].x = 0; s.tables[0].y = 0
    const p = freeSpot(s, { x: 0, y: 0 })
    expect(p.x !== 0 || p.y !== 0).toBe(true)
  })
})
