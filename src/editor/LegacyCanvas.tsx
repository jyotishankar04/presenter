import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Boxes, Check, Plus, Code2, GitBranch, ImageIcon, LayoutList, Type, Workflow, Gamepad2, Strikethrough } from 'lucide-react'
import { api } from '../api'
import { legacyToScene } from '../canvas/convert'
import { legacyToFlow } from '../flow/convert'
import { snap } from '../model/geometry'
import { snapToGuides } from '../model/guides'
import { alignElements, cloneElements, distributeElements, idsInRect, rectFromPoints, removeElements, type Align, type Box } from '../model/ops'
import { STAGE_H, STAGE_W, type El, type ElType, type Slide, type ThemeId } from '../model/types'
import type { EditCtx } from '../render/ElementView'
import { SlideView } from '../render/Stage'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { announce } from '@/lib/announce'
import { hasMod, isTyping, MOD } from '@/lib/shortcuts'
import { makeElement, maxStep, uid, useStore } from './store'

const PALETTE: { type: ElType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'box', label: 'Box', icon: <Boxes size={16} /> },
  { type: 'arrow', label: 'Arrow', icon: <ArrowRight size={16} /> },
  { type: 'cardList', label: 'Card list', icon: <LayoutList size={16} /> },
  { type: 'sequence', label: 'Sequence', icon: <Workflow size={16} /> },
  { type: 'strike', label: 'Strike', icon: <Strikethrough size={16} /> },
  { type: 'mermaid', label: 'Mermaid', icon: <GitBranch size={16} /> },
  { type: 'code', label: 'Code', icon: <Code2 size={16} /> },
  { type: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
  { type: 'demo', label: 'Demo', icon: <Gamepad2 size={16} /> },
]
const TEXT_EDITABLE = ['text', 'box', 'cardList', 'strike']

/** Copy buffer shared across slides in this tab. */
let clipboard: El[] = []
let pasteCount = 0

const label = (e: El) => `${e.type}${e.type === 'box' ? `: ${e.label.split('\n')[0]}` : e.type === 'text' ? `: ${e.text.slice(0, 30)}` : ''}`

export function LegacyCanvas({ slide, slideIdx, theme, deckId }: { slide: Slide; slideIdx: number; theme: ThemeId; deckId: string }) {
  const st = useStore()
  const { selectedIds, step } = st
  const wrap = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const scale = Math.min(width, 1100) / STAGE_W
  const [editing, setEditing] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [connecting, setConnecting] = useState<{ from?: string } | null>(null)
  const [converting, setConverting] = useState(false)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const overlayRefs = useRef(new Map<string, HTMLDivElement>())
  /** What was right-clicked: an element id (or null for empty space) and where, in stage coordinates. */
  const [ctx, setCtx] = useState<{ id: string | null; x: number; y: number }>({ id: null, x: 0, y: 0 })

  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width - 32))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const steps = maxStep(slide)
  const els = slide.elements
  const movable = els.filter((e) => e.type !== 'arrow')
  const hiddenNow = (e: El) => e.reveal > step && !showHidden

  const editCtx: EditCtx = {
    editing,
    apply: (elId, fn) => st.commit((d) => { const e = d.slides[slideIdx].elements.find((x) => x.id === elId); if (e) fn(e) }),
    slideField: (f, v) => st.commit((d) => { d.slides[slideIdx][f] = v }),
    stop: () => setEditing(null),
  }

  const toStage = (cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale }
  }

  // ---------- actions ----------
  const add = (type: ElType, at?: { x: number; y: number }) => {
    if (type === 'arrow') { setConnecting({}); return }
    let el = makeElement(type, slide)
    if (at) el = { ...el, x: snap(Math.max(0, Math.min(STAGE_W - el.w, at.x - el.w / 2))), y: snap(Math.max(0, Math.min(STAGE_H - el.h, at.y - el.h / 2))) }
    st.commit((d) => { d.slides[slideIdx].elements.push(el) })
    st.select(el.id)
    st.setStep(Math.max(step, el.reveal))
    announce(`Added ${type}`)
  }

  const addImage = async (file: File, at?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) return
    const { src } = await api.upload(deckId, file)
    const dim = await new Promise<{ w: number; h: number }>((res) => {
      const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 400, h: 300 }); im.src = src
    })
    const w = Math.min(600, dim.w), h = Math.round((w / dim.w) * dim.h)
    const base = makeElement('image', slide)
    const el = { ...base, type: 'image' as const, src, w, h, x: snap((at?.x ?? STAGE_W / 2) - w / 2), y: snap((at?.y ?? STAGE_H / 2) - h / 2), reveal: 0 }
    st.commit((d) => { d.slides[slideIdx].elements.push(el) })
    st.select(el.id)
    announce('Image added')
  }

  const deleteSelected = () => {
    if (!selectedIds.length) return
    st.commit((d) => removeElements(d.slides[slideIdx], selectedIds))
    announce(`Deleted ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}`)
    st.select(null)
  }

  const duplicateSelected = () => {
    if (!selectedIds.length) return
    const copies = cloneElements(els, selectedIds, 30, uid)
    st.commit((d) => { d.slides[slideIdx].elements.push(...copies) })
    st.selectMany(copies.filter((c) => c.type !== 'arrow').map((c) => c.id))
    announce(`Duplicated ${copies.length} item${copies.length > 1 ? 's' : ''}`)
  }

  const nudge = (dx: number, dy: number) => {
    if (!selectedIds.length) return
    st.commit((d) => { for (const e of d.slides[slideIdx].elements) if (selectedIds.includes(e.id) && e.type !== 'arrow') { e.x += dx; e.y += dy } })
  }

  const reorder = (dir: 1 | -1 | 'front' | 'back') => {
    if (!selectedIds.length) return
    st.commit((d) => {
      const a = d.slides[slideIdx].elements
      if (dir === 'front' || dir === 'back') {
        const sel = a.filter((e) => selectedIds.includes(e.id)), rest = a.filter((e) => !selectedIds.includes(e.id))
        a.splice(0, a.length, ...(dir === 'front' ? [...rest, ...sel] : [...sel, ...rest]))
        return
      }
      const idx = a.map((e, i) => (selectedIds.includes(e.id) ? i : -1)).filter((i) => i >= 0)
      if (dir > 0) { for (const i of idx.reverse()) if (i < a.length - 1 && !selectedIds.includes(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]] }
      else { for (const i of idx) if (i > 0 && !selectedIds.includes(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]] }
    })
    announce(dir === 'front' ? 'Brought to front' : dir === 'back' ? 'Sent to back' : dir > 0 ? 'Brought forward' : 'Sent backward')
  }

  const copySel = () => {
    if (!selectedIds.length) return
    clipboard = structuredClone(els.filter((x) => selectedIds.includes(x.id) || (x.type === 'arrow' && selectedIds.includes(x.from) && selectedIds.includes(x.to))))
    pasteCount = 0
    announce(`Copied ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}`)
  }
  const cutSel = () => { if (!selectedIds.length) return; copySel(); deleteSelected() }

  /** Paste the copy buffer; with `at`, the group's top-left lands there (menu paste), otherwise it is offset (shortcut paste). */
  const pasteClip = (at?: { x: number; y: number }) => {
    if (!clipboard.length) return
    pasteCount++
    const off = 30 * pasteCount
    const copies = cloneElements(clipboard, clipboard.map((c) => c.id), off, uid)
    if (at) {
      const mv = clipboard.filter((c) => c.type !== 'arrow')
      const minX = Math.min(...mv.map((c) => c.x)), minY = Math.min(...mv.map((c) => c.y))
      for (const c of copies) if (c.type !== 'arrow') { c.x = snap(c.x - off - minX + at.x); c.y = snap(c.y - off - minY + at.y) }
    }
    st.commit((d) => { d.slides[slideIdx].elements.push(...copies) })
    st.selectMany(copies.filter((c) => c.type !== 'arrow').map((c) => c.id))
    announce(`Pasted ${copies.length} item${copies.length > 1 ? 's' : ''}`)
  }

  const setReveal = (n: number) => {
    if (!selectedIds.length) return
    st.commit((d) => { for (const x of d.slides[slideIdx].elements) if (selectedIds.includes(x.id)) x.reveal = n })
    announce(`Set to appear on click ${n}`)
  }

  const arrange = (how: Align | 'h' | 'v') => {
    st.commit((d) => { const e = d.slides[slideIdx].elements; if (how === 'h' || how === 'v') distributeElements(e, selectedIds, how); else alignElements(e, selectedIds, how) })
  }

  // ---------- keyboard + clipboard ----------
  const latest = useRef({ deleteSelected, duplicateSelected, nudge, reorder, addImage, copySel, cutSel, pasteClip })
  latest.current = { deleteSelected, duplicateSelected, nudge, reorder, addImage, copySel, cutSel, pasteClip }
  const stateRef = useRef({ selectedIds, movable, editing, slideIdx })
  stateRef.current = { selectedIds, movable, editing, slideIdx }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.target as HTMLElement).closest?.('[aria-label="Slides"]')) return
      const { selectedIds: ids, movable: mv } = stateRef.current
      const k = e.key.toLowerCase()
      const L = latest.current
      if (hasMod(e) && k === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo() }
      else if (hasMod(e) && k === 'y') { e.preventDefault(); st.redo() }
      else if (hasMod(e) && k === 'a') { e.preventDefault(); st.selectMany(mv.map((x) => x.id)); announce(`Selected all ${mv.length} items`) }
      else if (hasMod(e) && k === 'd') { e.preventDefault(); L.duplicateSelected() }
      else if (hasMod(e) && (k === 'c' || k === 'x') && ids.length) { if (k === 'c') L.copySel(); else L.cutSel() }
      else if (hasMod(e) && (e.key === ']' || e.key === '[')) { e.preventDefault(); L.reorder(e.key === ']' ? 1 : -1) }
      else if (e.altKey && /^Digit[0-9]$/.test(e.code) && ids.length) {
        e.preventDefault()
        const n = Number(e.code.slice(5))
        st.commit((d) => { for (const x of d.slides[stateRef.current.slideIdx].elements) if (ids.includes(x.id)) x.reveal = n })
        announce(`Set to appear on click ${n}`)
      }
      else if (e.key === 'Escape') { setConnecting(null); st.select(null) }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) { e.preventDefault(); L.deleteSelected() }
      else if (e.key === 'Enter' && ids.length === 1) {
        const el = mv.find((x) => x.id === ids[0])
        if (el && TEXT_EDITABLE.includes(el.type)) { e.preventDefault(); setEditing(el.id) }
      }
      else if (e.key.startsWith('Arrow') && ids.length) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 2
        L.nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0)
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return
      const img = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (img) { e.preventDefault(); void latest.current.addImage(img); return }
      if (!clipboard.length) return
      e.preventDefault()
      latest.current.pasteClip()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste) }
  }, [st])

  // ---------- pointer: element drag / resize / select ----------
  const onElementDown = (e: React.PointerEvent, elId: string, mode: 'move' | 'resize') => {
    e.stopPropagation()
    if (e.button !== 0) return // right-click: leave the selection alone, the context menu decides
    const el = els.find((x) => x.id === elId)!
    if (connecting && el.type !== 'arrow') {
      if (!connecting.from) { setConnecting({ from: elId }); return }
      if (connecting.from !== elId) {
        const arrow = { ...makeElement('arrow', slide), type: 'arrow' as const, from: connecting.from, to: elId, accent: 'ink' as const }
        st.commit((d) => { d.slides[slideIdx].elements.push(arrow) })
        st.select(arrow.id)
      }
      setConnecting(null)
      return
    }
    const modifier = e.shiftKey || hasMod(e.nativeEvent)
    let group = useStore.getState().selectedIds
    const wasInGroup = group.includes(elId)
    if (mode === 'move') {
      if (modifier) {
        st.toggleSelect(elId)
        group = useStore.getState().selectedIds
        if (!group.includes(elId)) { announce(`Deselected. ${group.length} selected`); return }
      } else if (!wasInGroup) { st.select(elId); group = [elId] }
    } else { st.select(elId); group = [elId] }

    const starts = new Map(els.filter((x) => group.includes(x.id) && x.type !== 'arrow').map((x) => [x.id, { x: x.x, y: x.y, w: x.w, h: x.h }]))
    const p0 = { x: e.clientX, y: e.clientY }
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - p0.x) / scale, dy = (ev.clientY - p0.y) / scale
      if (!moved) { if (Math.hypot(dx, dy) * scale < 3) return; moved = true; st.checkpoint() }
      // smart guides: line the moving group up with other items (hold Alt to turn off)
      let gdx = 0, gdy = 0, gv: number[] = [], gh: number[] = []
      if (mode === 'move' && !ev.altKey) {
        const mv = [...starts.values()]
        const x1 = Math.min(...mv.map((m) => m.x)) + dx, y1 = Math.min(...mv.map((m) => m.y)) + dy
        const x2 = Math.max(...mv.map((m) => m.x + m.w)) + dx, y2 = Math.max(...mv.map((m) => m.y + m.h)) + dy
        const others = els.filter((o) => o.type !== 'arrow' && !starts.has(o.id) && !(o.reveal > useStore.getState().step && !showHidden)).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }))
        const r = snapToGuides({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, others)
        gdx = r.dx; gdy = r.dy; gv = r.v; gh = r.h
      }
      setGuides({ v: gv, h: gh })
      st.live((d) => {
        for (const t of d.slides[slideIdx].elements) {
          const s0 = starts.get(t.id); if (!s0) continue
          if (mode === 'move') { t.x = gv.length ? Math.round(s0.x + dx + gdx) : snap(s0.x + dx); t.y = gh.length ? Math.round(s0.y + dy + gdy) : snap(s0.y + dy) }
          else { t.w = Math.max(40, snap(s0.w + dx)); t.h = Math.max(30, snap(s0.h + dy)) }
        }
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setGuides({ v: [], h: [] })
      if (moved || modifier || mode !== 'move') return
      // plain click with no drag: file-manager style
      if (group.length > 1 && wasInGroup) st.select(elId)
      else if (group.length === 1 && wasInGroup && TEXT_EDITABLE.includes(el.type)) setEditing(elId)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---------- pointer: rubber-band selection on empty space ----------
  const onStageDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    setConnecting(null)
    const modifier = e.shiftKey || hasMod(e.nativeEvent)
    const base = modifier ? useStore.getState().selectedIds : []
    if (!modifier) st.select(null)
    const a = toStage(e.clientX, e.clientY)
    let active = false
    const move = (ev: PointerEvent) => {
      const b = toStage(ev.clientX, ev.clientY)
      if (!active) { if (Math.hypot(b.x - a.x, b.y - a.y) * scale < 4) return; active = true }
      const r = rectFromPoints(a.x, a.y, b.x, b.y)
      setMarquee(r)
      const hit = idsInRect(movable.filter((x) => !hiddenNow(x)), r)
      st.selectMany([...new Set([...base, ...hit])])
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      if (active) announce(`${useStore.getState().selectedIds.length} selected`)
      setMarquee(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const convertToCanvas = async () => {
    setConverting(true)
    try { const scene = await legacyToScene(slide); st.commit((d) => { const sl = d.slides[slideIdx]; sl.layout = 'canvas'; sl.scene = scene; sl.elements = [] }) } finally { setConverting(false) }
  }

  const convertToFlow = () => {
    const { flow, skipped } = legacyToFlow(slide)
    if (!flow.nodes.length) { announce('Nothing to convert: this slide has no boxes'); return }
    st.commit((d) => { const sl = d.slides[slideIdx]; sl.layout = 'flow'; sl.flow = flow; sl.elements = [] })
    announce(skipped ? `Converted to a flow diagram; ${skipped} item${skipped > 1 ? 's' : ''} could not be converted` : 'Converted to a flow diagram')
  }

  // ---------- right-click ----------
  /** Decide what the menu is about before it opens: the item under the pointer (selecting it, file-manager style) or empty space. */
  const onContextCapture = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest('[data-el-id]')?.getAttribute('data-el-id') ?? null
    const pos = toStage(e.clientX, e.clientY)
    setCtx({ id, ...pos })
    if (id && !useStore.getState().selectedIds.includes(id)) st.select(id)
    if (!id) st.select(null)
    setConnecting(null)
  }

  // ---------- file drop ----------
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const at = toStage(e.clientX, e.clientY)
    for (const f of e.dataTransfer.files) void addImage(f, at)
  }

  const n = selectedIds.length
  const single = n === 1 ? els.find((e) => e.id === selectedIds[0]) : undefined
  const revealSet = new Set(els.filter((e) => selectedIds.includes(e.id)).map((e) => e.reveal))
  const at = { x: ctx.x, y: ctx.y }
  const ALIGNS: [Align, string][] = [['left', 'Left edges'], ['center', 'Centres (horizontal)'], ['right', 'Right edges'], ['top', 'Top edges'], ['middle', 'Centres (vertical)'], ['bottom', 'Bottom edges']]

  const menu = ctx.id && n > 0 ? (
    <>
      {single && TEXT_EDITABLE.includes(single.type) && <ContextMenuItem onClick={() => setEditing(single.id)}>Edit text<ContextMenuShortcut>Enter</ContextMenuShortcut></ContextMenuItem>}
      <ContextMenuItem onClick={cutSel}>Cut<ContextMenuShortcut>{MOD}+X</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={copySel}>Copy<ContextMenuShortcut>{MOD}+C</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!clipboard.length} onClick={() => pasteClip(at)}>Paste here<ContextMenuShortcut>{MOD}+V</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={duplicateSelected}>Duplicate<ContextMenuShortcut>{MOD}+D</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Appears on click</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {Array.from({ length: Math.max(steps + 2, 6) }, (_, k) => (
            <ContextMenuItem key={k} onClick={() => setReveal(k)}>
              {k === 0 ? 'Always (from the start)' : `Click ${k}`}
              {revealSet.size === 1 && revealSet.has(k) && <Check className="ml-auto" />}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Arrange</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => reorder('front')}>Bring to front</ContextMenuItem>
          <ContextMenuItem onClick={() => reorder(1)}>Bring forward<ContextMenuShortcut>{MOD}+]</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem onClick={() => reorder(-1)}>Send backward<ContextMenuShortcut>{MOD}+[</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem onClick={() => reorder('back')}>Send to back</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      {n >= 2 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Align</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {ALIGNS.map(([how, label]) => <ContextMenuItem key={how} onClick={() => arrange(how)}>{label}</ContextMenuItem>)}
            <ContextMenuSeparator />
            <ContextMenuItem disabled={n < 3} onClick={() => arrange('h')}>Distribute horizontally</ContextMenuItem>
            <ContextMenuItem disabled={n < 3} onClick={() => arrange('v')}>Distribute vertically</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={deleteSelected}>Delete<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
    </>
  ) : (
    <>
      <ContextMenuItem disabled={!clipboard.length} onClick={() => pasteClip(at)}>Paste here<ContextMenuShortcut>{MOD}+V</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={() => st.selectMany(movable.map((e) => e.id))}>Select all<ContextMenuShortcut>{MOD}+A</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Add here</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {PALETTE.filter((p) => p.type !== 'arrow').map((p) => <ContextMenuItem key={p.type} onClick={() => add(p.type, at)}>{p.icon}{p.label}</ContextMenuItem>)}
          <ContextMenuItem onClick={() => add('arrow')}><ArrowRight size={16} />Arrow (pick two boxes)</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => setShowHidden((v) => !v)}>{showHidden ? 'Hide' : 'Show'} items not yet revealed</ContextMenuItem>
      <ContextMenuItem onClick={convertToFlow}>Convert boxes &amp; arrows to flow diagram</ContextMenuItem>
      <ContextMenuItem onClick={() => void convertToCanvas()}>Convert slide to canvas</ContextMenuItem>
    </>
  )

  return (
    <div ref={wrap} className="min-w-0 overflow-auto p-4" id="editor-canvas">
      <div className="mb-3 flex items-center gap-3 rounded-lg border bg-muted/50 p-2.5 text-sm">
        <span className="flex-1">Click the title to type. Click an item to select it; drag on empty space to select several; Shift/{MOD}-click to add. Press <kbd className="rounded border px-1">?</kbd> for all shortcuts.</span>
        <Button size="sm" variant="outline" onClick={convertToFlow}>To flow diagram</Button>
        <Button size="sm" disabled={converting} onClick={() => void convertToCanvas()}>{converting ? 'Converting…' : 'Convert to canvas'}</Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="toolbar" aria-label="Add to slide">
        {PALETTE.map((p) => (
          <Tooltip key={p.type}>
            <TooltipTrigger render={<Button variant={connecting && p.type === 'arrow' ? 'default' : 'outline'} size="sm" onClick={() => add(p.type)} />}>{p.icon}{p.label}</TooltipTrigger>
            <TooltipContent>Add {p.label.toLowerCase()} to this slide</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {connecting && <div className="mb-2 text-sm font-medium text-primary" role="status">{connecting.from ? 'Now click the box the arrow should point to' : 'Click the box the arrow starts from'} (Esc to cancel)</div>}

      <ContextMenu>
        <ContextMenuTrigger className="block w-fit" onContextMenuCapture={onContextCapture}>
      <div
        ref={stageRef} data-dropzone
        style={{ position: 'relative', width: STAGE_W * scale, height: STAGE_H * scale, boxShadow: dragOver ? '0 0 0 3px var(--color-primary)' : '0 1px 8px #0002', userSelect: 'none' }}
        onPointerDown={onStageDown}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)} onDrop={onDrop}
      >
        <SlideView slide={slide} step={step} theme={theme} edit={editCtx} ghost={showHidden} style={{ transform: `scale(${scale})` }} />
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: STAGE_W, height: STAGE_H, pointerEvents: 'none' }}>
          {movable.map((e) => {
            const sel = selectedIds.includes(e.id)
            return (
              <div
                key={e.id}
                ref={(n) => { if (n) overlayRefs.current.set(e.id, n); else overlayRefs.current.delete(e.id) }}
                data-el-id={e.id} role="button" aria-pressed={sel} aria-label={`${label(e)}. Appears on click ${e.reveal}. ${sel ? 'Selected.' : ''}`}
                tabIndex={hiddenNow(e) ? -1 : 0}
                onFocus={(ev) => { if (ev.currentTarget.matches(':focus-visible') && !useStore.getState().selectedIds.includes(e.id)) { st.select(e.id); announce(`${label(e)} selected`) } }}
                onPointerDown={(ev) => onElementDown(ev, e.id, 'move')}
                onDoubleClick={() => { if (TEXT_EDITABLE.includes(e.type)) setEditing(e.id) }}
                style={{ pointerEvents: editing === e.id || (hiddenNow(e) && !sel) ? 'none' : 'auto', position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h, cursor: connecting ? 'crosshair' : 'move',
                  outline: sel ? '3px solid var(--color-primary)' : e.reveal > step && showHidden ? '1px dashed #8a807233' : connecting?.from === e.id ? '3px solid #d9930d' : 'none' }}
                className="focus-visible:!outline-[4px] focus-visible:!outline-offset-2 focus-visible:!outline-primary"
              >
                {sel && selectedIds.length === 1 && <div aria-hidden onPointerDown={(ev) => onElementDown(ev, e.id, 'resize')} style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, background: 'var(--color-primary)', borderRadius: 4, cursor: 'nwse-resize' }} />}
              </div>
            )
          })}
        </div>
        {(guides.v.length > 0 || guides.h.length > 0) && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {guides.v.map((x) => <div key={'v' + x} className="absolute top-0 h-full w-px bg-fuchsia-500" style={{ left: x * scale }} />)}
            {guides.h.map((y) => <div key={'h' + y} className="absolute left-0 h-px w-full bg-fuchsia-500" style={{ top: y * scale }} />)}
          </div>
        )}
        {marquee && (
          <div aria-hidden className="pointer-events-none absolute border border-primary bg-primary/15"
            style={{ left: marquee.x * scale, top: marquee.y * scale, width: marquee.w * scale, height: marquee.h * scale }} />
        )}
        {dragOver && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-lg font-semibold text-primary">Drop image to add it</div>}
      </div>

        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          {menu}
        </ContextMenuContent>
      </ContextMenu>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-2" role="group" aria-label="Reveal steps">
        <span className="text-xs text-muted-foreground">{selectedIds.length ? `Show ${selectedIds.length} selected on click:` : 'Select items, then pick the click they appear on:'}</span>
        {Array.from({ length: steps + 2 }, (_, n) => {
          const cur = new Set(els.filter((e) => selectedIds.includes(e.id)).map((e) => e.reveal))
          const active = cur.size === 1 && cur.has(n)
          return <Button key={n} size="sm" disabled={!selectedIds.length} variant={active ? 'default' : 'outline'} onClick={() => setReveal(n)}>{n === 0 ? 'Always' : n}</Button>
        })}
        <Button size="sm" variant="secondary" disabled={!selectedIds.length} title="Move the selected items to a brand-new next step" onClick={() => { setReveal(steps + 1); st.setStep(steps + 1) }}><Plus size={16} /> Add step</Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Preview click">
        <span className="text-xs text-muted-foreground">Preview click:</span>
        {Array.from({ length: steps + 1 }, (_, n) => (
          <Button key={n} size="sm" variant={n === step ? 'default' : 'outline'} aria-pressed={n === step} onClick={() => st.setStep(n)}>{n}</Button>
        ))}
        <label className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={showHidden} onCheckedChange={setShowHidden} /> Show hidden items (faded)</label>
      </div>
    </div>
  )
}
