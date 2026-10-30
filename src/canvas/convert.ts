import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { connect } from '../model/geometry'
import type { Accent, El, Scene, Slide } from '../model/types'

const COLOR: Record<Accent, string> = { amber: '#d9930d', blue: '#4a6cf7', green: '#1f7a52', red: '#ef5b3f', ink: '#2a2622', muted: '#a89f91' }
const FONT: Record<string, number> = { hand: 1, sans: 2, serif: 2, mono: 3 }

/** Turns an older fixed-layout slide into free Excalidraw shapes, keeping each piece's reveal step. */
export async function legacyToScene(slide: Slide): Promise<Scene> {
  const skel: any[] = []
  const reveal = new Map<string, number>()
  const add = (s: any, r: number) => { skel.push(s); reveal.set(s.id, r) }
  let n = 0
  const id = (p: string) => `${slide.id}-${p}-${n++}`

  if (slide.layout === 'section') {
    if (slide.eyebrow) add({ id: id('eb'), type: 'text', x: 200, y: 330, text: slide.eyebrow.toUpperCase(), fontSize: 24, strokeColor: '#4a6cf7', fontFamily: 3 }, 0)
    add({ id: id('t'), type: 'text', x: 200, y: 380, text: slide.title ?? '', fontSize: 72, strokeColor: '#2a2622', fontFamily: 1 }, 0)
    add({ id: id('u'), type: 'line', x: 200, y: 480, points: [[0, 0], [620, 4]], strokeColor: '#4a6cf7', strokeWidth: 4 }, 0)
  } else if (slide.title) {
    add({ id: id('t'), type: 'text', x: 100, y: 50, text: slide.title, fontSize: 48, strokeColor: '#2a2622', fontFamily: 1 }, 0)
  }

  const boxes = new Map<string, El>()
  for (const el of slide.elements) if (el.type === 'box') boxes.set(el.id, el)
  const rectOf = (e: El) => ({ x: e.x, y: e.y, w: e.w, h: e.h })

  for (const el of slide.elements) {
    switch (el.type) {
      case 'text':
        add({ id: el.id, type: 'text', x: el.x, y: el.y, text: el.text, fontSize: Math.round(el.size * 0.8), strokeColor: COLOR[el.accent], fontFamily: FONT[el.style] ?? 1 }, el.reveal)
        break
      case 'box':
        add({ id: el.id, type: 'rectangle', x: el.x, y: el.y, width: el.w, height: el.h, strokeColor: COLOR[el.accent], strokeWidth: 3, roughness: 1,
          label: { text: el.label, fontSize: 26, strokeColor: COLOR[el.accent] } }, el.reveal)
        break
      case 'arrow': {
        const a = boxes.get(el.from), b = boxes.get(el.to)
        if (!a || !b) break
        const { from, to } = connect(rectOf(a), rectOf(b), 2)
        add({ id: el.id, type: 'arrow', x: from.x, y: from.y, points: [[0, 0], [to.x - from.x, to.y - from.y]], strokeColor: COLOR[el.accent], strokeWidth: 3,
          start: { id: el.from }, end: { id: el.to } }, el.reveal)
        break
      }
      case 'cardList':
        add({ id: id('h'), type: 'text', x: el.x, y: el.y, text: el.header.toUpperCase(), fontSize: 22, strokeColor: COLOR[el.accent], fontFamily: 2 }, el.reveal)
        add({ id: id('hl'), type: 'line', x: el.x, y: el.y + 34, points: [[0, 0], [el.w, 0]], strokeColor: COLOR[el.accent], strokeWidth: 3 }, el.reveal)
        el.cards.forEach((c, i) => add({ id: id('c'), type: 'rectangle', x: el.x, y: el.y + 60 + i * 100, width: el.w, height: 80, strokeColor: '#cfc8bb', roughness: 1,
          label: { text: c.text, fontSize: 28, strokeColor: '#2a2622' } }, c.reveal))
        break
      case 'strike': {
        const y = el.y
        add({ id: id('w'), type: 'text', x: el.x + 120, y, text: el.wrong, fontSize: 40, strokeColor: '#8a8072', fontFamily: 2 }, el.reveal)
        add({ id: id('wl'), type: 'line', x: el.x + 120, y: y + 24, points: [[0, 0], [el.wrong.length * 21, 0]], strokeColor: '#ef5b3f', strokeWidth: 4 }, el.reveal)
        add({ id: id('r'), type: 'text', x: el.x + 120 + el.wrong.length * 21 + 120, y, text: el.right, fontSize: 40, strokeColor: '#4a6cf7', fontFamily: 2 }, el.reveal)
        break
      }
      case 'sequence': {
        const colW = el.w / el.actors.length
        const cx = (i: number) => el.x + colW * i + colW / 2
        el.actors.forEach((a, i) => {
          add({ id: id('a'), type: 'rectangle', x: cx(i) - 70, y: el.y, width: 140, height: 44, strokeColor: '#2a2622', roughness: 1, label: { text: a, fontSize: 20, strokeColor: '#2a2622' } }, el.reveal)
          add({ id: id('l'), type: 'line', x: cx(i), y: el.y + 44, points: [[0, 0], [0, el.h - 44]], strokeColor: '#a89f91', strokeStyle: 'dashed', strokeWidth: 2 }, el.reveal)
        })
        const rowH = (el.h - 90) / Math.max(el.messages.length, 1)
        el.messages.forEach((m, i) => {
          const y = el.y + 70 + rowH * i + rowH / 2
          const col = m.kind === 'request' ? '#4a6cf7' : '#1f7a52'
          add({ id: id('m'), type: 'arrow', x: cx(m.from), y, points: [[0, 0], [cx(m.to) - cx(m.from), 0]], strokeColor: col, strokeWidth: 3 }, m.reveal)
          add({ id: id('mt'), type: 'text', x: Math.min(cx(m.from), cx(m.to)) + 14, y: y - 30, text: m.text, fontSize: 20, strokeColor: '#2a2622', fontFamily: 3 }, m.reveal)
        })
        break
      }
      case 'code':
        add({ id: el.id, type: 'text', x: el.x, y: el.y, text: el.code, fontSize: Math.round(el.size * 0.8), strokeColor: '#2a2622', fontFamily: 3 }, el.reveal)
        break
      default:
        break // demo / image / mermaid handled below or dropped
    }
  }

  const out: any[] = convertToExcalidrawElements(skel as any)
  const byId = new Map(out.map((e) => [e.id, e]))
  for (const e of out) {
    const r = reveal.get(e.id) ?? (e.containerId ? reveal.get(e.containerId) : undefined) ?? 0
    e.customData = { ...e.customData, reveal: r }
    void byId
  }
  // text is measured before the hand-drawn font has loaded, so give free text a generous box
  for (const e of out) if (e.type === 'text' && !e.containerId) {
    const longest = Math.max(...String(e.text).split('\n').map((l) => l.length))
    e.width = Math.max(e.width, longest * e.fontSize * (e.fontFamily === 3 ? 0.62 : 0.58))
  }
  // bound labels inherit their container's step
  for (const e of out) if (e.containerId) e.customData = { reveal: byId.get(e.containerId)?.customData?.reveal ?? 0 }

  for (const el of slide.elements) {
    if (el.type !== 'mermaid') continue
    try {
      const parsed = await parseMermaidToExcalidraw(el.code, { themeVariables: { fontSize: '20px' } })
      const els: any[] = convertToExcalidrawElements(parsed.elements as any, { regenerateIds: true })
      const x1 = Math.min(...els.map((e) => e.x)), y1 = Math.min(...els.map((e) => e.y))
      for (const e of els) { e.x += el.x - x1; e.y += el.y - y1; e.customData = { reveal: el.reveal } }
      out.push(...els)
    } catch { /* leave it out rather than fail the whole conversion */ }
  }
  return { elements: out, files: {} }
}
