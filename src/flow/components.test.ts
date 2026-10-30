import { icons } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { searchIcons } from '../components/IconPicker'
import { COMPONENTS } from './components'
import { FLOW_SHAPES } from './types'

describe('component library + icon search', () => {
  it('every preset uses a real lucide icon, a valid shape and a unique id', () => {
    expect(new Set(COMPONENTS.map((c) => c.id)).size).toBe(COMPONENTS.length)
    for (const c of COMPONENTS) { expect(FLOW_SHAPES, c.id).toContain(c.shape); if (c.icon) expect(c.icon in icons, `${c.id}: ${c.icon}`).toBe(true) }
  })
  it('icon search ranks prefix matches first and ignores spaces/case', () => {
    expect(searchIcons('').length).toBeGreaterThan(20)
    const r = searchIcons('hard drive'); expect(r[0]).toBe('HardDrive')
    expect(searchIcons('DATAbase')[0]).toBe('Database')
    expect(searchIcons('zzzzqqq')).toEqual([])
    expect(searchIcons('a', 20).length).toBe(20)
  })
})
