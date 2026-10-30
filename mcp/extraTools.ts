import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { STAGE_H, STAGE_W, type Slide } from '../src/model/types'
import { readDeck, writeDeck } from '../server/store'
import { guarded, RO, rid, ToolError, WEB, WR } from './common'

const deckId = z.string().describe('Deck id, as returned by list_decks')
const slideRef = z.union([z.number().int().min(1), z.string()]).describe('Slide number (1-based) or slide id')

function pick(slides: Slide[], ref: number | string, deck: string) {
  const i = typeof ref === 'number' ? ref - 1 : slides.findIndex((s) => s.id === ref)
  if (!slides[i]) throw new ToolError(`No slide ${JSON.stringify(ref)} in "${deck}" (it has ${slides.length} slides; numbers are 1-based)`)
  return { slide: slides[i], i }
}

interface Box { id: string; label: string; x: number; y: number; w: number; h: number; reveal: number }
const boxesOf = (s: Slide): Box[] => s.elements.filter((e) => e.type !== 'arrow').map((e) => ({ id: e.id, label: (e as { text?: string; label?: string; header?: string }).text ?? (e as { label?: string }).label ?? (e as { header?: string }).header ?? e.type, x: e.x, y: e.y, w: e.w, h: e.h, reveal: e.reveal }))

/** Pure geometry check for fixed-layout slides: things off the stage and things stacked on top of each other. */
export function layoutProblems(s: Slide): string[] {
  const out: string[] = []
  const b = boxesOf(s)
  for (const e of b) {
    if (e.x < 0 || e.y < 0 || e.x + e.w > STAGE_W || e.y + e.h > STAGE_H) out.push(`"${e.label.slice(0, 30)}" (${e.id}) sticks out of the ${STAGE_W}x${STAGE_H} slide`)
  }
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const a = b[i], c = b[j]
    const w = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), h = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y)
    if (w > 8 && h > 8 && w * h > 0.15 * Math.min(a.w * a.h, c.w * c.h)) out.push(`"${a.label.slice(0, 30)}" (${a.id}) overlaps "${c.label.slice(0, 30)}" (${c.id})${a.reveal === c.reveal || !a.reveal || !c.reveal ? '' : ' (they appear on different clicks)'}`)
  }
  return out
}

const SHAPE = z.object({
  type: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line']),
  x: z.number().describe('Left edge, in canvas units (the slide frame is about 1600x900)'), y: z.number(),
  width: z.number().min(0).default(200), height: z.number().default(100),
  text: z.string().optional().describe('Label (inside a shape) or the text itself'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1e1e1e').describe('Stroke / text colour, #rrggbb'),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('Fill colour, #rrggbb'),
  click: z.number().int().min(0).default(0).describe('Click the shape appears on (0 = always visible)'),
})

const base = (id: string, type: string, x: number, y: number, w: number, h: number, click: number, o: Record<string, unknown>) => ({
  id, type, x, y, width: w, height: h, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
  groupIds: [], frameId: null, roundness: null, seed: Math.floor(Math.random() * 2 ** 31), version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31), isDeleted: false,
  boundElements: null, updated: Date.now(), link: null, locked: false, customData: click ? { reveal: click } : undefined, ...o,
})

/** Raw Excalidraw elements for one shape (a labelled shape becomes a shape plus a bound text element). */
export function shapeToElements(sh: z.infer<typeof SHAPE>): any[] {
  const id = rid() + rid()
  const style = { strokeColor: sh.color, ...(sh.fill ? { backgroundColor: sh.fill } : {}) }
  if (sh.type === 'text') {
    const size = Math.max(14, Math.min(60, Math.round(sh.height * 0.45) || 28)), t = sh.text ?? ''
    return [base(id, 'text', sh.x, sh.y, Math.max(20, t.length * size * 0.55), size * 1.25, sh.click, { ...style, text: t, originalText: t, fontSize: size, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, autoResize: true, lineHeight: 1.25, baseline: size })]
  }
  if (sh.type === 'arrow' || sh.type === 'line') {
    return [base(id, sh.type, sh.x, sh.y, sh.width, sh.height, sh.click, { ...style, points: [[0, 0], [sh.width, sh.height]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: sh.type === 'arrow' ? 'arrow' : null, roundness: { type: 2 } })]
  }
  const shape = base(id, sh.type, sh.x, sh.y, sh.width, sh.height, sh.click, { ...style, roundness: sh.type === 'rectangle' ? { type: 3 } : null })
  if (!sh.text) return [shape]
  const tid = id + 't', size = 24
  shape.boundElements = [{ type: 'text', id: tid }] as any
  const txt = base(tid, 'text', sh.x + 10, sh.y + sh.height / 2 - size * 0.62, sh.width - 20, size * 1.25, sh.click, { strokeColor: sh.color, text: sh.text, originalText: sh.text, fontSize: size, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', containerId: id, autoResize: true, lineHeight: 1.25, baseline: size })
  return [shape, txt]
}

export function registerExtraTools(server: McpServer) {
  server.registerTool('set_speaker_notes', { title: 'Set speaker notes', description: 'Set (or clear with an empty string) the private speaker notes of any slide. Notes show in the presenter when the presenter presses S and are never part of the recorded slide. They also appear in get_slide.',
    inputSchema: { deck: deckId, slide: slideRef, notes: z.string().max(4000) }, annotations: { ...WR, idempotentHint: true } },
    guarded(async ({ deck, slide, notes }) => {
      const d = await readDeck(deck); const { slide: s, i } = pick(d.slides, slide, deck)
      if (notes.trim()) s.notes = notes.trim(); else delete s.notes
      await writeDeck(d)
      return { ok: true, slide: i + 1, notes: s.notes ?? null }
    }))

  server.registerTool('check_slide_layout', { title: 'Check slide layout', description: 'Reports elements that stick out of the slide or overlap each other on a content/section slide. Cheap, no browser needed: run it after building a slide. For a real picture use preview_slide.',
    inputSchema: { deck: deckId, slide: slideRef }, annotations: RO },
    guarded(async ({ deck, slide }) => {
      const d = await readDeck(deck); const { slide: s, i } = pick(d.slides, slide, deck)
      if (s.layout !== 'content' && s.layout !== 'section') return { slide: i + 1, layout: s.layout, problems: [], note: 'Only content/section slides can be checked geometrically; use preview_slide for a picture.' }
      const problems = layoutProblems(s)
      return { slide: i + 1, problems, verdict: problems.length ? 'Fix these, then check again.' : 'No overlaps or off-slide elements.' }
    }))

  server.registerTool('draw_on_canvas_slide', { title: 'Draw on a canvas slide', description: 'Add rectangles, ellipses, diamonds, text, arrows and lines to a freehand "canvas" slide (create one with add_slide layout "canvas"). Coordinates are in canvas units; keep the drawing inside roughly 1600x900. click sets the step a shape appears on (0 = always). Labelled shapes get centred text. Use replace: true to wipe the slide first.',
    inputSchema: { deck: deckId, slide: slideRef, shapes: z.array(SHAPE).min(1).max(80), replace: z.boolean().default(false) }, annotations: WR },
    guarded(async ({ deck, slide, shapes, replace }) => {
      const d = await readDeck(deck); const { slide: s, i } = pick(d.slides, slide, deck)
      if (s.layout !== 'canvas') throw new ToolError(`Slide ${i + 1} is a "${s.layout}" slide; draw_on_canvas_slide only works on canvas slides. Create one with add_slide layout "canvas".`)
      const scene = s.scene ?? { elements: [], files: {} }
      const added = shapes.flatMap(shapeToElements)
      scene.elements = replace ? added : [...scene.elements, ...added]
      s.scene = scene
      await writeDeck(d)
      const clicks = Math.max(0, ...scene.elements.map((e: any) => e.customData?.reveal ?? 0))
      return { ok: true, slide: i + 1, added: shapes.length, elements: scene.elements.filter((e: any) => !e.isDeleted).length, clicks, open: `${WEB}/edit/${deck}` }
    }))

  server.registerTool('preview_slide', { title: 'Preview slide (screenshot)', description: 'Returns a PNG screenshot of one slide at a given click so you can look for overlaps, clipped text and bad spacing. Needs the web app running (pnpm dev) and a Chromium/Chrome browser on this machine; if either is missing you get an error and should use check_slide_layout instead.',
    inputSchema: { deck: deckId, slide: slideRef, click: z.number().int().min(0).default(999).describe('Which click to show (999 = everything revealed, 0 = start)') }, annotations: RO },
    async ({ deck, slide, click }) => {
      try {
        const d = await readDeck(deck); const { i } = pick(d.slides, slide, deck)
        // @ts-ignore optional dependency, loaded only when this tool is used
        const pw: any = await import('playwright-core').catch(() => null)
        if (!pw) throw new ToolError('playwright-core is not installed (run: pnpm add -D playwright-core). Use check_slide_layout meanwhile.')
        const exe = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p))
        if (!exe) throw new ToolError('No Chrome/Chromium found. Set CHROME_PATH to its executable, or use check_slide_layout.')
        const browser = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
        try {
          const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
          await page.goto(`${WEB}/present/${deck}#${i}.${click}`, { waitUntil: 'networkidle', timeout: 15000 })
          await page.waitForTimeout(900)
          const png: Buffer = await page.screenshot({ type: 'png' })
          return { content: [{ type: 'image' as const, data: png.toString('base64'), mimeType: 'image/png' }, { type: 'text' as const, text: `Slide ${i + 1} at click ${click}.` }] }
        } finally { await browser.close() }
      } catch (e) {
        return { isError: true, content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }] }
      }
    })
}
