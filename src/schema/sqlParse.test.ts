import { describe, expect, it } from 'vitest'
import { parseSql } from './sqlParse'

const byName = (r: ReturnType<typeof parseSql>, n: string) => r.schema.tables.find((t) => t.name === n)!
const col = (r: ReturnType<typeof parseSql>, t: string, c: string) => byName(r, t).columns.find((x) => x.name === c)!
const rel = (r: ReturnType<typeof parseSql>) => r.schema.relationships.map((x) => {
  const f = r.schema.tables.find((t) => t.id === x.from.table)!, t = r.schema.tables.find((t) => t.id === x.to.table)!
  return `${f.name}.${f.columns.find((c) => c.id === x.from.column)!.name}>${t.name}.${t.columns.find((c) => c.id === x.to.column)!.name}:${x.kind}`
})

describe('SQL parser: PostgreSQL', () => {
  const r = parseSql(`
    -- shop schema
    CREATE TABLE public.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      name text,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    CREATE TABLE orders (
      id bigserial,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total numeric(10, 2) DEFAULT 0,
      status text DEFAULT 'new',
      PRIMARY KEY (id)
    );
    CREATE TABLE order_items (
      order_id bigint NOT NULL,
      product_id int NOT NULL,
      qty int NOT NULL DEFAULT 1,
      CONSTRAINT pk_items PRIMARY KEY (order_id, product_id),
      CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE ON UPDATE NO ACTION
    );
    COMMENT ON TABLE users IS 'People who can log in';
    COMMENT ON COLUMN users.email IS 'Login address';
    ALTER TABLE ONLY order_items ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id);
    CREATE INDEX idx ON orders (status);
  `)
  it('reads tables and column details', () => {
    expect(r.schema.tables.map((t) => t.name)).toEqual(['users', 'orders', 'order_items'])
    expect(col(r, 'users', 'id')).toMatchObject({ type: 'uuid', pk: true, notNull: true, default: 'gen_random_uuid()' })
    expect(col(r, 'users', 'email')).toMatchObject({ type: 'varchar(255)', notNull: true, unique: true })
    expect(col(r, 'users', 'created_at')).toMatchObject({ type: 'timestamp with time zone', notNull: true, default: 'now()' })
    expect(col(r, 'orders', 'total')).toMatchObject({ type: 'numeric(10,2)', default: '0' })
    expect(col(r, 'orders', 'status').default).toBe("'new'")
  })
  it('reads table-level primary keys, including composite', () => {
    expect(col(r, 'orders', 'id')).toMatchObject({ pk: true, notNull: true })
    expect(byName(r, 'order_items').columns.filter((c) => c.pk).map((c) => c.name)).toEqual(['order_id', 'product_id'])
  })
  it('turns inline and table-level foreign keys into relationships', () => {
    expect(rel(r)).toEqual(['orders.user_id>users.id:N:1', 'order_items.order_id>orders.id:N:1'])
    expect(r.schema.relationships[0].onDelete).toBe('CASCADE')
    expect(r.schema.relationships[1]).toMatchObject({ onDelete: 'CASCADE', onUpdate: 'NO ACTION', name: 'fk_order' })
  })
  it('applies COMMENT ON and warns about unknown tables in ALTER foreign keys', () => {
    expect(byName(r, 'users').comment).toBe('People who can log in')
    expect(col(r, 'users', 'email').comment).toBe('Login address')
    expect(r.warnings.some((w) => /products/.test(w))).toBe(true)
  })
})

describe('SQL parser: MySQL and SQLite flavours', () => {
  it('handles backticks, AUTO_INCREMENT, KEY lines, comments and table options', () => {
    const r = parseSql("CREATE TABLE `posts` (\n `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'pk',\n `author_id` INT NOT NULL,\n `title` VARCHAR(200) NOT NULL,\n PRIMARY KEY (`id`),\n KEY `idx_author` (`author_id`),\n UNIQUE KEY `uq_title` (`title`),\n CONSTRAINT `fk_author` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)\n) ENGINE=InnoDB COMMENT='Blog posts';\nCREATE TABLE `authors` (`id` INT PRIMARY KEY);")
    expect(col(r, 'posts', 'id')).toMatchObject({ type: 'INT UNSIGNED', pk: true, comment: 'pk', autoIncrement: true })
    expect(col(r, 'posts', 'title').unique).toBe(true)
    expect(byName(r, 'posts').comment).toBe('Blog posts')
    expect(rel(r)).toEqual(['posts.author_id>authors.id:N:1'])
  })
  it('handles SQLite AUTOINCREMENT and one-to-one foreign keys', () => {
    const r = parseSql('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);\nCREATE TABLE profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id), bio TEXT);')
    expect(rel(r)).toEqual(['profiles.user_id>users.id:1:1'])
  })
  it('a FOREIGN KEY with no referenced column uses the primary key', () => {
    const r = parseSql('CREATE TABLE a (id int primary key); CREATE TABLE b (id int primary key, a_id int references a);')
    expect(rel(r)).toEqual(['b.a_id>a.id:N:1'])
  })
})

describe('SQL parser: robustness', () => {
  it('never throws; reports what it skipped', () => {
    const r = parseSql('this is not sql at all; CREATE TABLE ok (id int); SELEKT nonsense (')
    expect(r.schema.tables.map((t) => t.name)).toEqual(['ok'])
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(parseSql('').warnings[0]).toMatch(/No CREATE TABLE/)
  })
  it('ignores semicolons and commas inside strings and parentheses', () => {
    const r = parseSql("CREATE TABLE t (a text DEFAULT 'x;y,z', b numeric(10, 2), c text CHECK (c in ('a','b')));")
    expect(r.schema.tables[0].columns.map((c) => c.name)).toEqual(['a', 'b', 'c'])
    expect(col(r, 't', 'a').default).toBe("'x;y,z'")
  })
  it('supports quoted identifiers with spaces and schema prefixes', () => {
    const r = parseSql('CREATE TABLE "my"."Order Items" ("Item Id" int primary key, "qty" int);')
    expect(r.schema.tables[0].name).toBe('Order Items'); expect(r.schema.tables[0].columns[0].name).toBe('Item Id')
  })
})
