import { describe, expect, it } from 'vitest'
import { cloneFlowSelection } from './clone'
import type { FlowData } from './types'

const n = (id: string, x: number, y: number) => ({ id, type: 'box' as const, position: { x, y }, data: { label: id, accent: 'blue' as const, reveal: 0 } })
const flow: FlowData = { nodes: [n('a', 100, 100), n('b', 400, 100), n('c', 700, 100)], edges: [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }] }

describe('flow clone', () => {
  it('copies selected nodes with new ids and keeps only edges between them', () => {
    let i = 0
    const out = cloneFlowSelection(flow, ['a', 'b'], 40, () => String(i++))
    expect(out.nodes.map((x) => x.id)).toEqual(['n0', 'n1'])
    expect(out.edges).toHaveLength(1)
    expect(out.edges[0]).toMatchObject({ source: 'n0', target: 'n1' })
    expect(out.nodes[0].position).toEqual({ x: 140, y: 140 })
    expect(flow.nodes[0].position).toEqual({ x: 100, y: 100 })
  })
  it('places the group top-left at a given point', () => {
    const out = cloneFlowSelection(flow, ['b', 'c'], 0, () => 'x', { x: 10, y: 20 })
    expect(out.nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(out.nodes[1].position).toEqual({ x: 310, y: 20 })
  })
})
