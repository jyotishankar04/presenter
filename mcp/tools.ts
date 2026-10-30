import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { defaultElement } from '../src/model/defaults'
import { autoReveal, layoutFlow } from '../src/flow/layout'
import { mermaidToFlow } from '../src/flow/mermaidFlow'
import { flowSteps } from '../src/flow/reveal'
import { defaultSize, FLOW_SHAPES, type FlowData, type FlowDirection, type FlowNode } from '../src/flow/types'
import { validateFlow } from '../src/flow/validate'
import { validateSchema } from '../src/schema/validate'
import { layoutDiagram } from '../src/model/layout'
import { BACKGROUND_IDS, BACKGROUNDS, THEME_IDS, THEMES, type BackgroundId } from '../src/model/themes'
import { totalSteps } from '../src/model/reveal'
import { removeElements } from '../src/model/ops'
import type { Deck, El, ElType, Slide, ThemeId } from '../src/model/types'
import { slideToCode, validateSlideCode } from '../src/model/validate'
import { deckExists, deleteDeck, listDecks, readDeck, safeId, writeDeck } from '../server/store'
import { fail, guarded, ok, rid, RO, slugify, ToolError, WEB, WR } from './common'
import { AUTHORING_GUIDE } from './guide'
import { registerSchemaTools } from './schemaTools'
import { registerExtraTools } from './extraTools'

const ELEMENT_TYPES = ['text', 'box', 'arrow', 'cardList', 'sequence', 'image', 'demo', 'strike', 'mermaid', 'code'] as const
const ACCENTS = ['amber', 'blue', 'green', 'red', 'ink', 'muted'] as const
const slugify2 = (s: string) => slugify(s, 'deck')

const slideRef = z.union([z.number().int().min(1), z.string()]).describe('Slide number (1-based) or slide id')
const deckId = z.string().describe('Deck id, as returned by list_decks')
const index = z.number().int().min(1).optional().describe('Insert at this 1-based position (default: end)')

const urls = (id: string, slide?: number) => ({ edit: `${WEB}/edit/${id}`, present: `${WEB}/present/${id}${slide ? `#${slide - 1}.0` : ''}` })

async function load(id: string): Promise<Deck> { return readDeck(id) }

function findSlide(deck: Deck, ref: number | string): { slide: Slide; i: number } {
  const i = typeof ref === 'number' ? ref - 1 : deck.slides.findIndex((s) => s.id === ref)
  const slide = deck.slides[i]
  if (!slide) throw new ToolError(`No slide ${JSON.stringify(ref)} in "${deck.id}" (it has ${deck.slides.length} slides; numbers are 1-based)`)
  return { slide, i }
}

function legacyOnly(slide: Slide, what: string) {
  if (slide.layout === 'canvas') throw new ToolError(`Slide ${slide.id} is a freehand canvas slide; ${what} only works on "content" and "section" slides. Add a new content slide instead.`)
  if (slide.layout === 'schema') throw new ToolError(`Slide ${slide.id} is a database schema slide; ${what} only works on "content" and "section" slides. Edit the saved schema with the schema tools (add_table, add_column, add_relationship …) and add it again with add_schema_slide.`)
  if (slide.layout === 'flow') throw new ToolError(`Slide ${slide.id} is a flow diagram slide; ${what} only works on "content" and "section" slides. Use update_flow_slide to change a diagram's nodes and edges.`)
}

/** Validates the slide the way the editor's Code tab does, so agents can never save something the editor can't open. */
function check(slide: Slide) {
  if (slide.layout === 'canvas') return
  if (slide.layout === 'flow') { const p = validateFlow(slide.flow); if (p) throw new ToolError(`Not saved. ${p}`); return }
  if (slide.layout === 'schema') { const p = validateSchema(slide.schema); if (p) throw new ToolError(`Not saved. ${p}`); return }
  const problem = validateSlideCode(slideToCode(slide))
  if (problem) throw new ToolError(`Not saved. ${problem}`)
}

const outline = (deck: Deck) => ({
  id: deck.id, title: deck.title, theme: deck.theme, ...urls(deck.id),
  slides: deck.slides.map((s, i) => ({
    number: i + 1, id: s.id, layout: s.layout, ...(s.sub ? { sub: true } : {}), title: s.title ?? null, ...(s.eyebrow ? { eyebrow: s.eyebrow } : {}),
    elements: s.layout === 'canvas' ? (s.scene?.elements.filter((e: any) => !e.isDeleted).length ?? 0) : s.layout === 'flow' ? (s.flow?.nodes.length ?? 0) : s.layout === 'schema' ? (s.schema?.tables.length ?? 0) : s.elements.length, clicks: totalSteps(s),
  })),
})

async function save(deck: Deck, slideNo?: number) {
  await writeDeck(deck)
  return { ok: true, deck: deck.id, slides: deck.slides.length, ...urls(deck.id, slideNo) }
}

function insert(deck: Deck, slide: Slide, at?: number): number {
  const pos = at ? Math.min(at - 1, deck.slides.length) : deck.slides.length
  deck.slides.splice(pos, 0, slide)
  return pos + 1
}

function contentSlide(title: string | undefined, elements: El[]): Slide {
  const s: Slide = { id: rid(), layout: 'content', ...(title ? { title } : {}), elements }
  check(s)
  return s
}

export function createMcpServer() {
  const server = new McpServer({ name: 'presenter', version: '0.1.0' }, {
    instructions: 'Build and edit slide decks for coding / system-design videos. Call get_authoring_guide first. Slide numbers are 1-based. Every write is validated; read the error text and retry.',
  })

  server.registerResource('authoring-guide', 'presenter://guide', { title: 'Authoring guide', description: 'How slides, reveals and elements work', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, text: AUTHORING_GUIDE }] }))

  server.registerTool('get_authoring_guide', { title: 'Authoring guide', description: 'Read this first: slide kinds, the 1600x900 stage, the reveal/click model, every element type and its fields, and style advice.', inputSchema: {}, annotations: RO },
    guarded(async () => AUTHORING_GUIDE))

  server.registerTool('list_decks', { title: 'List decks', description: 'List all decks (id, title, theme, slide count).', inputSchema: {}, annotations: RO },
    guarded(async () => ({ decks: await listDecks() })))

  server.registerTool('get_deck', { title: 'Get deck outline', description: 'Outline of a deck: each slide\'s number, layout, title, element count and number of clicks, plus editor/present URLs. Use get_slide for full contents.', inputSchema: { deck: deckId }, annotations: RO },
    guarded(async ({ deck }) => outline(await load(deck))))

  server.registerTool('get_slide', { title: 'Get slide', description: 'Full JSON of one slide (layout, title, eyebrow, elements).', inputSchema: { deck: deckId, slide: slideRef }, annotations: RO },
    guarded(async ({ deck, slide }) => { const { slide: s, i } = findSlide(await load(deck), slide); return { number: i + 1, id: s.id, ...(s.notes ? { notes: s.notes } : {}), ...(s.layout === 'canvas' ? { layout: 'canvas', note: 'Freehand drawing; add shapes with draw_on_canvas_slide.' } : s.layout === 'flow' ? { layout: 'flow', title: s.title ?? null, flow: s.flow } : s.layout === 'schema' ? { layout: 'schema', title: s.title ?? null, schema: s.schema, note: 'Embedded copy of a database schema; each table has a reveal step.' } : slideToCode(s)) } }))

  server.registerTool('create_deck', { title: 'Create deck', description: 'Create a new deck with one section slide. Returns its id and URLs.',
    inputSchema: { title: z.string().min(1), theme: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).default('sketch').describe('Look of every slide: ' + THEMES.map((t) => `${t.id} (${t.description})`).join('; ')), id: z.string().optional().describe('Optional id; derived from the title if omitted'), background: z.enum(BACKGROUND_IDS as [BackgroundId, ...BackgroundId[]]).optional().describe('Subtle slide background: ' + BACKGROUNDS.map((b) => `${b.id} (${b.description})`).join('; ') + '. Omit for the theme default.') }, annotations: WR },
    guarded(async ({ title, theme, id, background }) => {
      let did = id ?? slugify2(title)
      if (!safeId(did)) throw new ToolError(`"${did}" is not a valid id (letters, numbers, - and _)`)
      if (await deckExists(did)) { if (id) throw new ToolError(`A deck with id "${did}" already exists`); did += '-' + rid().slice(0, 3) }
      const deck: Deck = { id: did, title, theme: theme as ThemeId, ...(background && background !== 'theme' ? { background } : {}), slides: [{ id: rid(), layout: 'section', title, elements: [] }] }
      return save(deck)
    }))

  server.registerTool('update_deck', { title: 'Update deck', description: 'Rename a deck or change its theme or background.', inputSchema: { deck: deckId, title: z.string().optional(), theme: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).optional(), background: z.enum(BACKGROUND_IDS as [BackgroundId, ...BackgroundId[]]).optional() }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, title, theme, background }) => { const d = await load(deck); if (title) d.title = title; if (theme) d.theme = theme; if (background) { if (background === 'theme') delete d.background; else d.background = background } return save(d) }))

  server.registerTool('delete_deck', { title: 'Delete deck', description: 'Permanently delete a deck file. Requires confirm: true. Ask the user before calling this.', inputSchema: { deck: deckId, confirm: z.literal(true) }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ deck }) => { await load(deck); await deleteDeck(deck); return { ok: true, deleted: deck } }))

  server.registerTool('add_slide', { title: 'Add slide', description: 'Add a slide. layout "section" = big title (+eyebrow); "content" = title plus elements; "canvas" = empty freehand canvas; "flow" = empty flow-diagram slide (prefer add_diagram_slide). For content slides you may pass elements (see the guide); prefer the add_*_slide helpers.',
    inputSchema: { deck: deckId, layout: z.enum(['section', 'content', 'canvas', 'flow']), title: z.string().optional(), eyebrow: z.string().optional(), elements: z.array(z.record(z.string(), z.unknown())).optional(), index, sub: z.boolean().optional().describe('Make it a sub-slide of the slide above (shown indented, e.g. 2.1)') }, annotations: WR },
    guarded(async ({ deck, layout, title, eyebrow, elements, index, sub }) => {
      const d = await load(deck)
      const s: Slide = layout === 'canvas'
        ? { id: rid(), layout, elements: [], scene: { elements: [], files: {} } }
        : layout === 'flow'
        ? { id: rid(), layout, ...(title ? { title } : {}), elements: [], flow: { nodes: [], edges: [] } }
        : { id: rid(), layout, ...(title ? { title } : {}), ...(eyebrow ? { eyebrow } : {}), elements: (elements ?? []) as unknown as El[] }
      if (sub) s.sub = true
      check(s)
      return { ...(await save(d, insert(d, s, index))), slide: s.id }
    }))

  server.registerTool('update_slide', { title: 'Update slide', description: 'Change a content/section slide: title, eyebrow, layout, and/or replace ALL its elements. Use update_element/add_element for small changes.',
    inputSchema: { deck: deckId, slide: slideRef, title: z.string().optional(), eyebrow: z.string().optional(), layout: z.enum(['section', 'content']).optional(), elements: z.array(z.record(z.string(), z.unknown())).optional() }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, title, eyebrow, layout, elements }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide); legacyOnly(s, 'update_slide')
      if (title !== undefined) s.title = title
      if (eyebrow !== undefined) s.eyebrow = eyebrow
      if (layout) s.layout = layout
      if (elements) s.elements = elements as unknown as El[]
      check(s)
      return save(d, i + 1)
    }))

  server.registerTool('delete_slide', { title: 'Delete slide', description: 'Delete one slide (a deck must keep at least one).', inputSchema: { deck: deckId, slide: slideRef }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ deck, slide }) => {
      const d = await load(deck); const { i } = findSlide(d, slide)
      if (d.slides.length === 1) throw new ToolError('A deck needs at least one slide')
      d.slides.splice(i, 1); return save(d)
    }))

  server.registerTool('move_slide', { title: 'Move slide', description: 'Move a slide to a new 1-based position.', inputSchema: { deck: deckId, slide: slideRef, to: z.number().int().min(1) }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, to }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide)
      d.slides.splice(i, 1); const at = Math.min(to - 1, d.slides.length); d.slides.splice(at, 0, s); return save(d, at + 1)
    }))

  server.registerTool('duplicate_slide', { title: 'Duplicate slide', description: 'Copy a slide to right after the original.', inputSchema: { deck: deckId, slide: slideRef }, annotations: WR },
    guarded(async ({ deck, slide }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide)
      const c = { ...structuredClone(s), id: rid() }; d.slides.splice(i + 1, 0, c); return { ...(await save(d, i + 2)), slide: c.id }
    }))

  server.registerTool('add_element', { title: 'Add element', description: 'Add one element to a content/section slide. Give type plus any fields; missing ones get defaults and, unless you set reveal, it appears on the next click after everything else. Returns the new element id.',
    inputSchema: { deck: deckId, slide: slideRef, element: z.object({ type: z.enum(ELEMENT_TYPES) }).catchall(z.unknown()).describe('e.g. { "type": "box", "label": "Cache", "icon": "Zap", "x": 400, "y": 300, "w": 250, "h": 90, "reveal": 2 }') }, annotations: WR },
    guarded(async ({ deck, slide, element }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide); legacyOnly(s, 'add_element')
      const { type, ...fields } = element
      const id = typeof fields.id === 'string' ? fields.id : rid()
      const el = { ...defaultElement(type as ElType, id, Math.min(totalSteps(s) + 1, 99)), ...fields, id, type } as El
      s.elements.push(el); check(s)
      return { ...(await save(d, i + 1)), element: id }
    }))

  server.registerTool('update_element', { title: 'Update element', description: 'Change fields of one element (e.g. move it, relabel it, change its reveal). The type cannot change.',
    inputSchema: { deck: deckId, slide: slideRef, id: z.string().describe('Element id'), changes: z.record(z.string(), z.unknown()) }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, id, changes }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide); legacyOnly(s, 'update_element')
      const el = s.elements.find((e) => e.id === id)
      if (!el) throw new ToolError(`No element "${id}" on that slide. Ids: ${s.elements.map((e) => e.id).join(', ') || '(none)'}`)
      if ('type' in changes || 'id' in changes) throw new ToolError('"type" and "id" cannot be changed; delete and re-add instead')
      Object.assign(el, changes); check(s); return save(d, i + 1)
    }))

  server.registerTool('delete_element', { title: 'Delete element', description: 'Delete an element (arrows attached to it are removed too).', inputSchema: { deck: deckId, slide: slideRef, id: z.string() }, annotations: { ...WR, destructiveHint: true } },
    guarded(async ({ deck, slide, id }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide); legacyOnly(s, 'delete_element')
      if (!s.elements.some((e) => e.id === id)) throw new ToolError(`No element "${id}" on that slide`)
      removeElements(s, [id]); return save(d, i + 1)
    }))

  server.registerTool('set_reveal', { title: 'Set reveal step', description: 'Make several elements appear on the same click (0 = visible from the start).',
    inputSchema: { deck: deckId, slide: slideRef, ids: z.array(z.string()).min(1), step: z.number().int().min(0).max(99) }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, ids, step }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide); legacyOnly(s, 'set_reveal')
      const missing = ids.filter((x) => !s.elements.some((e) => e.id === x)); if (missing.length) throw new ToolError(`Unknown element ids: ${missing.join(', ')}`)
      for (const e of s.elements) if (ids.includes(e.id)) e.reveal = step
      return save(d, i + 1)
    }))

  const nodeSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    label: z.string(),
    shape: z.enum(FLOW_SHAPES as [string, ...string[]]).default('box').describe('box = step, decision = diamond (yes/no), pill = start/end, database = cylinder, note = free text'),
    icon: z.string().optional().describe('lucide icon name, e.g. Server, Database, Cloud, Zap, User'),
    accent: z.enum(ACCENTS).optional(), muted: z.boolean().optional(),
  })
  const edgeSchema = z.object({ from: z.string(), to: z.string(), label: z.string().optional().describe('e.g. "yes" / "no"'), dashed: z.boolean().optional() })
  const accentFor = (shape: string, i: number) => (shape === 'decision' ? 'amber' : shape === 'database' ? 'green' : (['blue', 'amber', 'green', 'ink', 'red'] as const)[i % 5])

  /** Builds a laid-out flow graph from agent-friendly nodes/edges. */
  function buildFlow(nodes: z.infer<typeof nodeSchema>[], edges: z.infer<typeof edgeSchema>[], direction: FlowDirection, reveal: 'level' | 'node' | 'none'): FlowData {
    const ids = new Set(nodes.map((n) => n.id)); if (ids.size !== nodes.length) throw new ToolError('Node ids must be unique')
    const bad = edges.find((e) => !ids.has(e.from) || !ids.has(e.to)); if (bad) throw new ToolError(`Edge ${bad.from} -> ${bad.to} uses an id that is not in nodes`)
    const fn: FlowNode[] = nodes.map((n, i) => ({ id: n.id, type: n.shape as FlowNode['type'], position: { x: 0, y: 0 }, style: defaultSize(n.shape as FlowNode['type'], n.label, !!n.icon),
      data: { label: n.label, ...(n.icon ? { icon: n.icon } : {}), accent: n.accent ?? accentFor(n.shape, i), ...(n.muted ? { muted: true } : {}), reveal: 0 } }))
    const fe = edges.map((e, i) => ({ id: `e${i}-${e.from}-${e.to}`, source: e.from, target: e.to, ...(e.label ? { label: e.label } : {}), data: { accent: 'ink' as const, reveal: 0, ...(e.dashed ? { dashed: true } : {}) } }))
    return autoReveal(layoutFlow({ nodes: fn, edges: fe }, direction), reveal, direction)
  }

  server.registerTool('add_diagram_slide', { title: 'Add flowchart / architecture diagram slide', description: 'Add an interactive React Flow diagram slide from a graph: boxes, decisions (diamonds), start/end pills, databases, labelled arrows. Laid out automatically (dagre). reveal "level" = each column/row appears on its own click, "node" = one node per click, "none" = all at once. Best for flowcharts and system architecture. engine "boxes" gives the older fixed-layout boxes instead.',
    inputSchema: { deck: deckId, title: z.string(), nodes: z.array(nodeSchema).min(1).max(30), edges: z.array(edgeSchema).default([]), direction: z.enum(['LR', 'TB']).default('LR').describe('LR = left to right, TB = top to bottom'),
      reveal: z.enum(['level', 'node', 'none']).default('level'), engine: z.enum(['flow', 'boxes']).default('flow'), index }, annotations: WR },
    guarded(async ({ deck, title, nodes, edges, direction, reveal, engine, index }) => {
      const d = await load(deck)
      if (engine === 'boxes') {
        const ids = new Set(nodes.map((n) => n.id)); if (ids.size !== nodes.length) throw new ToolError('Node ids must be unique')
        const bad = edges.find((e) => !ids.has(e.from) || !ids.has(e.to)); if (bad) throw new ToolError(`Edge ${bad.from} -> ${bad.to} uses an id that is not in nodes`)
        const s = contentSlide(title, layoutDiagram(nodes.map((n) => ({ id: n.id, label: n.label, icon: n.icon, accent: n.accent, muted: n.muted })), edges, reveal))
        return { ...(await save(d, insert(d, s, index))), slide: s.id, clicks: totalSteps(s) }
      }
      const s: Slide = { id: rid(), layout: 'flow', title, elements: [], flow: buildFlow(nodes, edges, direction, reveal) }
      check(s)
      return { ...(await save(d, insert(d, s, index))), slide: s.id, clicks: flowSteps(s.flow) }
    }))

  server.registerTool('add_mermaid_flow_slide', { title: 'Add flowchart slide from Mermaid', description: 'Add an editable React Flow slide from Mermaid flowchart source ("flowchart LR" / "graph TD"). Supports [box], {decision}, ([pill]), [(database)], ((circle)), A --> B, A -->|label| B, A -- text --> B, -.-> dashed, chains and "A & B". Not supported: subgraphs (ignored), sequence/class diagrams (use add_sequence_slide).',
    inputSchema: { deck: deckId, title: z.string(), mermaid: z.string().describe('Mermaid flowchart source'), reveal: z.enum(['level', 'node', 'none']).default('level'), index }, annotations: WR },
    guarded(async ({ deck, title, mermaid, reveal, index }) => {
      const d = await load(deck)
      let parsed
      try { parsed = mermaidToFlow(mermaid) } catch (e) { throw new ToolError(`Could not read the Mermaid flowchart: ${(e as Error).message}`) }
      const s: Slide = { id: rid(), layout: 'flow', title, elements: [], flow: autoReveal(parsed.flow, reveal, parsed.direction) }
      check(s)
      return { ...(await save(d, insert(d, s, index))), slide: s.id, nodes: s.flow!.nodes.length, edges: s.flow!.edges.length, clicks: flowSteps(s.flow) }
    }))

  server.registerTool('update_flow_slide', { title: 'Update flow diagram slide', description: 'Replace the whole graph (and/or title) of an existing flow slide. Provide nodes + edges to rebuild it with automatic layout; omit them to only change the title. Read the current graph with get_slide first.',
    inputSchema: { deck: deckId, slide: slideRef, title: z.string().optional(), nodes: z.array(nodeSchema).min(1).max(30).optional(), edges: z.array(edgeSchema).optional(), direction: z.enum(['LR', 'TB']).default('LR'), reveal: z.enum(['level', 'node', 'none']).default('level') }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, title, nodes, edges, direction, reveal }) => {
      const d = await load(deck); const { slide: s, i } = findSlide(d, slide)
      if (s.layout !== 'flow') throw new ToolError(`Slide ${s.id} is not a flow diagram slide (it is "${s.layout}")`)
      if (title !== undefined) s.title = title
      if (nodes) s.flow = buildFlow(nodes, edges ?? [], direction, reveal)
      else if (edges) throw new ToolError('Pass nodes together with edges')
      check(s)
      return { ...(await save(d, i + 1)), clicks: flowSteps(s.flow) }
    }))

  server.registerTool('add_code_slide', { title: 'Add code walkthrough slide', description: 'Add a content slide with syntax-highlighted code. focus lists line ranges to spotlight (others dim) on successive clicks, e.g. [{"lines":"1-3","click":1},{"lines":"5","click":2}].',
    inputSchema: { deck: deckId, title: z.string(), code: z.string(), lang: z.enum(['typescript', 'javascript', 'python', 'go', 'java', 'rust', 'sql', 'bash', 'json', 'yaml', 'tsx', 'c', 'cpp']).default('typescript'),
      focus: z.array(z.object({ lines: z.string().regex(/^[0-9,\- ]+$/), click: z.number().int().min(1) })).default([]), size: z.number().int().min(14).max(48).default(28), index }, annotations: WR },
    guarded(async ({ deck, title, code, lang, focus, size, index }) => {
      const d = await load(deck)
      const el = { ...defaultElement('code', rid(), 0), x: 100, y: 190, w: 1400, h: 640, code, lang, size, focus: focus.map((f) => ({ lines: f.lines, reveal: f.click })) } as El
      const s = contentSlide(title, [el])
      return { ...(await save(d, insert(d, s, index))), slide: s.id, clicks: totalSteps(s) }
    }))

  server.registerTool('add_sequence_slide', { title: 'Add sequence diagram slide', description: 'Add a content slide with a sequence diagram (who talks to whom). Each message appears on its own click in order. from/to are actor names.',
    inputSchema: { deck: deckId, title: z.string(), actors: z.array(z.string()).min(2).max(6), messages: z.array(z.object({ from: z.string(), to: z.string(), text: z.string(), kind: z.enum(['request', 'response']).optional() })).min(1).max(12), caption: z.string().optional(), index }, annotations: WR },
    guarded(async ({ deck, title, actors, messages, caption, index }) => {
      const d = await load(deck)
      const at = (n: string) => { const k = actors.indexOf(n); if (k < 0) throw new ToolError(`"${n}" is not in actors (${actors.join(', ')})`); return k }
      const seq = { ...defaultElement('sequence', rid(), 0), x: 150, y: 200, w: 1300, h: caption ? 520 : 600, actors,
        messages: messages.map((m, k) => ({ from: at(m.from), to: at(m.to), text: m.text, kind: m.kind ?? (at(m.to) > at(m.from) ? 'request' : 'response'), reveal: k + 1 })) } as El
      const els: El[] = [seq]
      if (caption) els.push({ ...defaultElement('text', rid(), messages.length), x: 150, y: 760, w: 1300, h: 60, text: caption, size: 32, style: 'sans', accent: 'ink', align: 'left' } as El)
      const s = contentSlide(title, els)
      return { ...(await save(d, insert(d, s, index))), slide: s.id, clicks: totalSteps(s) }
    }))

  server.registerTool('add_comparison_slide', { title: 'Add two-column comparison slide', description: 'Add a content slide with two columns of cards (e.g. "Not AI" vs "AI"). Cards appear alternately left/right, one per click, unless alternate is false (then all of the left column first). Optional footer sentence appears last.',
    inputSchema: { deck: deckId, title: z.string(), left: z.object({ header: z.string(), items: z.array(z.string()).min(1).max(6), accent: z.enum(ACCENTS).default('muted') }), right: z.object({ header: z.string(), items: z.array(z.string()).min(1).max(6), accent: z.enum(ACCENTS).default('green') }),
      alternate: z.boolean().default(true), footer: z.string().optional(), index }, annotations: WR },
    guarded(async ({ deck, title, left, right, alternate, footer, index }) => {
      const d = await load(deck)
      let click = 0
      const lr: number[] = [], rr: number[] = []
      if (alternate) { for (let k = 0; k < Math.max(left.items.length, right.items.length); k++) { if (k < left.items.length) lr.push(++click); if (k < right.items.length) rr.push(++click) } }
      else { left.items.forEach(() => lr.push(++click)); right.items.forEach(() => rr.push(++click)) }
      const col = (c: typeof left, x: number, rs: number[]) => ({ ...defaultElement('cardList', rid(), 0), x, y: 190, w: 640, h: 500, header: c.header, accent: c.accent, cards: c.items.map((text, k) => ({ text, reveal: rs[k] })) }) as El
      const els: El[] = [col(left, 100, lr), col(right, 790, rr)]
      if (footer) els.push({ ...defaultElement('text', rid(), click + 1), x: 100, y: 740, w: 1300, h: 100, text: footer, size: 36, style: 'serif', accent: 'ink', align: 'left' } as El)
      const s = contentSlide(title, els)
      return { ...(await save(d, insert(d, s, index))), slide: s.id, clicks: totalSteps(s) }
    }))

  registerSchemaTools(server)
  registerExtraTools(server)

  return server
}
