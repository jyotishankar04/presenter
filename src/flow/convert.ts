import type { El, Slide } from '../model/types'
import { defaultSize, type FlowData, type FlowEdge, type FlowNode } from './types'

/** Picks handles so the edge leaves/enters on the sides that face each other. */
export function facingHandles(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2)
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? { sourceHandle: 'r', targetHandle: 'l' } : { sourceHandle: 'l', targetHandle: 'r' })
    : (dy >= 0 ? { sourceHandle: 'b', targetHandle: 't' } : { sourceHandle: 't', targetHandle: 'b' })
}

/** Turns the boxes, arrows and text of a normal slide into a flow diagram, keeping positions and reveal steps. */
export function legacyToFlow(slide: Slide): { flow: FlowData; skipped: number } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const boxes = new Map<string, El & { type: 'box' }>()
  let skipped = 0
  for (const el of slide.elements) {
    if (el.type === 'box') {
      boxes.set(el.id, el)
      nodes.push({ id: el.id, type: 'box', position: { x: el.x, y: el.y }, style: { width: el.w, height: el.h }, data: { label: el.label, icon: el.icon, accent: el.accent, muted: el.muted, reveal: el.reveal } })
    } else if (el.type === 'text') {
      const size = defaultSize('note', el.text)
      nodes.push({ id: el.id, type: 'note', position: { x: el.x, y: el.y }, style: { width: Math.max(size.width, el.w), height: size.height }, data: { label: el.text, accent: el.accent, reveal: el.reveal } })
    } else if (el.type !== 'arrow') skipped++
  }
  for (const el of slide.elements) {
    if (el.type !== 'arrow') continue
    const a = boxes.get(el.from), b = boxes.get(el.to)
    if (!a || !b) { skipped++; continue }
    edges.push({ id: el.id, source: a.id, target: b.id, ...facingHandles(a, b), ...(el.label ? { label: el.label } : {}), data: { accent: el.accent, reveal: el.reveal } })
  }
  return { flow: { nodes, edges }, skipped }
}
