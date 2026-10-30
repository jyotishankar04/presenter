import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpServer } from './tools'
import { validateSlideCode, slideToCode } from '../src/model/validate'
import { validateFlow } from '../src/flow/validate'
import { readDeck } from '../server/store'

let dir: string
let client: Client

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r: any = await client.callTool({ name, arguments: args })
  const text = r.content[0].text as string
  let json: any = null
  try { json = JSON.parse(text) } catch { /* plain text */ }
  return { error: !!r.isError, text, json }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'presenter-mcp-'))
  process.env.PRESENTER_DECKS = dir
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createMcpServer().connect(a)
  client = new Client({ name: 'test', version: '0' })
  await client.connect(b)
})
afterAll(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.PRESENTER_DECKS })

describe('MCP server', () => {
  it('exposes the tools and the guide resource', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    for (const n of ['list_decks', 'get_deck', 'get_slide', 'create_deck', 'add_slide', 'update_slide', 'add_element', 'update_element', 'delete_element', 'set_reveal', 'add_diagram_slide', 'add_mermaid_flow_slide', 'update_flow_slide', 'add_code_slide', 'add_sequence_slide', 'add_comparison_slide', 'get_authoring_guide', 'delete_deck']) expect(names).toContain(n)
    expect((await client.listResources()).resources.map((r) => r.uri)).toContain('presenter://guide')
    expect((await call('get_authoring_guide')).text).toContain('reveal')
  })

  it('creates a deck and builds slides that the editor would accept', async () => {
    const created = await call('create_deck', { title: 'URL Shortener', theme: 'dark' })
    expect(created.json.deck).toBe('url-shortener')
    const id = created.json.deck

    const diagram = await call('add_diagram_slide', { deck: id, title: 'Architecture', nodes: [{ id: 'client', label: 'Client' }, { id: 'api', label: 'API', icon: 'Server' }, { id: 'db', label: 'Database', icon: 'Database' }], edges: [{ from: 'client', to: 'api' }, { from: 'api', to: 'db' }] })
    expect(diagram.error).toBe(false); expect(diagram.json.clicks).toBe(3)

    expect((await call('add_code_slide', { deck: id, title: 'Shorten', code: 'a\nb\nc', focus: [{ lines: '1', click: 1 }, { lines: '2-3', click: 2 }] })).json.clicks).toBe(2)
    expect((await call('add_sequence_slide', { deck: id, title: 'Open link', actors: ['Browser', 'Shortener', 'DB'], messages: [{ from: 'Browser', to: 'Shortener', text: 'open' }, { from: 'Shortener', to: 'DB', text: 'lookup' }, { from: 'DB', to: 'Shortener', text: 'url' }] })).json.clicks).toBe(3)
    expect((await call('add_comparison_slide', { deck: id, title: 'A vs B', left: { header: 'Not AI', items: ['x', 'y'] }, right: { header: 'AI', items: ['p', 'q'] }, footer: 'done' })).json.clicks).toBe(5)

    const deck = await readDeck(id)
    expect(deck.slides.map((s) => s.layout)).toEqual(['section', 'flow', 'content', 'content', 'content'])
    expect(validateFlow(deck.slides[1].flow)).toBeNull()
    for (const s of deck.slides.slice(2)) expect(validateSlideCode(slideToCode(s))).toBeNull()
  })

  it('outlines and reads slides', async () => {
    const outline = await call('get_deck', { deck: 'url-shortener' })
    expect(outline.json.slides).toHaveLength(5); expect(outline.json.edit).toContain('/edit/url-shortener')
    const slide = await call('get_slide', { deck: 'url-shortener', slide: 2 })
    expect(slide.json.layout).toBe('flow'); expect(slide.json.flow.edges).toHaveLength(2)
  })

  it('adds, updates, reveals and deletes elements', async () => {
    const id = 'url-shortener'
    const added = await call('add_element', { deck: id, slide: 1, element: { type: 'text', text: 'Hello', x: 100, y: 100 } })
    expect(added.error).toBe(false)
    const eid = added.json.element
    expect((await call('update_element', { deck: id, slide: 1, id: eid, changes: { text: 'Hi', size: 50 } })).error).toBe(false)
    expect((await call('set_reveal', { deck: id, slide: 1, ids: [eid], step: 0 })).error).toBe(false)
    const s = (await call('get_slide', { deck: id, slide: 1 })).json
    expect(s.elements.at(-1)).toMatchObject({ id: eid, text: 'Hi', size: 50, reveal: 0 })
    expect((await call('delete_element', { deck: id, slide: 1, id: eid })).error).toBe(false)
  })

  it('rejects invalid writes with a readable message and leaves the deck unchanged', async () => {
    const id = 'url-shortener'
    const before = JSON.stringify(await readDeck(id))
    const bad = await call('add_element', { deck: id, slide: 3, element: { type: 'box', label: 'x', x: 'left' } })
    expect(bad.error).toBe(true); expect(bad.text).toContain('"x" must be a number')
    const arrow = await call('add_element', { deck: id, slide: 3, element: { type: 'arrow', from: 'nope', to: 'nope' } })
    expect(arrow.error).toBe(true); expect(arrow.text).toMatch(/points at/)
    const codeEl = (await call('get_slide', { deck: id, slide: 3 })).json.elements[0].id
    expect((await call('update_element', { deck: id, slide: 3, id: codeEl, changes: { type: 'text' } })).error).toBe(true)
    expect((await call('get_slide', { deck: id, slide: 99 })).text).toContain('has 5 slides')
    expect((await call('add_diagram_slide', { deck: id, title: 't', nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'zzz' }] })).error).toBe(true)
    expect(JSON.stringify(await readDeck(id))).toBe(before)
  })

  it('builds flowcharts: shapes, labelled edges, direction and reveal modes', async () => {
    const id = 'url-shortener'
    const r = await call('add_diagram_slide', { deck: id, title: 'Cache flow', direction: 'LR', reveal: 'node', index: 6,
      nodes: [{ id: 'start', label: 'Open link', shape: 'pill' }, { id: 'hit', label: 'In cache?', shape: 'decision' }, { id: 'db', label: 'Database', shape: 'database', icon: 'Database' }, { id: 'ok', label: 'Redirect' }],
      edges: [{ from: 'start', to: 'hit' }, { from: 'hit', to: 'ok', label: 'yes' }, { from: 'hit', to: 'db', label: 'no', dashed: true }, { from: 'db', to: 'ok' }] })
    expect(r.error).toBe(false); expect(r.json.clicks).toBe(4)
    const s = (await call('get_slide', { deck: id, slide: r.json.slides })).json
    expect(s.layout).toBe('flow'); expect(validateFlow(s.flow)).toBeNull()
    expect(s.flow.nodes.find((n: any) => n.id === 'hit').type).toBe('decision')
    expect(s.flow.edges.find((e: any) => e.label === 'no').data.dashed).toBe(true)
    expect(s.flow.edges.every((e: any) => e.sourceHandle === 'r' && e.targetHandle === 'l')).toBe(true)
    const x = Object.fromEntries(s.flow.nodes.map((n: any) => [n.id, n.position.x]))
    expect(x.start).toBeLessThan(x.hit); expect(x.hit).toBeLessThan(x.ok)
    // top-to-bottom flips the axis
    const tb = await call('add_diagram_slide', { deck: id, title: 'TB', direction: 'TB', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] })
    const t = (await call('get_slide', { deck: id, slide: tb.json.slides })).json
    expect(t.flow.edges[0]).toMatchObject({ sourceHandle: 'b', targetHandle: 't' })
    // the older fixed-layout engine still works
    const boxes = await call('add_diagram_slide', { deck: id, title: 'Boxes', engine: 'boxes', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] })
    expect((await call('get_slide', { deck: id, slide: boxes.json.slides })).json.layout).toBe('content')
    for (const n of [boxes.json.slides, tb.json.slides, r.json.slides].sort((a, b) => b - a)) await call('delete_slide', { deck: id, slide: n })
  })

  it('imports Mermaid flowcharts and edits flow slides', async () => {
    const id = 'url-shortener'
    const m = await call('add_mermaid_flow_slide', { deck: id, title: 'Login', mermaid: 'flowchart TD\n  S([Start]) --> V{Valid?}\n  V -->|yes| H[Home]\n  V -->|no| E[Error]\n  E --> V' })
    expect(m.error).toBe(false); expect(m.json.nodes).toBe(4); expect(m.json.edges).toBe(4)
    const n = m.json.slides
    const up = await call('update_flow_slide', { deck: id, slide: n, title: 'Login v2', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', shape: 'decision' }], edges: [{ from: 'a', to: 'b' }] })
    expect(up.error).toBe(false)
    const s = (await call('get_slide', { deck: id, slide: n })).json
    expect(s.title).toBe('Login v2'); expect(s.flow.nodes).toHaveLength(2)
    // errors an agent can act on
    expect((await call('add_mermaid_flow_slide', { deck: id, title: 'x', mermaid: 'sequenceDiagram\n A->>B: hi' })).text).toMatch(/flowchart/)
    const refused = await call('add_element', { deck: id, slide: n, element: { type: 'text', text: 'x' } })
    expect(refused.error).toBe(true); expect(refused.text).toContain('update_flow_slide')
    expect((await call('update_flow_slide', { deck: id, slide: 1, title: 'x' })).text).toMatch(/not a flow diagram slide/)
    expect((await call('update_flow_slide', { deck: id, slide: n, edges: [{ from: 'a', to: 'b' }] })).error).toBe(true)
    await call('delete_slide', { deck: id, slide: n })
  })

  it('protects canvas slides and rejects bad ids / path tricks', async () => {
    const id = 'url-shortener'
    const c = await call('add_slide', { deck: id, layout: 'canvas', index: 1 })
    expect(c.error).toBe(false)
    const refused = await call('add_element', { deck: id, slide: 1, element: { type: 'text', text: 'x' } })
    expect(refused.error).toBe(true); expect(refused.text).toContain('freehand canvas')
    expect((await call('get_deck', { deck: '../../etc/passwd' })).error).toBe(true)
    expect((await call('create_deck', { title: 'x', id: 'bad/id' })).error).toBe(true)
  })

  it('moves, duplicates and deletes slides; protects the last slide', async () => {
    const id = 'url-shortener'
    await call('move_slide', { deck: id, slide: 1, to: 3 })
    expect((await call('duplicate_slide', { deck: id, slide: 1 })).error).toBe(false)
    const n = (await call('get_deck', { deck: id })).json.slides.length
    expect(n).toBe(7)
    expect((await call('delete_slide', { deck: id, slide: 1 })).error).toBe(false)
    const small = (await call('create_deck', { title: 'Tiny' })).json.deck
    expect((await call('delete_slide', { deck: small, slide: 1 })).text).toContain('at least one')
  })

  it('delete_deck needs confirm:true and really deletes', async () => {
    const id = (await call('create_deck', { title: 'Temp' })).json.deck
    const r: any = await client.callTool({ name: 'delete_deck', arguments: { deck: id } }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }))
    expect(r.isError).toBe(true)
    expect(existsSync(join(dir, id + '.json'))).toBe(true)
    expect((await call('delete_deck', { deck: id, confirm: true })).error).toBe(false)
    expect(existsSync(join(dir, id + '.json'))).toBe(false)
  })

  it('create_deck avoids clobbering an existing deck', async () => {
    const a = (await call('create_deck', { title: 'Same Name' })).json.deck
    const b = (await call('create_deck', { title: 'Same Name' })).json.deck
    expect(b).not.toBe(a)
    expect((await call('create_deck', { title: 'Same Name', id: a })).error).toBe(true)
  })
})

describe('MCP schema tools', () => {
  beforeAll(() => { process.env.PRESENTER_SCHEMAS = join(dir, 'schemas') })

  it('exposes the schema tools', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    for (const n of ['list_schemas', 'get_schema', 'export_schema', 'create_schema', 'import_sql', 'add_table', 'update_table', 'delete_table', 'add_column', 'update_column', 'delete_column', 'add_relationship', 'delete_relationship', 'layout_schema', 'add_schema_slide', 'delete_schema']) expect(names).toContain(n)
  })

  it('designs a database: SQL import, tables, columns, relationships, exports', async () => {
    const c = await call('create_schema', { name: 'Shop', sql: 'CREATE TABLE customers (id uuid PRIMARY KEY, email text UNIQUE NOT NULL); CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid REFERENCES customers(id) ON DELETE CASCADE, total numeric(10,2));' })
    expect(c.error).toBe(false); expect(c.json.tables).toBe(2); expect(c.json.relationships).toBe(1)
    const id = c.json.schema
    const add = await call('add_table', { schema: id, name: 'order_items', columns: [{ name: 'order_id', type: 'uuid', pk: true }, { name: 'sku', type: 'text', pk: true }, { name: 'qty', type: 'int', notNull: true, default: '1' }] })
    expect(add.error).toBe(false)
    expect((await call('add_relationship', { schema: id, from: { table: 'order_items', column: 'order_id' }, to: { table: 'orders', column: 'id' }, onDelete: 'CASCADE' })).error).toBe(false)
    expect((await call('add_column', { schema: id, table: 'customers', column: { name: 'created_at', type: 'timestamptz', default: 'now()' } })).error).toBe(false)
    expect((await call('update_column', { schema: id, table: 'orders', column: 'total', changes: { type: 'numeric(12,2)', notNull: true } })).error).toBe(false)
    const g = (await call('get_schema', { schema: id })).json
    expect(g.tables.map((t: any) => t.name)).toEqual(['customers', 'orders', 'order_items'])
    expect(g.relationships).toHaveLength(2)
    expect(g.relationships.some((r: string) => r.startsWith('order_items.order_id -> orders.id'))).toBe(true)
    expect(g.tables[1].columns.find((x: string) => x.startsWith('total'))).toContain('numeric(12,2) NOT NULL')
    const sql = (await call('export_schema', { schema: id, format: 'postgres' })).text
    expect(sql).toContain('CREATE TABLE "order_items"'); expect(sql).toContain('PRIMARY KEY ("order_id", "sku")'); expect(sql).toContain('ON DELETE CASCADE')
    expect((await call('export_schema', { schema: id, format: 'mermaid' })).text).toContain('orders }o--|| customers')
    expect((await call('layout_schema', { schema: id })).error).toBe(false)
  })

  it('removes things safely and rejects bad input with readable messages', async () => {
    const id = (await call('list_schemas')).json.schemas[0].id
    const before = JSON.stringify((await call('get_schema', { schema: id })).json)
    expect((await call('add_table', { schema: id, name: 'ORDERS' })).text).toMatch(/already exists/)
    expect((await call('add_column', { schema: id, table: 'orders', column: { name: 'id' } })).text).toMatch(/already has a column/)
    expect((await call('add_relationship', { schema: id, from: { table: 'orders', column: 'nope' }, to: { table: 'customers', column: 'id' } })).text).toMatch(/No column "nope"/)
    expect((await call('add_relationship', { schema: id, from: { table: 'ghost', column: 'x' }, to: { table: 'customers', column: 'id' } })).text).toMatch(/No table "ghost"/)
    expect((await call('create_schema', { name: 'bad', sql: 'select 1' })).text).toMatch(/No tables found/)
    expect((await call('get_schema', { schema: '../../etc' })).error).toBe(true)
    expect(JSON.stringify((await call('get_schema', { schema: id })).json)).toBe(before)
    // deleting a referenced column removes only the links that use it (order_items -> orders stays)
    const g = (await call('delete_column', { schema: id, table: 'customers', column: 'id' })).json
    expect(g.relationships).toBe(1)
    expect((await call('delete_table', { schema: id, table: 'order_items' })).json.tables).toBe(2)
  })

  it('adds a schema to a deck as a slide with per-table reveal', async () => {
    const id = (await call('list_schemas')).json.schemas[0].id
    const deck = (await call('create_deck', { title: 'Schema talk' })).json.deck
    const r = await call('add_schema_slide', { deck, schema: id, reveal: 'one_by_one' })
    expect(r.error).toBe(false); expect(r.json.clicks).toBe(2)
    const s = (await call('get_slide', { deck, slide: r.json.number })).json
    expect(s.layout).toBe('schema'); expect(s.schema.tables.map((t: any) => t.reveal).sort()).toEqual([1, 2])
    expect((await call('get_deck', { deck })).json.slides[1]).toMatchObject({ layout: 'schema', elements: 2, clicks: 2 })
    const refused = await call('add_element', { deck, slide: r.json.number, element: { type: 'text', text: 'x' } })
    expect(refused.error).toBe(true); expect(refused.text).toContain('schema slide')
    expect((await call('add_schema_slide', { deck, schema: id, reveal: 'all' })).json.clicks).toBe(0)
  })

  it('delete_schema needs confirm', async () => {
    const id = (await call('create_schema', { name: 'Temp schema' })).json.schema
    const r: any = await client.callTool({ name: 'delete_schema', arguments: { schema: id } }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }))
    expect(r.isError).toBe(true)
    expect((await call('delete_schema', { schema: id, confirm: true })).error).toBe(false)
    expect((await call('get_schema', { schema: id })).error).toBe(true)
  })
})

describe('notes, layout check and canvas drawing tools', () => {
  it('sets speaker notes, finds overlaps, draws on a canvas slide', async () => {
    await call('create_deck', { id: 'extra', title: 'Extra' })
    await call('add_slide', { deck: 'extra', layout: 'content', title: 'T', elements: [
      { id: 'a', type: 'text', x: 100, y: 200, w: 600, h: 100, text: 'one', reveal: 0 }, { id: 'b', type: 'text', x: 150, y: 220, w: 600, h: 100, text: 'two', reveal: 1 }, { id: 'c', type: 'text', x: 1500, y: 800, w: 400, h: 100, text: 'off', reveal: 0 }] })
    const chk = await call('check_slide_layout', { deck: 'extra', slide: 2 })
    expect(chk.json.problems.length).toBe(2); expect(chk.json.problems.join()).toMatch(/overlaps/); expect(chk.json.problems.join()).toMatch(/sticks out/)
    expect((await call('set_speaker_notes', { deck: 'extra', slide: 2, notes: 'say hi' })).json.notes).toBe('say hi')
    expect((await call('get_slide', { deck: 'extra', slide: 2 })).json.notes).toBe('say hi')
    expect((await call('set_speaker_notes', { deck: 'extra', slide: 2, notes: '' })).json.notes).toBeNull()

    expect((await call('draw_on_canvas_slide', { deck: 'extra', slide: 2, shapes: [{ type: 'rectangle', x: 0, y: 0 }] })).error).toBe(true)
    await call('add_slide', { deck: 'extra', layout: 'canvas' })
    const r = await call('draw_on_canvas_slide', { deck: 'extra', slide: 3, shapes: [
      { type: 'rectangle', x: 100, y: 100, width: 220, height: 90, text: 'Client', fill: '#a5d8ff' }, { type: 'ellipse', x: 500, y: 100, width: 200, height: 90, text: 'API', click: 1 },
      { type: 'arrow', x: 320, y: 145, width: 180, height: 0, click: 1 }, { type: 'text', x: 100, y: 300, height: 40, text: 'Hello', click: 2 }] })
    expect(r.error).toBe(false); expect(r.json.clicks).toBe(2); expect(r.json.elements).toBe(6)
    const deck = await readDeck('extra'); const els = deck.slides[2].scene!.elements
    expect(els.filter((e: any) => e.type === 'text' && e.containerId).length).toBe(2)
    expect(els.find((e: any) => e.type === 'ellipse').customData.reveal).toBe(1)
    expect((await call('draw_on_canvas_slide', { deck: 'extra', slide: 3, replace: true, shapes: [{ type: 'diamond', x: 1, y: 1 }] })).json.elements).toBe(1)
  })
})
