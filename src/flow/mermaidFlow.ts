import type { Accent } from '../model/types'
import { layoutFlow } from './layout'
import { parseMermaidFlow } from './mermaid'
import { defaultSize, type FlowData, type FlowDirection, type FlowNode } from './types'

const ACCENTS: Accent[] = ['amber', 'blue', 'green', 'ink', 'red']

/** Mermaid flowchart text -> a laid-out flow graph (same shapes, labels and direction). Throws a readable Error. */
export function mermaidToFlow(code: string): { flow: FlowData; direction: FlowDirection } {
  const m = parseMermaidFlow(code)
  const nodes: FlowNode[] = m.nodes.map((n, i) => ({
    id: n.id, type: n.shape, position: { x: 0, y: 0 }, style: defaultSize(n.shape, n.label),
    data: { label: n.label, accent: n.shape === 'decision' ? 'amber' : n.shape === 'database' ? 'green' : ACCENTS[i % ACCENTS.length], reveal: 0 },
  }))
  const edges = m.edges.map((e, i) => ({ id: `e${i}-${e.from}-${e.to}`, source: e.from, target: e.to, ...(e.label ? { label: e.label } : {}), data: { accent: 'ink' as Accent, reveal: 0, ...(e.dashed ? { dashed: true } : {}) } }))
  return { flow: layoutFlow({ nodes, edges }, m.direction), direction: m.direction }
}
