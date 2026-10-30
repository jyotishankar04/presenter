import type { FlowDirection, FlowShape } from './types'

export interface MermaidNode { id: string; label: string; shape: FlowShape }
export interface MermaidEdge { from: string; to: string; label?: string; dashed?: boolean }
export interface MermaidFlow { direction: FlowDirection; nodes: MermaidNode[]; edges: MermaidEdge[] }

// Bracket pairs, longest/most specific first.
const BRACKETS: [open: string, close: string, shape: FlowShape][] = [
  ['[(', ')]', 'database'], ['((', '))', 'pill'], ['([', '])', 'pill'], ['[[', ']]', 'box'], ['{{', '}}', 'box'],
  ['[', ']', 'box'], ['(', ')', 'box'], ['{', '}', 'decision'], ['>', ']', 'box'],
]
const ID = /^[A-Za-z0-9_À-￿-]+/

/** Link operators, optionally followed by |label|; also "-- text -->" style labels. */
const LINKS: { re: RegExp; dashed: boolean; text?: boolean }[] = [
  { re: /^\s*--\s+([^->|]+?)\s+-->/, dashed: false, text: true },
  { re: /^\s*-\.\s+([^.|]+?)\s+\.->/, dashed: true, text: true },
  { re: /^\s*==\s+([^=|]+?)\s+==>/, dashed: false, text: true },
  { re: /^\s*<?-\.+->/, dashed: true },
  { re: /^\s*<?={2,}>?/, dashed: false },
  { re: /^\s*<?-{2,}[>ox]?/, dashed: false },
]

function readNode(s: string): { node: MermaidNode; rest: string } | null {
  const t = s.trimStart()
  const m = t.match(ID)
  if (!m) return null
  const id = m[0]
  let rest = t.slice(id.length)
  for (const [open, close, shape] of BRACKETS) {
    if (!rest.startsWith(open)) continue
    // quoted text may contain the closing bracket
    const quoted = rest.slice(open.length).match(/^\s*"([^"]*)"\s*/)
    let label: string, after: string
    if (quoted) {
      const tail = rest.slice(open.length + quoted[0].length)
      if (!tail.startsWith(close)) continue
      label = quoted[1]; after = tail.slice(close.length)
    } else {
      const end = rest.indexOf(close, open.length)
      if (end < 0) continue
      label = rest.slice(open.length, end).trim(); after = rest.slice(end + close.length)
    }
    return { node: { id, label: label.replace(/<br\s*\/?>/gi, '\n'), shape }, rest: after }
  }
  return { node: { id, label: id, shape: 'box' }, rest }
}

/** Parses the common subset of Mermaid flowcharts: nodes, shapes, chains, "A & B", edge labels. Throws a readable Error. */
export function parseMermaidFlow(src: string): MermaidFlow {
  const lines = src.split(/\r?\n/).map((l) => l.replace(/%%.*$/, '').trim()).filter(Boolean)
  const head = lines.shift()?.match(/^(flowchart|graph)\b\s*(LR|RL|TD|TB|BT)?/i)
  if (!head) throw new Error('Start with "flowchart LR" or "flowchart TD" (only flowcharts are supported)')
  const direction: FlowDirection = /^(LR|RL)$/i.test(head[2] ?? '') ? 'LR' : 'TB'

  const nodes = new Map<string, MermaidNode>()
  const edges: MermaidEdge[] = []
  const see = (n: MermaidNode) => {
    const prev = nodes.get(n.id)
    // a later "A[Label]" overrides the bare "A" first seen in an edge
    if (!prev || (n.label !== n.id || n.shape !== 'box') && (prev.label === prev.id && prev.shape === 'box')) nodes.set(n.id, n)
  }

  for (const raw of lines) {
    if (/^(subgraph|end|direction|classDef|class|style|linkStyle|click|accTitle|accDescr)\b/i.test(raw)) continue
    for (const stmt of raw.split(';').map((x) => x.trim()).filter(Boolean)) {
      let rest = stmt
      let prevGroup: MermaidNode[] | null = null
      let linkInfo: { label?: string; dashed: boolean } | null = null
      for (let guard = 0; guard < 64 && rest.trim(); guard++) {
        // a group of nodes joined by &
        const group: MermaidNode[] = []
        for (;;) {
          const r = readNode(rest)
          if (!r) throw new Error(`Could not read "${rest.trim().slice(0, 30)}"`)
          group.push(r.node); see(r.node); rest = r.rest
          if (/^\s*&/.test(rest)) { rest = rest.replace(/^\s*&/, ''); continue }
          break
        }
        if (prevGroup && linkInfo) for (const a of prevGroup) for (const b of group) edges.push({ from: a.id, to: b.id, ...(linkInfo.label ? { label: linkInfo.label } : {}), ...(linkInfo.dashed ? { dashed: true } : {}) })
        if (!rest.trim()) break
        let matched = false
        for (const L of LINKS) {
          const m = rest.match(L.re)
          if (!m) continue
          rest = rest.slice(m[0].length)
          let label = L.text ? m[1].trim() : undefined
          const pipe = rest.match(/^\s*\|([^|]*)\|/)
          if (pipe) { label = pipe[1].trim(); rest = rest.slice(pipe[0].length) }
          linkInfo = { label: label || undefined, dashed: L.dashed }; matched = true; break
        }
        if (!matched) throw new Error(`Expected an arrow like --> after "${group[group.length - 1].id}"`)
        prevGroup = group
      }
    }
  }
  if (!nodes.size) throw new Error('No nodes found')
  return { direction, nodes: [...nodes.values()], edges }
}
