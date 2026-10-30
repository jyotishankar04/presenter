import type { FlowData, FlowEdge } from './types'

export const nodeReveal = (n: FlowData['nodes'][number]) => n.data.reveal ?? 0

/** An edge appears with the later of its own step and both of its nodes, so you only order the nodes. */
export function edgeReveal(e: FlowEdge, flow: FlowData): number {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  const a = byId.get(e.source), b = byId.get(e.target)
  return Math.max(e.data?.reveal ?? 0, a ? nodeReveal(a) : 0, b ? nodeReveal(b) : 0)
}

export function flowSteps(flow?: FlowData): number {
  if (!flow) return 0
  let max = 0
  for (const n of flow.nodes) max = Math.max(max, nodeReveal(n))
  for (const e of flow.edges) max = Math.max(max, e.data?.reveal ?? 0)
  return max
}
