import { DIALECTS } from './types'

const DIAL = DIALECTS.map((d) => d.value as string)
const KINDS = ['1:1', '1:N', 'N:1']

/** Readable problem with a schema object, or null when valid. */
export function validateSchema(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'schema must be an object'
  const s = v as any
  if (typeof s.name !== 'string' || !s.name.trim()) return '"name" must be text'
  if (!DIAL.includes(s.dialect)) return `"dialect" must be one of ${DIAL.join(', ')}`
  if (!Array.isArray(s.tables)) return '"tables" must be a list'
  if (!Array.isArray(s.relationships)) return '"relationships" must be a list'
  const tids = new Set<string>(), names = new Set<string>(), cols = new Map<string, Set<string>>()
  for (const [i, t] of s.tables.entries()) {
    const at = `tables[${i}]`
    if (!t || typeof t !== 'object') return `${at} must be an object`
    if (typeof t.id !== 'string' || !t.id) return `${at} needs an "id"`
    if (tids.has(t.id)) return `${at}: duplicate id "${t.id}"`
    tids.add(t.id)
    if (typeof t.name !== 'string' || !t.name.trim()) return `${at}: "name" must be text`
    if (names.has(t.name.toLowerCase())) return `${at}: duplicate table name "${t.name}"`
    names.add(t.name.toLowerCase())
    if (typeof t.x !== 'number' || typeof t.y !== 'number') return `${at} ("${t.name}"): x and y must be numbers`
    if (!Array.isArray(t.columns)) return `${at} ("${t.name}"): "columns" must be a list`
    const cids = new Set<string>(), cnames = new Set<string>()
    for (const [j, c] of t.columns.entries()) {
      const cat = `${at}.columns[${j}] ("${t.name}")`
      if (!c || typeof c !== 'object') return `${cat} must be an object`
      if (typeof c.id !== 'string' || !c.id) return `${cat} needs an "id"`
      if (cids.has(c.id)) return `${cat}: duplicate id "${c.id}"`
      cids.add(c.id)
      if (typeof c.name !== 'string' || !c.name.trim()) return `${cat}: "name" must be text`
      if (cnames.has(c.name.toLowerCase())) return `${cat}: duplicate column name "${c.name}"`
      cnames.add(c.name.toLowerCase())
      if (typeof c.type !== 'string') return `${cat}: "type" must be text`
    }
    cols.set(t.id, cids)
    for (const [k, ix] of (t.indexes ?? []).entries()) {
      if (!ix || typeof ix.name !== 'string' || !Array.isArray(ix.columns) || !ix.columns.length) return `tables[${i}] ("${t.name}").indexes[${k}] needs a name and columns`
      for (const cid of ix.columns) if (!cids.has(cid)) return `tables[${i}] ("${t.name}").indexes[${k}]: column "${cid}" does not exist`
    }
  }
  const rids = new Set<string>()
  for (const [i, r] of s.relationships.entries()) {
    const at = `relationships[${i}]`
    if (!r || typeof r !== 'object') return `${at} must be an object`
    if (typeof r.id !== 'string' || rids.has(r.id)) return `${at} needs a unique "id"`
    rids.add(r.id)
    if (!KINDS.includes(r.kind)) return `${at}: "kind" must be one of ${KINDS.join(', ')}`
    for (const side of ['from', 'to'] as const) {
      const e = r[side]
      if (!e || !tids.has(e.table)) return `${at}.${side}: table "${e?.table}" does not exist`
      if (!cols.get(e.table)!.has(e.column)) return `${at}.${side}: column "${e.column}" does not exist in that table`
    }
  }
  return null
}
