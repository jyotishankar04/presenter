import { defaultElement } from './model/defaults'
import type { Slide, TextEl } from './model/types'

export interface OutlineOptions {
  /** true: each top-level bullet appears on its own click; false: everything is visible at once. */
  stepByStep: boolean
}

const BULLET = /^(?:[-*•–]|\d+[.)])\s+/
const uid = () => Math.random().toString(36).slice(2, 8)

interface Block { title: string; section: boolean; bullets: { text: string; depth: number }[] }

/** Splits an indented outline into slide blocks. */
export function parseOutline(src: string): Block[] {
  const blocks: Block[] = []
  let cur: Block | null = null
  for (const raw of src.replace(/\t/g, '    ').split(/\r?\n/)) {
    if (!raw.trim()) continue
    const indent = raw.length - raw.trimStart().length
    const line = raw.trim()
    if (indent === 0 && line.startsWith('>') && cur) {
      cur.bullets.push({ text: line.replace(/^>\s*/, ''), depth: 0 }) // "> Part 1" under a # title = its eyebrow
    } else if (indent === 0 && !BULLET.test(line)) {
      const section = /^#+\s+/.test(line)
      cur = { title: line.replace(/^#+\s+/, ''), section, bullets: [] }
      blocks.push(cur)
    } else if (cur) {
      cur.bullets.push({ text: line.replace(BULLET, ''), depth: Math.min(2, Math.floor(indent / 4)) })
    } else {
      cur = { title: line.replace(BULLET, ''), section: false, bullets: [] }
      blocks.push(cur)
    }
  }
  return blocks
}

/**
 * Turns an outline into slides. A line at the left edge is a slide title ("# Title" makes a big section slide);
 * indented lines become bullets. Deeper-indented bullets stay on the same click as the bullet above.
 */
export function outlineToSlides(src: string, opt: OutlineOptions = { stepByStep: true }): Slide[] {
  return parseOutline(src).map((b): Slide => {
    if (b.section) return { id: uid(), layout: 'section', title: b.title, ...(b.bullets[0] ? { eyebrow: b.bullets[0].text } : {}), elements: [] }
    // group nested bullets under their top-level bullet
    const groups: { lines: { text: string; depth: number }[] }[] = []
    for (const bl of b.bullets) {
      if (bl.depth === 0 || !groups.length) groups.push({ lines: [bl] })
      else groups[groups.length - 1].lines.push(bl)
    }
    const count = groups.length
    const size = count > 7 ? 32 : count > 5 ? 38 : 44
    const gap = Math.min(150, Math.floor(620 / Math.max(count, 1)))
    let y = 210
    const elements = groups.map((g, i) => {
      const text = g.lines.map((l) => `${'    '.repeat(l.depth)}${l.depth ? '– ' : '•  '}${l.text}`).join('\n')
      const el = { ...defaultElement('text', uid(), opt.stepByStep ? i + 1 : 0), x: 130, y, w: 1340, h: Math.max(gap - 20, 60) * 1, text, size, style: 'sans', accent: 'ink', align: 'left' } as TextEl
      y += g.lines.length > 1 ? gap + (g.lines.length - 1) * Math.round(size * 1.3) : gap
      return el
    })
    return { id: uid(), layout: 'content', title: b.title, elements }
  })
}

export const OUTLINE_SAMPLE = `# What is system design?
> Part 1

Why we plan first
  - Requirements say what to build
  - High-level design says where things go
  - Low-level design says how each piece works

The three questions
  - How many users?
  - How fast must it be?
      - under 100 ms for redirects
  - What happens when it fails?
`
