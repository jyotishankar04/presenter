import { describe, expect, it } from 'vitest'
import { snapToGuides } from './guides'

describe('smart guides', () => {
  const other = { x: 100, y: 100, w: 200, h: 100 }
  it('aligns left edges, centres and right edges within the threshold', () => {
    expect(snapToGuides({ x: 104, y: 400, w: 150, h: 60 }, [other])).toMatchObject({ dx: -4, v: [100] })
    expect(snapToGuides({ x: 190, y: 400, w: 20, h: 60 }, [other])).toMatchObject({ dx: 0, v: [200] }) // centre to centre
    expect(snapToGuides({ x: 156, y: 400, w: 150, h: 60 }, [other]).dx).toBe(-6) // right edges 306 -> 300
  })
  it('aligns vertically too, and both axes at once', () => {
    const r = snapToGuides({ x: 103, y: 96, w: 50, h: 50 }, [other])
    expect(r).toMatchObject({ dx: -3, dy: 4 }); expect(r.v).toEqual([100]); expect(r.h).toEqual([100, 150]) // top edge and bottom edge both line up
  })
  it('does nothing when nothing is close; snaps to the slide centre', () => {
    expect(snapToGuides({ x: 500, y: 500, w: 40, h: 40 }, [other])).toMatchObject({ dx: 0, dy: 0, v: [], h: [] })
    expect(snapToGuides({ x: 776, y: 300, w: 50, h: 50 }, [])).toMatchObject({ dx: -1, v: [800] })
  })
})
