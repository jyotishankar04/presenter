import { describe, expect, it } from 'vitest'
import { autoReveal, layoutFlow } from './layout'
import { edgeReveal, flowSteps } from './reveal'
import type { FlowData, FlowNode } from './types'

const node = (id: string, shape: FlowNode['type'] = 'box', label = id): FlowNode => ({ id, type: shape, position: { x: 0, y: 0 }, data: { label, accent: 'blue', reveal: 0 } })
const flow: FlowData = {
  nodes: [node('a'), node('b', 'decision', 'ok?'), node('c'), node('d', 'database', 'DB')],
  edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c', label: 'yes' }, { id: 'e3', source: 'b', target: 'd', label: 'no' }],
}

describe('flow layout', () => {
  it('lays out left to right without overlaps and fills sizes', () => {
    const out = layoutFlow(flow, 'LR')
    const x = Object.fromEntries(out.nodes.map((n) => [n.id, n.position.x]))
    expect(x.a).toBeLessThan(x.b); expect(x.b).toBeLessThan(x.c)
    for (const a of out.nodes) for (const b of out.nodes) if (a !== b) {
      const A = { ...a.position, ...a.style! }, B = { ...b.position, ...b.style! }
      expect(A.x < B.x + B.width && A.x + A.width > B.x && A.y < B.y + B.height && A.y + A.height > B.y).toBe(false)
    }
    expect(out.edges.every((e) => e.sourceHandle === 'r' && e.targetHandle === 'l')).toBe(true)
  })
  it('top-to-bottom direction flows downwards with b/t handles', () => {
    const out = layoutFlow(flow, 'TB')
    const y = Object.fromEntries(out.nodes.map((n) => [n.id, n.position.y]))
    expect(y.a).toBeLessThan(y.b); expect(y.b).toBeLessThan(y.c)
    expect(out.edges[0]).toMatchObject({ sourceHandle: 'b', targetHandle: 't' })
  })
  it('does not mutate its input and tolerates cycles / unknown ids', () => {
    const before = JSON.stringify(flow)
    layoutFlow(flow); expect(JSON.stringify(flow)).toBe(before)
    const cyc: FlowData = { nodes: [node('a'), node('b')], edges: [{ id: '1', source: 'a', target: 'b' }, { id: '2', source: 'b', target: 'a' }, { id: '3', source: 'a', target: 'ghost' }] }
    expect(layoutFlow(cyc).nodes).toHaveLength(2)
  })
  it('auto reveal by level groups nodes of the same column', () => {
    const lv = autoReveal(layoutFlow(flow, 'LR'), 'level', 'LR')
    const r = Object.fromEntries(lv.nodes.map((n) => [n.id, n.data.reveal]))
    expect(r.a).toBe(1); expect(r.b).toBe(2); expect(r.c).toBe(3); expect(r.d).toBe(3)
    expect(Object.values(autoReveal(flow, 'node').nodes.map((n) => n.data.reveal)).sort()).toEqual([1, 2, 3, 4])
    expect(autoReveal(flow, 'none').nodes.every((n) => n.data.reveal === 0)).toBe(true)
  })
})

describe('flow reveal', () => {
  it('edges wait for both nodes; step count covers nodes and edges', () => {
    const f: FlowData = { nodes: [{ ...node('a'), data: { label: 'a', accent: 'blue', reveal: 1 } }, { ...node('b'), data: { label: 'b', accent: 'blue', reveal: 3 } }], edges: [{ id: 'e', source: 'a', target: 'b', data: { accent: 'ink', reveal: 0 } }] }
    expect(edgeReveal(f.edges[0], f)).toBe(3)
    expect(flowSteps(f)).toBe(3)
    expect(flowSteps(undefined)).toBe(0)
  })
})
