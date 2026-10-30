import { describe, expect, it } from 'vitest'
import { connect, edgePoint, snap } from './geometry'

describe('geometry', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }
  const b = { x: 300, y: 0, w: 100, h: 50 }

  it('leaves the rect on the facing edge', () => {
    expect(edgePoint(a, { x: 350, y: 25 })).toEqual({ x: 100, y: 25 })
    expect(edgePoint(b, { x: 50, y: 25 })).toEqual({ x: 300, y: 25 })
  })

  it('connects horizontally neighbouring boxes edge to edge with a gap', () => {
    const { from, to } = connect(a, b, 4)
    expect(from).toEqual({ x: 104, y: 25 })
    expect(to).toEqual({ x: 296, y: 25 })
  })

  it('snaps to grid', () => {
    expect(snap(14)).toBe(10)
    expect(snap(16)).toBe(20)
  })
})
