import { describe, expect, it } from 'vitest'
import { toDrizzle, toPrisma } from './orm'
import { parseSql } from './sqlParse'
import type { Schema } from './types'

const sql = `
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE posts (id bigserial PRIMARY KEY, author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, editor_id uuid REFERENCES users(id), title text NOT NULL, score numeric(10,2) DEFAULT 0, published boolean DEFAULT false);
CREATE TABLE post_tags (post_id bigint NOT NULL REFERENCES posts(id), tag text NOT NULL, PRIMARY KEY (post_id, tag));
CREATE INDEX idx_title ON posts (title);
CREATE TABLE profiles (user_id uuid PRIMARY KEY REFERENCES users(id), bio text);`
const s = (): Schema => ({ id: 's', name: 'blog', dialect: 'postgres', ...parseSql(sql).schema })

describe('Prisma export', () => {
  const p = toPrisma(s())
  it('writes datasource, models, field types and attributes', () => {
    expect(p).toContain('provider = "postgresql"')
    expect(p).toContain('model User {'); expect(p).toContain('model Post {'); expect(p).toContain('@@map("users")')
    expect(p).toMatch(/id String @id @default\(uuid\(\)\) @db\.Uuid/)
    expect(p).toMatch(/email String @unique @db\.VarChar\(255\)/)
    expect(p).toMatch(/created_at|createdAt DateTime @default\(now\(\)\)/)
    expect(p).toMatch(/id BigInt @id @default\(autoincrement\(\)\)/)
    expect(p).toMatch(/score Decimal\? @default\(0\) @db\.Decimal\(10, 2\)/)
    expect(p).toMatch(/published Boolean\? @default\(false\)/)
  })
  it('writes relations on both sides, handles two FKs to one table, composite keys, indexes and 1:1', () => {
    expect(p).toMatch(/user User @relation\(.*fields: \[authorId\], references: \[id\], onDelete: Cascade\)/)
    expect(p).toContain('@relation("Posts_authorId"'); expect(p).toContain('@relation("Posts_editorId"')
    expect(p).toMatch(/posts Post\[\]/)
    expect(p).toContain('@@id([postId, tag])')
    expect(p).toContain('@@index([title])')
    expect(p).toMatch(/profile Profile\?/)
  })
})

describe('Drizzle export', () => {
  const d = toDrizzle(s())
  it('imports what it uses and defines tables with references', () => {
    expect(d).toMatch(/^import \{ .*pgTable.* \} from 'drizzle-orm\/pg-core'/)
    expect(d).toContain('export const users = pgTable("users", {')
    expect(d).toContain('id: uuid("id").primaryKey().defaultRandom()')
    expect(d).toContain('email: varchar("email", { length: 255 }).notNull().unique()')
    expect(d).toContain('createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()')
    expect(d).toContain('.references(() => users.id, { onDelete: \'cascade\' })')
    expect(d).toContain('score: numeric("score", { precision: 10, scale: 2 }).default("0")')
  })
  it('composite primary keys and indexes use the table callback', () => {
    expect(d).toContain('primaryKey({ columns: [table.postId, table.tag] })')
    expect(d).toContain('index("idx_title").on(table.title)')
  })
})
