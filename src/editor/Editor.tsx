import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Keyboard, NotebookPen, Play, Redo2, TriangleAlert, Undo2 } from 'lucide-react'
import { api, ConflictError } from '../api'
import type { Deck } from '../model/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'
import { announce, LiveRegion } from '@/lib/announce'
import { hasMod, isTyping, MOD, useBrowserGuard } from '@/lib/shortcuts'
import { CanvasEditor } from './CanvasEditor'
import { FlowEditor } from './FlowEditor'
import { SchemaSlideEditor } from './SchemaSlideEditor'
import { LegacyCanvas } from './LegacyCanvas'
import { SlideList, useSlideActions } from './SlideList'
import { LegacyPanel } from './Props'
import { currentSlide, useStore } from './store'
import { BackgroundPicker } from '@/components/BackgroundPicker'
import { ThemePicker } from '@/components/ThemePicker'
import { BackgroundContext } from '../render/background'

export function Editor() {
  const { id } = useParams()
  const nav = useNavigate()
  const st = useStore()
  const act = useSlideActions()
  const { deck, slideIdx } = st
  const slide = currentSlide(st)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [help, setHelp] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const isCanvas = slide?.layout === 'canvas'
  const isFlow = slide?.layout === 'flow'
  const isSchema = slide?.layout === 'schema'
  const fullWidth = isCanvas || isFlow || isSchema
  const [conflict, setConflict] = useState(false)
  const revRef = useRef<string | null>(null)

  // read the revision BEFORE the deck, so an edit landing in between is detected as a conflict, not lost
  useEffect(() => { api.rev(id!).then((r) => { revRef.current = r.rev; return api.get(id!) }).then(st.load) }, [id])

  /** Save, refusing to overwrite a version someone else (e.g. an AI agent) wrote since we last read it. */
  const persist = async (d: Deck, force = false): Promise<boolean> => {
    setSaveState('saving')
    try {
      const r = await api.save(d, force ? null : revRef.current)
      revRef.current = r.rev; useStore.getState().markSaved(); setSaveState('saved'); setConflict(false)
      return true
    } catch (e) {
      setSaveState('error'); if (e instanceof ConflictError) setConflict(true)
      return false
    }
  }

  const saveNow = async () => {
    const d = useStore.getState().deck
    if (d && (await persist(d))) announce('Saved')
  }

  // debounced autosave (paused while there is an unresolved conflict)
  useEffect(() => {
    if (!deck || !st.dirty || conflict) return
    setSaveState('saving')
    const t = setTimeout(() => { void persist(deck) }, 600)
    return () => clearTimeout(t)
  }, [deck, st.dirty, conflict])

  // notice when the deck file changes underneath us (AI agent over MCP, another tab...)
  useEffect(() => {
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible' || !id) return
      busy = true
      try {
        const { rev } = await api.rev(id)
        if (!rev || rev === revRef.current) return
        if (useStore.getState().dirty) { setConflict(true); return }
        const fresh = await api.get(id)
        revRef.current = rev
        const cur = useStore.getState().deck
        if (JSON.stringify(fresh) !== JSON.stringify(cur)) { useStore.getState().replaceDeck(fresh); announce('Deck updated from outside the editor') }
      } catch { /* server briefly unavailable */ } finally { busy = false }
    }
    const t = setInterval(tick, 1500)
    return () => clearInterval(t)
  }, [id])

  const loadLatest = async () => {
    const { rev } = await api.rev(id!)
    const fresh = await api.get(id!)
    revRef.current = rev; useStore.getState().replaceDeck(fresh); setConflict(false); setSaveState('saved'); announce('Loaded the latest version')
  }

  useBrowserGuard({ onSave: saveNow })

  // editor-wide shortcuts (slide-level things work on every slide type)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target)
      const k = e.key
      if (!typing && (k === '?' || (hasMod(e) && k === '/'))) { e.preventDefault(); setHelp(true) }
      else if (hasMod(e) && k === 'Enter') { e.preventDefault(); nav(`/present/${id}#${useStore.getState().slideIdx}.0`) }
      else if (hasMod(e) && k.toLowerCase() === 'm') { e.preventDefault(); act.add(isCanvas ? 'canvas' : isFlow ? 'flow' : isSchema ? 'schema' : 'content') }
      else if (!typing && (k === 'PageDown' || k === 'PageUp') && (e.altKey || !fullWidth)) { e.preventDefault(); act.goto(useStore.getState().slideIdx + (k === 'PageDown' ? 1 : -1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!deck || !slide) return <div className="p-10" role="status">Loading…</div>

  return (
    <TooltipProvider>
      <BackgroundContext.Provider value={deck.background}>
      <a href="#editor-canvas" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-2 focus:top-2">Skip to slide</a>
      <LiveRegion />
      <div className="grid h-full grid-rows-[auto_1fr] bg-muted/40 select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text">
        <div>
        <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/" />}>← Decks</Button>
          <input aria-label="Deck title" value={deck.title} onChange={(e) => st.commit((d) => { d.title = e.target.value })} className="flex-1 bg-transparent text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <ThemePicker value={deck.theme} onChange={(t) => st.commit((d) => { d.theme = t })} />
          <BackgroundPicker theme={deck.theme} value={deck.background} onChange={(b) => st.commit((d) => { d.background = b === 'theme' ? undefined : b })} className="w-40 justify-between" />
          {!fullWidth && <>
            <Button variant="outline" size="icon-sm" title={`Undo (${MOD}+Z)`} aria-label="Undo" disabled={!st.past.length} onClick={st.undo}><Undo2 /></Button>
            <Button variant="outline" size="icon-sm" title={`Redo (${MOD}+Shift+Z)`} aria-label="Redo" disabled={!st.future.length} onClick={st.redo}><Redo2 /></Button>
          </>}
          <span className={`w-14 text-xs ${saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="off">{saveState}</span>
          <Button variant="outline" size="icon-sm" title="Speaker notes for this slide" aria-label="Speaker notes" onClick={() => setNotesOpen(true)}><NotebookPen className={slide.notes ? 'text-primary' : ''} /></Button>
          <Button variant="outline" size="icon-sm" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}><Keyboard /></Button>
          <Button size="sm" nativeButton={false} title={`Present (${MOD}+Enter)`} render={<Link to={`/present/${deck.id}#${slideIdx}.0`} />}><Play /> Present</Button>
        </header>
        {conflict && (
          <div role="alert" className="flex items-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
            <TriangleAlert className="size-4 shrink-0 text-amber-500" />
            <span className="flex-1">This deck was changed somewhere else (an AI agent or another tab). Your unsaved edits are paused so nothing gets overwritten.</span>
            <Button size="sm" variant="outline" onClick={() => void loadLatest()}>Load latest (discard mine)</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = useStore.getState().deck; if (d) void persist(d, true) }}>Keep mine (overwrite)</Button>
          </div>
        )}
        </div>

        <div className={`grid min-h-0 ${fullWidth ? 'grid-cols-[210px_1fr]' : 'grid-cols-[210px_1fr_320px]'}`}>
          <SlideList />
          {isSchema
            ? <SchemaSlideEditor key={slide.id} slideIdx={slideIdx} slide={slide} theme={deck.theme} />
            : isFlow
            ? <FlowEditor key={slide.id} slideIdx={slideIdx} slide={slide} theme={deck.theme} />
            : isCanvas
            ? <CanvasEditor key={slide.id} slideIdx={slideIdx} scene={slide.scene} theme={deck.theme} />
            : <>
                <LegacyCanvas key={slide.id} slide={slide} slideIdx={slideIdx} theme={deck.theme} deckId={deck.id} />
                <LegacyPanel slide={slide} slideIdx={slideIdx} deckId={deck.id} />
              </>}
        </div>
      </div>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Speaker notes</DialogTitle><DialogDescription>Private reminders for this slide. In the presenter, press S to show them; they never appear on the slide itself.</DialogDescription></DialogHeader>
          <Textarea autoFocus className="min-h-48" aria-label="Speaker notes" value={slide.notes ?? ''} onChange={(e) => st.commit((d) => { const s = d.slides[slideIdx]; if (e.target.value) s.notes = e.target.value; else delete s.notes })} />
        </DialogContent>
      </Dialog>
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      </BackgroundContext.Provider>
    </TooltipProvider>
  )
}
