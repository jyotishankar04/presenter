import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Deck } from '../src/model/types'
import type { Schema } from '../src/schema/types'

export class StoreError extends Error {
  constructor(public code: 'bad-id' | 'not-found' | 'invalid' | 'exists', message: string) { super(message) }
}

export const decksDir = () => resolve(process.env.PRESENTER_DECKS ?? 'decks')
export const safeId = (id: string) => /^[a-z0-9][a-z0-9-_]*$/i.test(id)
const fileOf = (id: string) => {
  if (!safeId(id)) throw new StoreError('bad-id', `"${id}" is not a valid deck id (letters, numbers, - and _ only)`)
  return join(decksDir(), `${id}.json`)
}

/** Changes whenever the deck file changes; the editor polls this to notice edits made elsewhere. */
export async function deckRev(id: string): Promise<string | null> {
  try { const s = await stat(fileOf(id)); return `${Math.round(s.mtimeMs)}-${s.size}` } catch (e) { if (e instanceof StoreError) throw e; return null }
}

export async function listDecks() {
  await mkdir(decksDir(), { recursive: true })
  const names = (await readdir(decksDir())).filter((n) => n.endsWith('.json'))
  const out: { id: string; title: string; theme: string; slides: number }[] = []
  for (const n of names) {
    try {
      const d = JSON.parse(await readFile(join(decksDir(), n), 'utf8')) as Deck
      out.push({ id: d.id, title: d.title, theme: d.theme, slides: d.slides.length })
    } catch { /* skip unreadable files */ }
  }
  return out
}

export async function readDeck(id: string): Promise<Deck> {
  try { return JSON.parse(await readFile(fileOf(id), 'utf8')) as Deck } catch (e) {
    if (e instanceof StoreError) throw e
    throw new StoreError('not-found', `No deck with id "${id}"`)
  }
}

/** Atomic write (temp file + rename) so a reader never sees half a deck. Returns the new revision. */
export async function writeDeck(deck: Deck): Promise<string> {
  if (!deck || typeof deck.id !== 'string' || !Array.isArray(deck.slides)) throw new StoreError('invalid', 'Not a deck')
  const file = fileOf(deck.id)
  await mkdir(decksDir(), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, JSON.stringify(deck, null, 2))
  await rename(tmp, file)
  return (await deckRev(deck.id))!
}

export async function deleteDeck(id: string) { await rm(fileOf(id), { force: true }) }
export const deckExists = async (id: string) => (await deckRev(id)) !== null


// ---------------- schemas (same storage rules as decks, separate folder) ----------------
export const schemasDir = () => resolve(process.env.PRESENTER_SCHEMAS ?? 'schemas')
const schemaFile = (id: string) => {
  if (!safeId(id)) throw new StoreError('bad-id', `"${id}" is not a valid schema id (letters, numbers, - and _ only)`)
  return join(schemasDir(), `${id}.json`)
}

export async function schemaRev(id: string): Promise<string | null> {
  try { const s = await stat(schemaFile(id)); return `${Math.round(s.mtimeMs)}-${s.size}` } catch (e) { if (e instanceof StoreError) throw e; return null }
}

export async function listSchemas() {
  await mkdir(schemasDir(), { recursive: true })
  const out: { id: string; name: string; dialect: string; tables: number; relationships: number }[] = []
  for (const n of (await readdir(schemasDir())).filter((x) => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(await readFile(join(schemasDir(), n), 'utf8')) as Schema
      out.push({ id: d.id, name: d.name, dialect: d.dialect, tables: d.tables.length, relationships: d.relationships.length })
    } catch { /* skip unreadable files */ }
  }
  return out
}

export async function readSchema(id: string): Promise<Schema> {
  try { return JSON.parse(await readFile(schemaFile(id), 'utf8')) as Schema } catch (e) {
    if (e instanceof StoreError) throw e
    throw new StoreError('not-found', `No schema with id "${id}"`)
  }
}

export async function writeSchema(schema: Schema): Promise<string> {
  if (!schema || typeof schema.id !== 'string' || !Array.isArray(schema.tables) || !Array.isArray(schema.relationships)) throw new StoreError('invalid', 'Not a schema')
  const file = schemaFile(schema.id)
  await mkdir(schemasDir(), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, JSON.stringify(schema, null, 2))
  await rename(tmp, file)
  return (await schemaRev(schema.id))!
}

export async function deleteSchema(id: string) { await rm(schemaFile(id), { force: true }) }
export const schemaExists = async (id: string) => (await schemaRev(id)) !== null
