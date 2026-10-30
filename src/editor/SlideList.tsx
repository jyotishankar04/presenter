import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, CornerDownRight, ListTree, LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import { OutlineDialog, TemplateDialog } from './GenerateDialogs'
import { moveSlides, range } from '../model/ops'
import { STAGE_W, type Slide } from '../model/types'
import { SlideAny } from '../render/SlideAny'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MOD, hasMod } from '@/lib/shortcuts'
import { uid, useStore } from './store'

export type SlideKind = 'canvas' | 'flow' | 'schema' | 'content' | 'section'
const MAKE: Record<SlideKind, () => Omit<Slide, 'id'>> = {
  canvas: () => ({ layout: 'canvas', elements: [], scene: { elements: [], files: {} } }),
  flow: () => ({ layout: 'flow', title: 'New diagram', elements: [], flow: { nodes: [], edges: [] } }),
  schema: () => ({ layout: 'schema', title: 'Database schema', elements: [], schema: { id: 'slide', name: 'Schema', dialect: 'postgres', tables: [], relationships: [] } }),
  content: () => ({ layout: 'content', title: 'New slide', elements: [] }),
  section: () => ({ layout: 'section', title: 'New section', eyebrow: 'Part', elements: [] }),
}

/** Slide-level actions, shared by the buttons, the list keyboard handler and global shortcuts. */
export function useSlideActions() {
  const st = useStore()
  const sorted = () => [...new Set(st.slideSel.length ? st.slideSel : [st.slideIdx])].sort((a, b) => a - b)
  return {
    add(kind: SlideKind, where: 'before' | 'after' = 'after') {
      const at = where === 'before' ? Math.min(...sorted()) : Math.max(...sorted()) + 1
      st.commit((d) => { d.slides.splice(at, 0, { id: uid(), ...MAKE[kind]() } as Slide) })
      st.setSlide(at)
    },
    /** Inserts ready-made slides after the current selection and opens the first one. */
    insert(slides: Slide[]) {
      if (!slides.length) return
      const at = Math.max(...sorted()) + 1
      st.commit((d) => { d.slides.splice(at, 0, ...slides) })
      st.setSlide(at)
    },
    /** Adds a sub-slide at the end of the current slide's group (the slide plus its existing sub-slides). */
    addSub() {
      const slides = st.deck!.slides
      let top = st.slideIdx
      while (top > 0 && slides[top].sub) top--
      let end = top
      while (end + 1 < slides.length && slides[end + 1].sub) end++
      const cur = slides[st.slideIdx]
      const kind: SlideKind = cur.layout === 'canvas' || cur.layout === 'flow' || cur.layout === 'schema' ? cur.layout : 'content'
      st.commit((d) => { d.slides.splice(end + 1, 0, { id: uid(), ...MAKE[kind](), sub: true } as Slide) })
      st.setSlide(end + 1)
    },
    toggleSub() {
      const idx = sorted().filter((i) => i > 0)
      st.commit((d) => { for (const i of idx) d.slides[i].sub = d.slides[i].sub ? undefined : true })
    },
    duplicate() {
      const idx = sorted()
      const at = idx[idx.length - 1] + 1
      st.commit((d) => { d.slides.splice(at, 0, ...idx.map((i) => ({ ...structuredClone(d.slides[i]), id: uid() }))) })
      st.setSlide(at); st.setSlideSel(idx.map((_, k) => at + k))
    },
    remove() {
      const idx = sorted()
      if (idx.length >= (st.deck?.slides.length ?? 0)) return
      st.commit((d) => { d.slides = d.slides.filter((_, i) => !idx.includes(i)) })
      st.setSlide(Math.max(0, Math.min(idx[0], (st.deck?.slides.length ?? 1) - idx.length - 1)))
    },
    move(dir: -1 | 1) {
      const idx = sorted()
      const n = st.deck?.slides.length ?? 0
      if ((dir < 0 && idx[0] === 0) || (dir > 0 && idx[idx.length - 1] === n - 1)) return
      const before = dir < 0 ? idx[0] - 1 : idx[idx.length - 1] + 2
      const r = moveSlides(st.deck!.slides, idx, before)
      st.commit((d) => { d.slides = r.slides })
      st.setSlide(r.newIndices[0]); st.setSlideSel(r.newIndices)
    },
    moveEdge(edge: 'start' | 'end') {
      const idx = sorted()
      const r = moveSlides(st.deck!.slides, idx, edge === 'start' ? 0 : st.deck!.slides.length)
      st.commit((d) => { d.slides = r.slides })
      st.setSlide(r.newIndices[0]); st.setSlideSel(r.newIndices)
    },
    selectAll() { const n = st.deck?.slides.length ?? 0; st.setSlideSel(range(0, n - 1)) },
    goto(i: number) { const n = st.deck?.slides.length ?? 0; if (n) st.setSlide(Math.max(0, Math.min(n - 1, i))) },
  }
}

export function SlideList() {
  const st = useStore()
  const act = useSlideActions()
  const { deck, slideIdx, slideSel } = st
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const anchor = useRef(slideIdx)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // keep keyboard focus on the current slide when navigating inside the list
  useEffect(() => {
    if (listRef.current?.contains(document.activeElement)) itemRefs.current[slideIdx]?.focus()
  }, [slideIdx])

  if (!deck) return null
  const n = deck.slides.length

  const click = (e: React.MouseEvent, i: number) => {
    if (hasMod(e.nativeEvent)) {
      const on = slideSel.includes(i)
      const next = on ? slideSel.filter((x) => x !== i) : [...slideSel, i]
      st.setSlideSel(next.length ? next : [slideIdx])
      if (!on) { st.setSlide(i); st.setSlideSel(next) }
    } else if (e.shiftKey) {
      st.setSlide(i); st.setSlideSel(range(anchor.current, i))
    } else { anchor.current = i; st.setSlide(i) }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault()
      const d = k === 'ArrowDown' ? 1 : -1
      if (e.altKey) return act.move(d as 1 | -1)
      const to = Math.max(0, Math.min(n - 1, slideIdx + d))
      if (e.shiftKey) { st.setSlide(to); st.setSlideSel(range(anchor.current, to)) } else { anchor.current = to; act.goto(to) }
    } else if (k === 'Home' || k === 'End') { e.preventDefault(); anchor.current = k === 'Home' ? 0 : n - 1; act.goto(anchor.current) }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); act.remove() }
    else if (hasMod(e.nativeEvent) && k.toLowerCase() === 'd') { e.preventDefault(); act.duplicate() }
    else if (hasMod(e.nativeEvent) && k.toLowerCase() === 'a') { e.preventDefault(); st.setSlideSel(range(0, n - 1)) }
  }

  const insertionIndex = (e: React.DragEvent, i: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? i : i + 1
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-slides')
    const at = dropAt
    setDropAt(null)
    if (!raw || at == null) return
    const idx: number[] = JSON.parse(raw)
    const r = moveSlides(deck.slides, idx, at)
    st.commit((d) => { d.slides = r.slides })
    st.setSlide(r.newIndices[0]); st.setSlideSel(r.newIndices)
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-r bg-background" data-dropzone>
      <OutlineDialog open={outlineOpen} onClose={() => setOutlineOpen(false)} onInsert={act.insert} />
      <TemplateDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onInsert={act.insert} theme={deck.theme} />
      <div
        ref={listRef} role="listbox" aria-label="Slides" aria-multiselectable="true" aria-orientation="vertical"
        className="min-h-0 flex-1 select-none overflow-auto p-2.5"
        onKeyDown={onKeyDown} onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-slides')) { e.preventDefault(); if (e.target === e.currentTarget) setDropAt(n) } }}
        onDrop={onDrop} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null) }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {deck.slides.map((s, i) => {
          const selected = slideSel.includes(i) || i === slideIdx
          const many = slideSel.length > 1 && slideSel.includes(i)
          const top = deck.slides.slice(0, i + 1).filter((x) => !x.sub).length
          let subNo = 0
          if (s.sub) for (let k = i; k >= 0 && deck.slides[k].sub; k--) subNo++
          const label = s.sub ? `${top}.${subNo}` : String(top)
          const KINDS: [SlideKind, string][] = [['flow', 'Flow diagram slide'], ['schema', 'Database schema slide'], ['canvas', 'Canvas slide'], ['content', 'Content slide'], ['section', 'Section slide']]
          return (
            <div key={s.id}>
              {dropAt === i && <div className="-mt-1 mb-1 h-1 rounded bg-primary" aria-hidden />}
              <ContextMenu>
              <ContextMenuTrigger className="block" onContextMenuCapture={() => { if (!slideSel.includes(i)) { anchor.current = i; st.setSlide(i) } }}>
              <div
                ref={(el) => { itemRefs.current[i] = el }}
                role="option" aria-selected={selected} aria-label={`Slide ${i + 1} of ${n}: ${s.title || (s.layout === 'canvas' ? 'canvas slide' : 'untitled')}`}
                tabIndex={i === slideIdx ? 0 : -1} draggable
                onClick={(e) => click(e, i)}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible') && useStore.getState().slideIdx !== i) { anchor.current = i; st.setSlide(i) } }}
                onDragStart={(e) => {
                  const idx = slideSel.includes(i) ? [...slideSel].sort((a, b) => a - b) : [i]
                  if (!slideSel.includes(i)) { st.setSlide(i) }
                  e.dataTransfer.setData('application/x-slides', JSON.stringify(idx)); e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-slides')) { e.preventDefault(); e.stopPropagation(); setDropAt(insertionIndex(e, i)) } }}
                onDragEnd={() => setDropAt(null)}
                className={`mb-2.5 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring ${s.sub ? 'ml-5 border-l-2 border-primary/40 pl-2' : ''}`}
              >
                <div style={{ width: s.sub ? 160 : 188, height: s.sub ? 90 : 106, overflow: 'hidden', borderRadius: 4, outline: i === slideIdx ? '3px solid var(--color-primary)' : selected ? '3px solid color-mix(in oklab, var(--color-primary) 55%, transparent)' : '1px solid var(--color-border)', pointerEvents: 'none' }}>
                  <SlideAny slide={s} step={999} theme={deck.theme} style={{ transform: `scale(${(s.sub ? 160 : 188) / STAGE_W})` }} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{label}. {s.title || (s.layout === 'canvas' ? 'Canvas' : '(untitled)')}</div>
              </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                {many && <ContextMenuGroup><ContextMenuLabel>{slideSel.length} slides selected</ContextMenuLabel></ContextMenuGroup>}
                <ContextMenuSub>
                  <ContextMenuSubTrigger>New slide after</ContextMenuSubTrigger>
                  <ContextMenuSubContent>{KINDS.map(([k, label]) => <ContextMenuItem key={k} onClick={() => act.add(k, 'after')}>{label}</ContextMenuItem>)}</ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>New slide before</ContextMenuSubTrigger>
                  <ContextMenuSubContent>{KINDS.map(([k, label]) => <ContextMenuItem key={k} onClick={() => act.add(k, 'before')}>{label}</ContextMenuItem>)}</ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuItem onClick={act.addSub}>Add sub-slide</ContextMenuItem>
                <ContextMenuItem disabled={i === 0} onClick={act.toggleSub}>{s.sub ? 'Make top-level slide' : 'Make sub-slide of the slide above'}</ContextMenuItem>
                <ContextMenuItem onClick={act.duplicate}>Duplicate<ContextMenuShortcut>{MOD}+D</ContextMenuShortcut></ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={Math.min(...slideSel, slideIdx) === 0} onClick={() => act.move(-1)}>Move up<ContextMenuShortcut>Alt+↑</ContextMenuShortcut></ContextMenuItem>
                <ContextMenuItem disabled={Math.max(...slideSel, slideIdx) === n - 1} onClick={() => act.move(1)}>Move down<ContextMenuShortcut>Alt+↓</ContextMenuShortcut></ContextMenuItem>
                <ContextMenuItem disabled={Math.min(...slideSel, slideIdx) === 0} onClick={() => act.moveEdge('start')}>Move to start</ContextMenuItem>
                <ContextMenuItem disabled={Math.max(...slideSel, slideIdx) === n - 1} onClick={() => act.moveEdge('end')}>Move to end</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={act.selectAll}>Select all slides<ContextMenuShortcut>{MOD}+A</ContextMenuShortcut></ContextMenuItem>
                <ContextMenuItem variant="destructive" disabled={slideSel.length >= n} onClick={act.remove}>Delete{many ? ` ${slideSel.length} slides` : ''}<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
              </ContextMenuContent>
              </ContextMenu>
            </div>
          )
        })}
        {dropAt === n && <div className="mb-1 h-1 rounded bg-primary" aria-hidden />}
      </div>

      <div className="flex flex-wrap gap-1.5 border-t p-2.5" role="toolbar" aria-label="Slide actions">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" title={`Add slide (${MOD}+M)`} aria-label="Add slide" />}><Plus /></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {([['flow', 'Flow diagram slide', 'Nodes and arrows (React Flow), auto-layout'], ['schema', 'Database schema slide', 'Tables and relationships, revealed step by step'], ['canvas', 'Canvas slide', 'Draw anything, reveal step by step'], ['content', 'Content slide', 'Fixed layout with a title'], ['section', 'Section slide', 'Big centred title']] as const).map(([k, label, hint]) => (
              <DropdownMenuItem key={k} onClick={() => act.add(k)}><div><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div></DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setTemplatesOpen(true)}><LayoutTemplate /><div><div className="font-medium">From a template…</div><div className="text-xs text-muted-foreground">Architecture, A vs B, code walkthrough…</div></div></DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOutlineOpen(true)}><ListTree /><div><div className="font-medium">From an outline…</div><div className="text-xs text-muted-foreground">Type bullets, get slides</div></div></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" title="Add a sub-slide under the current slide" aria-label="Add sub-slide" onClick={act.addSub}><CornerDownRight /> Sub-slide</Button>
        <Button variant="outline" size="icon-sm" title={`Duplicate (${MOD}+D)`} aria-label="Duplicate selected slides" onClick={act.duplicate}><Copy /></Button>
        <Button variant="outline" size="icon-sm" title="Move up (Alt+↑)" aria-label="Move selected slides up" disabled={Math.min(...slideSel, slideIdx) === 0} onClick={() => act.move(-1)}><ChevronUp /></Button>
        <Button variant="outline" size="icon-sm" title="Move down (Alt+↓)" aria-label="Move selected slides down" disabled={Math.max(...slideSel, slideIdx) === n - 1} onClick={() => act.move(1)}><ChevronDown /></Button>
        <Button variant="outline" size="icon-sm" title="Delete (Del)" aria-label="Delete selected slides" disabled={n <= 1} onClick={act.remove}><Trash2 /></Button>
      </div>
    </div>
  )
}
