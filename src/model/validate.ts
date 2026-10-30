import type { Slide } from './types'

const TYPES = ['text', 'box', 'arrow', 'cardList', 'sequence', 'image', 'demo', 'strike', 'mermaid', 'code']
const isStr = (v: unknown) => typeof v === 'string'
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

export interface SlideCode {
  layout: 'content' | 'section'
  title?: string
  eyebrow?: string
  elements: any[]
}

/** The editable part of a normal slide, in the shape shown in the Code tab. */
export function slideToCode(s: Slide): SlideCode {
  const { layout, title, eyebrow, elements } = s
  return { layout: layout as 'content' | 'section', ...(title !== undefined && { title }), ...(eyebrow !== undefined && { eyebrow }), elements }
}

/** Returns a human-readable problem, or null when the object is a valid normal slide. */
export function validateSlideCode(v: unknown): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'The slide must be a JSON object { layout, title, elements }'
  const s = v as Record<string, unknown>
  if (s.layout !== 'content' && s.layout !== 'section') return '"layout" must be "content" or "section"'
  if (s.title !== undefined && !isStr(s.title)) return '"title" must be text'
  if (s.eyebrow !== undefined && !isStr(s.eyebrow)) return '"eyebrow" must be text'
  if (!Array.isArray(s.elements)) return '"elements" must be a list'
  const ids = new Set<string>()
  for (const [i, e] of s.elements.entries()) {
    const at = `elements[${i}]`
    if (!e || typeof e !== 'object') return `${at} must be an object`
    if (!isStr(e.id) || !e.id) return `${at} needs a text "id"`
    if (ids.has(e.id)) return `${at}: duplicate id "${e.id}"`
    ids.add(e.id)
    if (!TYPES.includes(e.type)) return `${at}: unknown type "${e.type}" (use ${TYPES.join(', ')})`
    for (const k of ['x', 'y', 'w', 'h']) if (!isNum(e[k])) return `${at} (${e.type}): "${k}" must be a number`
    if (!Number.isInteger(e.reveal) || e.reveal < 0) return `${at} (${e.type}): "reveal" must be a whole number, 0 or more`
    const need = (k: string, ok: boolean, what: string) => (ok ? null : `${at} (${e.type}): "${k}" must be ${what}`)
    const err =
      e.type === 'text' ? need('text', isStr(e.text), 'text') :
      e.type === 'box' ? need('label', isStr(e.label), 'text') :
      e.type === 'arrow' ? need('from', isStr(e.from), 'a box id') ?? need('to', isStr(e.to), 'a box id') :
      e.type === 'cardList' ? need('cards', Array.isArray(e.cards), 'a list of { text, reveal }') :
      e.type === 'sequence' ? need('actors', Array.isArray(e.actors), 'a list of names') ?? need('messages', Array.isArray(e.messages), 'a list') :
      e.type === 'code' || e.type === 'mermaid' ? need('code', isStr(e.code), 'text') :
      e.type === 'strike' ? need('wrong', isStr(e.wrong), 'text') ?? need('right', isStr(e.right), 'text') :
      e.type === 'image' ? need('src', isStr(e.src), 'a url') :
      e.type === 'demo' ? need('demo', isStr(e.demo), 'a demo name') : null
    if (err) return err
  }
  for (const [i, e] of s.elements.entries()) {
    if (e.type === 'arrow') for (const k of ['from', 'to']) if (!ids.has(e[k])) return `elements[${i}] (arrow): "${k}" points at "${e[k]}", which isn't in this slide`
  }
  return null
}
