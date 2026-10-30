import type { FlowData } from './types'

/**
 * Copies the chosen nodes (new ids) plus the edges that connect two of them.
 * `at` puts the group's top-left corner there (menu paste); otherwise the copy is shifted by `offset`.
 */
export function cloneFlowSelection(flow: FlowData, ids: string[], offset: number, newId: () => string, at?: { x: number; y: number }): FlowData {
  const picked = flow.nodes.filter((n) => ids.includes(n.id))
  const map = new Map(picked.map((n) => [n.id, 'n' + newId()]))
  const minX = Math.min(...picked.map((n) => n.position.x)), minY = Math.min(...picked.map((n) => n.position.y))
  const nodes = picked.map((n) => ({
    ...structuredClone(n), id: map.get(n.id)!,
    position: at ? { x: Math.round(n.position.x - minX + at.x), y: Math.round(n.position.y - minY + at.y) } : { x: n.position.x + offset, y: n.position.y + offset },
  }))
  const edges = flow.edges.filter((e) => map.has(e.source) && map.has(e.target)).map((e) => ({ ...structuredClone(e), id: 'e' + newId(), source: map.get(e.source)!, target: map.get(e.target)! }))
  return { nodes, edges }
}
