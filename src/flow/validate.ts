import { FLOW_SHAPES } from './types'

const ACCENTS = ['amber', 'blue', 'green', 'red', 'ink', 'muted']
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** Human-readable problem with a flow graph, or null when it is valid. */
export function validateFlow(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'flow must be an object { nodes, edges }'
  const f = v as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(f.nodes)) return '"nodes" must be a list'
  if (!Array.isArray(f.edges)) return '"edges" must be a list'
  const ids = new Set<string>()
  for (const [i, n] of f.nodes.entries()) {
    const at = `nodes[${i}]`
    if (!n || typeof n !== 'object') return `${at} must be an object`
    if (typeof n.id !== 'string' || !n.id) return `${at} needs a text "id"`
    if (ids.has(n.id)) return `${at}: duplicate id "${n.id}"`
    ids.add(n.id)
    if (!FLOW_SHAPES.includes(n.type)) return `${at}: type must be one of ${FLOW_SHAPES.join(', ')}`
    if (!n.position || !isNum(n.position.x) || !isNum(n.position.y)) return `${at}: position needs numeric x and y`
    if (!n.data || typeof n.data.label !== 'string') return `${at}: data.label must be text`
    if (!ACCENTS.includes(n.data.accent)) return `${at}: data.accent must be one of ${ACCENTS.join(', ')}`
    if (!Number.isInteger(n.data.reveal) || n.data.reveal < 0) return `${at}: data.reveal must be a whole number, 0 or more`
  }
  const eids = new Set<string>()
  for (const [i, e] of f.edges.entries()) {
    const at = `edges[${i}]`
    if (!e || typeof e !== 'object') return `${at} must be an object`
    if (typeof e.id !== 'string' || !e.id) return `${at} needs a text "id"`
    if (eids.has(e.id)) return `${at}: duplicate id "${e.id}"`
    eids.add(e.id)
    for (const k of ['source', 'target'] as const) if (!ids.has(e[k])) return `${at}: "${k}" points at "${e[k]}", which is not a node id`
  }
  return null
}
