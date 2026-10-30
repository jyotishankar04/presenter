import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { mountMcp } from '../mcp/http'
import { decksDir, deckRev, deleteDeck, deleteSchema, listDecks, listSchemas, readDeck, readSchema, safeId, schemaRev, StoreError, writeDeck, writeSchema } from './store'

const DECKS = decksDir()
const app = new Hono()


const fail = (e: unknown, c: any) => (e instanceof StoreError ? c.json({ error: e.message }, e.code === 'not-found' ? 404 : 400) : c.json({ error: 'server error' }, 500))

app.get('/api/decks', async (c) => c.json(await listDecks()))

app.get('/api/decks/:id', async (c) => {
  try { return c.json(await readDeck(c.req.param('id'))) } catch (e) { return fail(e, c) }
})

app.get('/api/decks/:id/rev', async (c) => {
  try { return c.json({ rev: await deckRev(c.req.param('id')) }) } catch (e) { return fail(e, c) }
})

app.put('/api/decks/:id', async (c) => {
  try {
    const deck = await c.req.json()
    if (deck?.id !== c.req.param('id')) return c.json({ error: 'invalid deck' }, 400)
    // Optimistic concurrency: refuse to overwrite a deck that changed since the client last read it.
    const base = c.req.header('x-base-rev')
    if (base) { const cur = await deckRev(deck.id); if (cur && cur !== base) return c.json({ error: 'conflict', rev: cur }, 409) }
    return c.json({ ok: true, rev: await writeDeck(deck) })
  } catch (e) { return fail(e, c) }
})

app.delete('/api/decks/:id', async (c) => {
  try { await deleteDeck(c.req.param('id')); return c.json({ ok: true }) } catch (e) { return fail(e, c) }
})

app.get('/api/schemas', async (c) => c.json(await listSchemas()))
app.get('/api/schemas/:id', async (c) => { try { return c.json(await readSchema(c.req.param('id'))) } catch (e) { return fail(e, c) } })
app.get('/api/schemas/:id/rev', async (c) => { try { return c.json({ rev: await schemaRev(c.req.param('id')) }) } catch (e) { return fail(e, c) } })
app.put('/api/schemas/:id', async (c) => {
  try {
    const schema = await c.req.json()
    if (schema?.id !== c.req.param('id')) return c.json({ error: 'invalid schema' }, 400)
    const base = c.req.header('x-base-rev')
    if (base) { const cur = await schemaRev(schema.id); if (cur && cur !== base) return c.json({ error: 'conflict', rev: cur }, 409) }
    return c.json({ ok: true, rev: await writeSchema(schema) })
  } catch (e) { return fail(e, c) }
})
app.delete('/api/schemas/:id', async (c) => { try { await deleteSchema(c.req.param('id')); return c.json({ ok: true }) } catch (e) { return fail(e, c) } })

// Image upload: stored under decks/assets/<deck>/ and served back at /api/assets/...
app.post('/api/assets/:deck', async (c) => {
  const deck = c.req.param('deck')
  if (!safeId(deck)) return c.json({ error: 'bad id' }, 400)
  const form = await c.req.formData()
  const f = form.get('file')
  if (!(f instanceof File)) return c.json({ error: 'no file' }, 400)
  const name = f.name.replace(/[^a-z0-9._-]/gi, '_')
  const dir = join(DECKS, 'assets', deck)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), Buffer.from(await f.arrayBuffer()))
  return c.json({ src: `/api/assets/${deck}/${name}` })
})

app.get('/api/assets/:deck/:name', async (c) => {
  const { deck, name } = c.req.param()
  if (!safeId(deck) || name.includes('/') || name.includes('..')) return c.json({ error: 'bad path' }, 400)
  try {
    const buf = await readFile(join(DECKS, 'assets', deck, name))
    const ext = name.split('.').pop()?.toLowerCase()
    const type = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    return new Response(buf, { headers: { 'content-type': type } })
  } catch {
    return c.json({ error: 'not found' }, 404)
  }
})

mountMcp(app)

// Local only: the API (and MCP endpoint) must not be reachable from other machines on the network.
serve({ fetch: app.fetch, port: 5174, hostname: '127.0.0.1' }, (i) => console.log(`api on http://127.0.0.1:${i.port}`))
