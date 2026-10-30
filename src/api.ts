import { isThemeId } from './model/themes'
import type { Deck } from './model/types'
import type { Schema } from './schema/types'

export interface DeckInfo { id: string; title: string; theme: string; slides: number }

export class ConflictError extends Error {}

async function json<T>(r: Response): Promise<T> {
  if (r.status === 409) throw new ConflictError('conflict')
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export const api = {
  list: () => fetch('/api/decks').then((r) => json<DeckInfo[]>(r)),
  /** Decks written by older versions or by hand may carry an unknown theme id; those render as neutral dark. */
  get: (id: string) => fetch(`/api/decks/${id}`).then((r) => json<Deck>(r)).then((d) => (isThemeId(d.theme) ? d : { ...d, theme: 'dark' as const })),
  /** Pass baseRev to refuse overwriting a newer version (throws ConflictError). */
  save: (deck: Deck, baseRev?: string | null) =>
    fetch(`/api/decks/${deck.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(baseRev ? { 'x-base-rev': baseRev } : {}) }, body: JSON.stringify(deck) }).then((r) => json<{ ok: true; rev: string }>(r)),
  rev: (id: string) => fetch(`/api/decks/${id}/rev`).then((r) => json<{ rev: string | null }>(r)),
  remove: (id: string) => fetch(`/api/decks/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r)),
  upload: async (deckId: string, file: File) => {
    const f = new FormData()
    f.append('file', file)
    return json<{ src: string }>(await fetch(`/api/assets/${deckId}`, { method: 'POST', body: f }))
  },
}

export interface SchemaInfo { id: string; name: string; dialect: string; tables: number; relationships: number }

export const schemaApi = {
  list: () => fetch('/api/schemas').then((r) => json<SchemaInfo[]>(r)),
  get: (id: string) => fetch(`/api/schemas/${id}`).then((r) => json<Schema>(r)),
  save: (s: Schema, baseRev?: string | null) =>
    fetch(`/api/schemas/${s.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(baseRev ? { 'x-base-rev': baseRev } : {}) }, body: JSON.stringify(s) }).then((r) => json<{ ok: true; rev: string }>(r)),
  rev: (id: string) => fetch(`/api/schemas/${id}/rev`).then((r) => json<{ rev: string | null }>(r)),
  remove: (id: string) => fetch(`/api/schemas/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r)),
}
