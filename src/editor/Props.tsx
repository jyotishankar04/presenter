import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceBetween, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceBetween, Plus, Trash2, Copy } from 'lucide-react'
import { alignElements, cloneElements, distributeElements, removeElements, type Align } from '../model/ops'
import type { Accent, ArrowEl, El, Slide } from '../model/types'
import { api } from '../api'
import { demos } from '../demos'
import { CODE_LANGS } from '../render/CodeView'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { IconPicker } from '@/components/IconPicker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodePanel } from './CodePanel'
import { useStore } from './store'
import { Field, Num, Pick } from './ui'

const ACCENTS: Accent[] = ['amber', 'blue', 'green', 'red', 'ink', 'muted']
const SWATCH: Record<Accent, string> = { amber: '#d9930d', blue: '#4a6cf7', green: '#1f7a52', red: '#ef5b3f', ink: '#2a2622', muted: '#b8b0a3' }

function Colour({ value, onChange }: { value: Accent; onChange: (a: Accent) => void }) {
  return (
    <div className="flex gap-1.5">
      {ACCENTS.map((a) => (
        <button key={a} title={a} onClick={() => onChange(a)} style={{ background: SWATCH[a] }}
          className={`size-6 rounded-full border-2 ${value === a ? 'border-primary ring-2 ring-ring/40' : 'border-transparent'}`} />
      ))}
    </div>
  )
}

export function SlideProps({ slide, index }: { slide: Slide; index: number }) {
  const commit = useStore((s) => s.commit)
  const set = (fn: (s: Slide) => void) => commit((d) => fn(d.slides[index]))
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">Slide</h4>
      <Field label="Layout"><Pick value={slide.layout} options={['content', 'section']} onChange={(v) => set((s) => { s.layout = v as Slide['layout'] })} /></Field>
      <Field label="Title"><Input className="h-8" value={slide.title ?? ''} onChange={(e) => set((s) => { s.title = e.target.value })} /></Field>
      {slide.layout === 'section' && <Field label="Eyebrow"><Input className="h-8" value={slide.eyebrow ?? ''} onChange={(e) => set((s) => { s.eyebrow = e.target.value })} /></Field>}
    </div>
  )
}

export function ElementProps({ el, slide, slideIdx, deckId }: { el: El; slide: Slide; slideIdx: number; deckId: string }) {
  const commit = useStore((s) => s.commit)
  const select = useStore((s) => s.select)
  const upd = (fn: (e: any) => void) => commit((d) => { const e = d.slides[slideIdx].elements.find((x) => x.id === el.id); if (e) fn(e) })
  const boxes = slide.elements.filter((e) => e.type === 'box' || e.type === 'text' || e.type === 'image')
  const nameOf = (e: El) => (e.type === 'box' ? e.label.split('\n')[0] : e.type) + ' · ' + e.id.slice(0, 3)

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold capitalize">{el.type}</h4>

      {el.type === 'text' && <>
        <Field label="Text"><Textarea className="min-h-16" value={el.text} onChange={(e) => upd((x) => { x.text = e.target.value })} /></Field>
        <Field label="Size"><Num value={el.size} min={8} onChange={(n) => upd((x) => { x.size = n })} /></Field>
        <Field label="Font"><Pick value={el.style} options={['serif', 'sans', 'mono', 'hand']} onChange={(v) => upd((x) => { x.style = v })} /></Field>
        <Field label="Colour"><Colour value={el.accent} onChange={(a) => upd((x) => { x.accent = a })} /></Field>
        <Field label="Align"><Pick value={el.align} options={['left', 'center']} onChange={(v) => upd((x) => { x.align = v })} /></Field>
      </>}

      {el.type === 'box' && <>
        <Field label="Label"><Textarea className="min-h-12" value={el.label} onChange={(e) => upd((x) => { x.label = e.target.value })} /></Field>
        <Field label="Icon"><IconPicker value={el.icon} onChange={(n) => upd((x) => { x.icon = n })} /></Field>
        <Field label="Colour"><Colour value={el.accent} onChange={(a) => upd((x) => { x.accent = a })} /></Field>
        <Field label="Muted"><Switch checked={!!el.muted} onCheckedChange={(c) => upd((x) => { x.muted = c })} /></Field>
      </>}

      {el.type === 'arrow' && <>
        {(['from', 'to'] as const).map((k) => (
          <Field key={k} label={k}>
            <Pick value={(el as ArrowEl)[k] || '-'} onChange={(v) => upd((x) => { x[k] = v === '-' ? '' : v })}
              options={[{ value: '-', label: '—' }, ...boxes.map((b) => ({ value: b.id, label: nameOf(b) }))]} />
          </Field>
        ))}
        <Field label="Colour"><Colour value={el.accent} onChange={(a) => upd((x) => { x.accent = a })} /></Field>
        <Field label="Label"><Input className="h-8" value={el.label ?? ''} onChange={(e) => upd((x) => { x.label = e.target.value || undefined })} /></Field>
      </>}

      {el.type === 'cardList' && <>
        <Field label="Header"><Input className="h-8" value={el.header} onChange={(e) => upd((x) => { x.header = e.target.value })} /></Field>
        <Field label="Colour"><Colour value={el.accent} onChange={(a) => upd((x) => { x.accent = a })} /></Field>
        {el.cards.map((c, i) => (
          <div key={i} className="mb-2 flex items-center gap-1.5">
            <Input className="h-8" value={c.text} onChange={(e) => upd((x) => { x.cards[i].text = e.target.value })} />
            <Input className="h-8 w-14 shrink-0" type="number" title="appears on click" value={c.reveal} onChange={(e) => upd((x) => { x.cards[i].reveal = Number(e.target.value) })} />
            <Button size="icon-sm" variant="ghost" onClick={() => upd((x) => { x.cards.splice(i, 1) })}><Trash2 /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => upd((x) => { const last = x.cards[x.cards.length - 1]; x.cards.push({ text: 'New card', reveal: (last?.reveal ?? x.reveal) + 1 }) })}><Plus /> Card</Button>
      </>}

      {el.type === 'sequence' && <>
        <Field label="Actors"><Input className="h-8" value={el.actors.join(', ')} onChange={(e) => upd((x) => { x.actors = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} /></Field>
        {el.messages.map((m, i) => {
          const actors = el.actors.map((a, j) => ({ value: String(j), label: a }))
          return (
            <div key={i} className="mb-2 rounded-lg border p-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Pick value={String(m.from)} options={actors} onChange={(v) => upd((x) => { x.messages[i].from = Number(v) })} />
                <span>→</span>
                <Pick value={String(m.to)} options={actors} onChange={(v) => upd((x) => { x.messages[i].to = Number(v) })} />
              </div>
              <Input className="mb-1.5 h-8" value={m.text} onChange={(e) => upd((x) => { x.messages[i].text = e.target.value })} />
              <div className="flex items-center gap-1.5">
                <Pick value={m.kind} options={['request', 'response']} onChange={(v) => upd((x) => { x.messages[i].kind = v })} />
                <Input className="h-8 w-14 shrink-0" type="number" value={m.reveal} onChange={(e) => upd((x) => { x.messages[i].reveal = Number(e.target.value) })} />
                <Button size="icon-sm" variant="ghost" onClick={() => upd((x) => { x.messages.splice(i, 1) })}><Trash2 /></Button>
              </div>
            </div>
          )
        })}
        <Button size="sm" variant="outline" onClick={() => upd((x) => { const last = x.messages[x.messages.length - 1]; x.messages.push({ from: 0, to: Math.min(1, x.actors.length - 1), text: 'message', kind: 'request', reveal: (last?.reveal ?? x.reveal) + 1 }) })}><Plus /> Message</Button>
      </>}

      {el.type === 'mermaid' && <>
        <Field label="Source"><Textarea className="min-h-48 font-mono text-xs" spellCheck={false} value={el.code} onChange={(e) => upd((x) => { x.code = e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">Any Mermaid diagram: flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram…</p>
      </>}

      {el.type === 'code' && <>
        <Field label="Lang"><Pick value={el.lang} options={CODE_LANGS} onChange={(v) => upd((x) => { x.lang = v })} /></Field>
        <Field label="Size"><Num value={el.size} min={10} onChange={(n) => upd((x) => { x.size = n })} /></Field>
        <Field label="Code"><Textarea className="min-h-40 font-mono text-xs" spellCheck={false} value={el.code} onChange={(e) => upd((x) => { x.code = e.target.value })} /></Field>
        <div className="mb-1 text-xs text-muted-foreground">Focus lines (dims the rest from that click)</div>
        {el.focus.map((f, i) => (
          <div key={i} className="mb-2 flex items-center gap-1.5">
            <Input className="h-8" placeholder="2-4" value={f.lines} onChange={(e) => upd((x) => { x.focus[i].lines = e.target.value })} />
            <Input className="h-8 w-14 shrink-0" type="number" value={f.reveal} onChange={(e) => upd((x) => { x.focus[i].reveal = Number(e.target.value) })} />
            <Button size="icon-sm" variant="ghost" onClick={() => upd((x) => { x.focus.splice(i, 1) })}><Trash2 /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => upd((x) => { const last = x.focus[x.focus.length - 1]; x.focus.push({ lines: '1', reveal: (last?.reveal ?? x.reveal) + 1 }) })}><Plus /> Focus</Button>
      </>}

      {el.type === 'image' && (
        <Field label="File"><Input type="file" accept="image/*" className="h-8 text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const { src } = await api.upload(deckId, f); upd((x) => { x.src = src }) } }} /></Field>
      )}

      {el.type === 'demo' && <Field label="Demo"><Pick value={el.demo} options={Object.keys(demos)} onChange={(v) => upd((x) => { x.demo = v })} /></Field>}

      {el.type === 'strike' && <>
        <Field label="Wrong"><Input className="h-8" value={el.wrong} onChange={(e) => upd((x) => { x.wrong = e.target.value })} /></Field>
        <Field label="Right"><Input className="h-8" value={el.right} onChange={(e) => upd((x) => { x.right = e.target.value })} /></Field>
      </>}

      <Separator className="my-3" />
      <Field label="Appears"><Num value={el.reveal} min={0} onChange={(n) => upd((x) => { x.reveal = Math.max(0, n) })} /></Field>
      {el.type !== 'arrow' && (
        <div className="grid grid-cols-4 gap-1.5">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="text-[11px] text-muted-foreground">{k}<Num value={Math.round(el[k])} onChange={(n) => upd((x) => { x[k] = n })} /></label>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => commit((d) => { const els = d.slides[slideIdx].elements; const c = structuredClone(el); c.id = Math.random().toString(36).slice(2, 9); c.x += 30; c.y += 30; els.push(c); select(c.id) })}><Copy /> Duplicate</Button>
        <Button size="sm" variant="destructive" onClick={() => { commit((d) => { const s = d.slides[slideIdx]; s.elements = s.elements.filter((e) => e.id !== el.id && !(e.type === 'arrow' && (e.from === el.id || e.to === el.id))) }); select(null) }}><Trash2 /> Delete</Button>
      </div>
    </div>
  )
}

const ALIGN: { how: Align; label: string; icon: React.ReactNode }[] = [
  { how: 'left', label: 'Align left edges', icon: <AlignStartVertical /> },
  { how: 'center', label: 'Align centres horizontally', icon: <AlignCenterVertical /> },
  { how: 'right', label: 'Align right edges', icon: <AlignEndVertical /> },
  { how: 'top', label: 'Align top edges', icon: <AlignStartHorizontal /> },
  { how: 'middle', label: 'Align centres vertically', icon: <AlignCenterHorizontal /> },
  { how: 'bottom', label: 'Align bottom edges', icon: <AlignEndHorizontal /> },
]

/** Shown when several items are selected: set their step together, align, distribute. */
export function MultiProps({ ids, slide, slideIdx }: { ids: string[]; slide: Slide; slideIdx: number }) {
  const commit = useStore((s) => s.commit)
  const select = useStore((s) => s.select)
  const items = slide.elements.filter((e) => ids.includes(e.id))
  const steps = new Set(items.map((e) => e.reveal))
  const upd = (fn: (els: El[]) => void) => commit((d) => fn(d.slides[slideIdx].elements))
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">{ids.length} items selected</h4>
      <Field label="Appears"><Num value={steps.size === 1 ? [...steps][0] : 0} min={0} onChange={(n) => upd((els) => { for (const e of els) if (ids.includes(e.id)) e.reveal = Math.max(0, n) })} /></Field>
      {steps.size > 1 && <p className="mb-2 text-xs text-muted-foreground">They appear on different clicks; typing a number sets them all.</p>}
      <div className="mb-1 text-xs text-muted-foreground">Align</div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Align selected items">
        {ALIGN.map((a) => <Button key={a.how} size="icon-sm" variant="outline" title={a.label} aria-label={a.label} onClick={() => upd((els) => alignElements(els, ids, a.how))}>{a.icon}</Button>)}
        <Button size="icon-sm" variant="outline" title="Distribute horizontally (3+)" aria-label="Distribute horizontally" disabled={items.length < 3} onClick={() => upd((els) => distributeElements(els, ids, 'h'))}><AlignHorizontalSpaceBetween /></Button>
        <Button size="icon-sm" variant="outline" title="Distribute vertically (3+)" aria-label="Distribute vertically" disabled={items.length < 3} onClick={() => upd((els) => distributeElements(els, ids, 'v'))}><AlignVerticalSpaceBetween /></Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { const copies = cloneElements(slide.elements, ids, 30, () => Math.random().toString(36).slice(2, 9)); upd((els) => { els.push(...copies) }); select(null) }}><Copy /> Duplicate</Button>
        <Button size="sm" variant="destructive" onClick={() => { commit((d) => removeElements(d.slides[slideIdx], ids)); select(null) }}><Trash2 /> Delete</Button>
      </div>
    </div>
  )
}

/** Right-hand panel of a normal slide: properties for the selection plus the layers list. */
export function LegacyPanel({ slide, slideIdx, deckId }: { slide: Slide; slideIdx: number; deckId: string }) {
  const { selectedIds, selected, select, selectMany, toggleSelect } = useStore()
  const sel = slide.elements.find((e) => e.id === selected)
  const layerClick = (ev: React.MouseEvent, id: string) => {
    if (ev.shiftKey && selected) {
      const ids = slide.elements.map((e) => e.id)
      const a = ids.indexOf(selected), b = ids.indexOf(id)
      selectMany(ids.slice(Math.min(a, b), Math.max(a, b) + 1))
    } else if (ev.ctrlKey || ev.metaKey) toggleSelect(id)
    else select(id)
  }
  return (
    <div className="overflow-auto border-l bg-background p-3.5" aria-label="Slide properties">
      <Tabs defaultValue="visual">
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="visual" className="flex-1">Visual</TabsTrigger>
          <TabsTrigger value="code" className="flex-1">Code</TabsTrigger>
        </TabsList>
        <TabsContent value="visual">
          {selectedIds.length > 1 ? <MultiProps ids={selectedIds} slide={slide} slideIdx={slideIdx} />
            : sel ? <ElementProps key={sel.id} el={sel} slide={slide} slideIdx={slideIdx} deckId={deckId} />
            : <SlideProps slide={slide} index={slideIdx} />}
          <h4 className="mb-1.5 mt-6 text-sm font-semibold">Layers</h4>
          <div role="listbox" aria-label="Layers" aria-multiselectable="true">
            {slide.elements.map((e) => (
              <div key={e.id} role="option" aria-selected={selectedIds.includes(e.id)} tabIndex={0}
                onClick={(ev) => layerClick(ev, e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.id) } }}
                className={`cursor-pointer select-none rounded px-1.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedIds.includes(e.id) ? 'bg-accent' : 'hover:bg-muted'}`}>
                {e.type}{e.type === 'box' ? ` · ${e.label.split('\n')[0]}` : ''} <span className="text-muted-foreground">· click {e.reveal}</span>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="code"><CodePanel slide={slide} slideIdx={slideIdx} /></TabsContent>
      </Tabs>
    </div>
  )
}
