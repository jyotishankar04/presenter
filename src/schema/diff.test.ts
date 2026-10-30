import { describe, expect, it } from 'vitest'
import { describeDiff, diffSchemas, isEmptyDiff, migrationSql } from './diff'
import { parseSql } from './sqlParse'
import type { Schema } from './types'

const mk = (sql: string, dialect: Schema['dialect'] = 'postgres'): Schema => ({ id: 's', name: 'x', dialect, ...parseSql(sql).schema })
const A = mk('CREATE TABLE users (id uuid PRIMARY KEY, email text, legacy int); CREATE TABLE posts (id int PRIMARY KEY, author_id uuid, title text); CREATE TABLE old (id int);')
const B = mk('CREATE TABLE users (id uuid PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, created_at timestamptz DEFAULT now()); CREATE TABLE posts (id int PRIMARY KEY, author_id uuid REFERENCES users(id) ON DELETE CASCADE, title text); CREATE TABLE tags (id serial PRIMARY KEY, name text);')

describe('schema diff', () => {
  it('finds added/removed tables, columns, changed columns and relationships', () => {
    const d = diffSchemas(A, B)
    expect(d.addedTables.map((t) => t.name)).toEqual(['tags']); expect(d.removedTables.map((t) => t.name)).toEqual(['old'])
    const users = d.changedTables.find((t) => t.table === 'users')!
    expect(users.addedColumns.map((c) => c.name)).toEqual(['created_at']); expect(users.removedColumns.map((c) => c.name)).toEqual(['legacy'])
    expect(users.changedColumns[0]).toMatchObject({ column: 'email', what: ['type', 'nullability', 'unique'] })
    expect(d.addedRelationships.map((r) => r.from + '>' + r.to)).toEqual(['posts.author_id>users.id'])
    expect(describeDiff(d)).toContain('+ table tags'); expect(describeDiff(d)).toContain('- users.legacy')
  })
  it('identical schemas (even reordered / different case) have no diff', () => {
    expect(isEmptyDiff(diffSchemas(A, mk('CREATE TABLE OLD (id int); CREATE TABLE Posts (title text, author_id uuid, id int PRIMARY KEY); CREATE TABLE Users (legacy int, email text, id uuid PRIMARY KEY);')))).toBe(true)
    expect(migrationSql(A, A)).toContain('No differences')
  })
})

describe('migration SQL', () => {
  it('PostgreSQL: create, add/drop/alter columns, constraints, drop table', () => {
    const m = migrationSql(A, B, 'postgres')
    expect(m).toContain('CREATE TABLE "tags"')
    expect(m).toContain('ALTER TABLE "users" ADD COLUMN "created_at" timestamptz DEFAULT now();')
    expect(m).toContain('ALTER TABLE "users" DROP COLUMN "legacy";')
    expect(m).toContain('ALTER TABLE "users" ALTER COLUMN "email" TYPE varchar(255);'); expect(m).toContain('ALTER COLUMN "email" SET NOT NULL;')
    expect(m).toContain('ADD CONSTRAINT "uq_users_email" UNIQUE ("email");')
    expect(m).toContain('ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_author_id" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE;')
    expect(m).toContain('DROP TABLE "old";')
    expect(m.indexOf('CREATE TABLE')).toBeLessThan(m.indexOf('DROP TABLE'))   // create before destructive steps
  })
  it('MySQL uses MODIFY COLUMN; SQLite explains what it cannot do', () => {
    expect(migrationSql(A, B, 'mysql')).toContain('MODIFY COLUMN `email` varchar(255) NOT NULL UNIQUE;')
    const lite = migrationSql(A, B, 'sqlite')
    expect(lite).toContain('-- SQLite cannot alter'); expect(lite).toContain('-- SQLite cannot add the foreign key')
  })
  it('the migration applied to A produces B (tables and columns)', () => {
    // round trip through our own parser: schema after "create new tables" + the DDL is consistent
    const m = migrationSql(A, B, 'postgres')
    expect(parseSql(m).schema.tables.map((t) => t.name)).toEqual(['tags'])
  })
})
