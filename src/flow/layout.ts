import dagre from '@dagrejs/dagre'
import { defaultSize, type FlowData, type FlowDirection, type FlowEdge, type FlowNode } from './types'

const sizeOf = (n: FlowNode) => n.style ?? defaultSize(n.type, n.data.label, !!n.data.icon)

/** Handle ids so edges leave/enter on the side that faces the flow direction. */
export const handlesFor = (dir: FlowDirection) => (dir === 'LR' ? { sourceHandle: 'r', targetHandle: 'l' } : { sourceHandle: 'b', targetHandle: 't' })

/**
 * Positions nodes with dagre (layered graph layout) and points every edge's handles along the direction.
 * Returns new nodes/edges; the inputs are not modified. Sizes are filled in when missing.
 */
export function layoutFlow(flow: FlowData, dir: FlowDirection = 'LR'): FlowData {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: dir, nodesep: dir === 'LR' ? 70 : 80, edgesep: 90, ranksep: dir === 'LR' ? 120 : 100, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(flow.nodes.map((n) => n.id))
  for (const n of flow.nodes) g.setNode(n.id, sizeOf(n))
  for (const e of flow.edges) if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) g.setEdge(e.source, e.target)
  dagre.layout(g)

  const nodes = flow.nodes.map((n) => {
    const { x, y } = g.node(n.id)
    const { width, height } = sizeOf(n)
    return { ...n, style: { width, height }, position: { x: Math.round(x - width / 2), y: Math.round(y - height / 2) } }
  })
  const h = handlesFor(dir)
  const edges = flow.edges.map((e): FlowEdge => ({ ...e, ...h }))
  return { nodes, edges }
}

/** Auto reveal: one click per layer (column/row) or per node, in layout order. */
export function autoReveal(flow: FlowData, mode: 'level' | 'node' | 'none', dir: FlowDirection = 'LR'): FlowData {
  if (mode === 'none') return { ...flow, nodes: flow.nodes.map((n) => ({ ...n, data: { ...n.data, reveal: 0 } })) }
  const axis = dir === 'LR' ? 'x' : 'y'
  const order = [...flow.nodes].sort((a, b) => a.position[axis] - b.position[axis] || a.position.x - b.position.x || a.position.y - b.position.y)
  const level = new Map<string, number>()
  let click = 0, last = -Infinity
  for (const n of order) {
    if (mode === 'node') { click++; level.set(n.id, click); continue }
    if (n.position[axis] - last > 5) { click++; last = n.position[axis] }
    level.set(n.id, click)
  }
  return { ...flow, nodes: flow.nodes.map((n) => ({ ...n, data: { ...n.data, reveal: level.get(n.id)! } })) }
}
