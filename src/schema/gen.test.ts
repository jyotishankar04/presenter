import { describe, expect, it } from 'vitest'
import { layoutSchema } from './layout'
import { parseSql } from './sqlParse'
import { toDbml, toMermaid, toSql } from './sqlGen'
import type { Schema } from './types'
import { validateSchema } from './validate'

const SQL = `
CREATE TABLE users (id uuid PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, bio text DEFAULT 'hi');
CREATE TABLE posts (id bigserial PRIMARY KEY, author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL);
CREATE TABLE tags (post_id bigint NOT NULL, tag text NOT NULL, PRIMARY KEY (post_id, tag), FOREIGN KEY (post_id) REFERENCES posts(id));
`
const mk = (): Schema => ({ id: 's', name: 'blog', dialect: 'postgres', ...parseSql(SQL).schema })

describe('schema exports', () => {
  it('PostgreSQL DDL: tables, composite keys, ALTER foreign keys', () => {
    const sql = toSql(mk(), 'postgres')
    expect(sql).toContain('CREATE TABLE "users" (')
    expect(sql).toContain('"email" varchar(255) NOT NULL UNIQUE')
    expect(sql).toContain('PRIMARY KEY ("post_id", "tag")')
    expect(sql).toContain('ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_author_id" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE;')
  })
  it('MySQL uses backticks and inline comments; SQLite inlines foreign keys', () => {
    const s = mk(); s.tables[0].columns[1].comment = 'login'
    expect(toSql(s, 'mysql')).toContain('`email` varchar(255) NOT NULL UNIQUE COMMENT \'login\'')
    const lite = toSql(mk(), 'sqlite')
    expect(lite).not.toContain('ALTER TABLE')
    expect(lite).toContain('FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE')
  })
  it('auto-increment maps per dialect', () => {
    const s: Schema = { id: 's', name: 'x', dialect: 'mysql', relationships: [], tables: [{ id: 't', name: 't', x: 0, y: 0, columns: [{ id: 'c', name: 'id', type: 'INT', pk: true, autoIncrement: true }] }] }
    expect(toSql(s, 'mysql')).toContain('`id` INT NOT NULL AUTO_INCREMENT')
    expect(toSql(s, 'postgres')).toContain('"id" serial')
    expect(toSql(s, 'sqlite')).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT')
  })
  it('round trip: exported SQL parses back to the same tables, keys and relationships', () => {
    for (const dialect of ['postgres', 'mysql', 'sqlite'] as const) {
      const a = mk(); const b = parseSql(toSql(a, dialect)).schema
      const shape = (t: { name: string; columns: { name: string; pk?: boolean; unique?: boolean }[] }) => [t.name, t.columns.map((c) => c.name + (c.pk ? ':pk' : '') + (c.unique ? ':uq' : ''))]
      expect(b.tables.map(shape)).toEqual(a.tables.map(shape))
      expect(b.relationships).toHaveLength(a.relationships.length)
      expect(b.relationships[0].onDelete).toBe('CASCADE')
    }
  })
  it('Mermaid ER: keys and crow\'s-foot relationships', () => {
    const m = toMermaid(mk())
    expect(m).toContain('erDiagram'); expect(m).toContain('varchar_255 email UK'); expect(m).toContain('uuid author_id FK')
    expect(m).toContain('posts }o--|| users : "author_id"')
  })
  it('DBML refs and attributes', () => {
    const d = toDbml(mk())
    expect(d).toContain('Table "users" {'); expect(d).toContain('"id" uuid [pk]'); expect(d).toContain('Ref: "posts"."author_id" > "users"."id"')
  })
})

describe('layout + validation', () => {
  it('related tables are placed left to right with no overlaps', () => {
    const l = layoutSchema(mk())
    const x = Object.fromEntries(l.tables.map((t) => [t.name, t.x]))
    expect(x.users).toBeLessThan(x.posts); expect(x.posts).toBeLessThan(x.tags)
    for (const a of l.tables) for (const b of l.tables) if (a !== b) expect(a.x < b.x + 280 && a.x + 280 > b.x && a.y < b.y + 400 && a.y + 100 > b.y && Math.abs(a.x - b.x) < 280).toBe(false)
  })
  it('validates and explains problems', () => {
    expect(validateSchema(mk())).toBeNull()
    const bad = mk(); bad.relationships[0].to.column = 'nope'
    expect(validateSchema(bad)).toMatch(/column "nope" does not exist/)
    const dup = mk(); dup.tables[1].name = 'USERS'
    expect(validateSchema(dup)).toMatch(/duplicate table name/)
    expect(validateSchema({ ...mk(), dialect: 'oracle' })).toMatch(/dialect/)
  })
})

import { SAMPLES } from './samples'
describe('sample schemas', () => {
  it('every sample parses cleanly into a valid, round-trippable schema', () => {
    for (const smp of SAMPLES) {
      const r = parseSql(smp.sql)
      expect(r.warnings, smp.id).toEqual([])
      const s = layoutSchema({ id: smp.id, name: smp.label, dialect: 'postgres', ...r.schema })
      expect(validateSchema(s), smp.id).toBeNull()
      expect(s.relationships.length).toBeGreaterThan(1)
      expect(parseSql(toSql(s, 'postgres')).schema.relationships).toHaveLength(s.relationships.length)
    }
  })
})

describe('indexes', () => {
  const sql = `CREATE TABLE posts (id int primary key, author_id int, slug text, created_at timestamp, KEY idx_author (author_id), UNIQUE KEY uq_author_slug (author_id, slug));
CREATE INDEX idx_created ON posts (created_at DESC);
CREATE UNIQUE INDEX uq_slug ON posts (slug);`
  it('parses inline KEY / UNIQUE KEY and CREATE INDEX; single-column unique indexes become the UNIQUE flag', () => {
    const t = parseSql(sql).schema.tables[0]
    expect(t.indexes!.map((i) => [i.name, i.columns.length, !!i.unique])).toEqual([['idx_author', 1, false], ['uq_author_slug', 2, true], ['idx_created', 1, false]])
    expect(t.columns.find((c) => c.name === 'slug')!.unique).toBe(true)
  })
  it('exports indexes and round-trips them', () => {
    const s: Schema = { id: 's', name: 'x', dialect: 'postgres', ...parseSql(sql).schema }
    const out = toSql(s, 'postgres')
    expect(out).toContain('CREATE INDEX "idx_author" ON "posts" ("author_id");'); expect(out).toContain('CREATE UNIQUE INDEX "uq_author_slug" ON "posts" ("author_id", "slug");')
    expect(parseSql(out).schema.tables[0].indexes!.map((i) => i.name).sort()).toEqual(['idx_author', 'idx_created', 'uq_author_slug'])
    expect(validateSchema(s)).toBeNull()
    s.tables[0].indexes![0].columns = ['nope']; expect(validateSchema(s)).toMatch(/does not exist/)
  })
})

it('removing a column drops it from indexes (and the index if it becomes empty)', async () => {
  const { removeColumn } = await import('./ops')
  const s: Schema = { id: 's', name: 'x', dialect: 'postgres', ...parseSql('CREATE TABLE t (a int, b int, KEY i1 (a), KEY i2 (a, b));').schema }
  const t = s.tables[0], a = t.columns[0].id
  const out = removeColumn(s, t.id, a)
  expect(out.tables[0].indexes!.map((i) => [i.name, i.columns.length])).toEqual([['i2', 1]])
  expect(validateSchema(out)).toBeNull()
})
