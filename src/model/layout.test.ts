import { describe, expect, it } from 'vitest'
import { layoutDiagram, levels } from './layout'
import type { BoxEl } from './types'

const n = (id: string) => ({ id, label: id.toUpperCase() })
const nodes = ['client', 'lb', 's1', 's2', 'db'].map(n)
const edges = [{ from: 'client', to: 'lb' }, { from: 'lb', to: 's1' }, { from: 'lb', to: 's2' }, { from: 's1', to: 'db' }, { from: 's2', to: 'db' }]

describe('diagram layout', () => {
  it('assigns columns by longest path', () => {
    const l = levels(nodes, edges)
    expect([...l.entries()]).toEqual([['client', 0], ['lb', 1], ['s1', 2], ['s2', 2], ['db', 3]])
  })
  it('survives cycles and unknown ids', () => {
    const l = levels([n('a'), n('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'a', to: 'ghost' }])
    expect(l.size).toBe(2)
    expect(layoutDiagram([n('a'), n('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'a', to: 'ghost' }]).filter((e) => e.type === 'arrow').length).toBe(2)
  })
  it('places boxes left to right without overlapping and inside the stage', () => {
    const boxes = layoutDiagram(nodes, edges).filter((e): e is BoxEl => e.type === 'box')
    for (const a of boxes) {
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x + a.w).toBeLessThanOrEqual(1600); expect(a.y + a.h).toBeLessThanOrEqual(900)
      for (const b of boxes) if (a !== b) expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false)
    }
    expect(boxes.find((b) => b.id === 'client')!.x).toBeLessThan(boxes.find((b) => b.id === 'db')!.x)
  })
  it('reveal modes', () => {
    const rev = (mode: any) => Object.fromEntries(layoutDiagram(nodes, edges, mode).filter((e) => e.type === 'box').map((e) => [e.id, e.reveal]))
    expect(rev('level')).toEqual({ client: 1, lb: 2, s1: 3, s2: 3, db: 4 })
    expect(rev('node')).toEqual({ client: 1, lb: 2, s1: 3, s2: 4, db: 5 })
    expect(Object.values(rev('none')).every((r) => r === 0)).toBe(true)
  })
  it('arrows appear with their later endpoint', () => {
    const arrow = layoutDiagram(nodes, edges).find((e) => e.id === 'e-s1-db')!
    expect(arrow.reveal).toBe(4)
  })
  it('handles one lonely node and 12 nodes in one column', () => {
    expect(layoutDiagram([n('a')], [])).toHaveLength(1)
    const many = Array.from({ length: 12 }, (_, i) => n('n' + i))
    const boxes = layoutDiagram(many, []).filter((e): e is BoxEl => e.type === 'box')
    expect(Math.max(...boxes.map((b) => b.y + b.h))).toBeLessThanOrEqual(900)
  })

  it('sizes boxes to their labels and keeps room for arrows between columns', () => {
    const long = layoutDiagram([n('a'), { id: 'b', label: 'Requirements: what', icon: 'X' }, n('c')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]).filter((e): e is BoxEl => e.type === 'box')
    expect(long.find((b) => b.id === 'b')!.w).toBeGreaterThan(300)
    const five = layoutDiagram(nodes, edges).filter((e): e is BoxEl => e.type === 'box')
    const byX = [...five].sort((a, b) => a.x - b.x)
    for (let i = 1; i < byX.length; i++) if (byX[i].x !== byX[i - 1].x) expect(byX[i].x - (byX[i - 1].x + byX[i - 1].w)).toBeGreaterThanOrEqual(70)
    for (const b of [...long, ...five]) { expect(b.x).toBeGreaterThanOrEqual(40); expect(b.x + b.w).toBeLessThanOrEqual(1560) }
  })
})
