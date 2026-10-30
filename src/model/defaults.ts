import type { El, ElType } from './types'

/** A new element of the given type with sensible defaults. Shared by the editor palette and the MCP server. */
export function defaultElement(type: ElType, id: string, reveal: number): El {
  const base = { id, x: 200, y: 260, reveal }
  switch (type) {
    case 'text': return { ...base, type, w: 600, h: 70, text: 'New text', size: 40, style: 'serif', accent: 'ink', align: 'left' }
    case 'box': return { ...base, type, w: 260, h: 100, label: 'Box', icon: 'Box', accent: 'amber' }
    case 'arrow': return { ...base, type, x: 0, y: 0, w: 0, h: 0, from: '', to: '', accent: 'ink' }
    case 'cardList': return { ...base, type, w: 640, h: 500, header: 'Header', accent: 'green', cards: [{ text: 'First', reveal }, { text: 'Second', reveal: reveal + 1 }] }
    case 'sequence': return { ...base, type, x: 200, w: 1200, h: 400, actors: ['Client', 'Server'], messages: [{ from: 0, to: 1, text: 'request', kind: 'request', reveal }, { from: 1, to: 0, text: 'response', kind: 'response', reveal: reveal + 1 }] }
    case 'image': return { ...base, type, w: 400, h: 300, src: '' }
    case 'demo': return { ...base, type, w: 1200, h: 600, demo: 'whos-driving' }
    case 'mermaid': return { ...base, type, x: 200, y: 200, w: 1200, h: 560, code: 'flowchart LR\n  Client --> LB[Load balancer]\n  LB --> S1[Server 1]\n  LB --> S2[Server 2]\n  S1 --> DB[(Database)]\n  S2 --> DB' }
    case 'code': return { ...base, type, x: 100, y: 180, w: 1000, h: 560, lang: 'typescript', size: 26, code: 'function hash(url: string) {\n  const id = nextId()\n  return base62(id)\n}', focus: [{ lines: '2', reveal: reveal + 1 }, { lines: '3', reveal: reveal + 2 }] }
    case 'strike': return { ...base, type, w: 1400, h: 90, wrong: 'old way', right: 'new way' }
  }
}
