import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Keyboard, Presentation, TriangleAlert } from 'lucide-react'
import { api, ConflictError, schemaApi } from '../api'
import type { ThemeId } from '../model/types'
import { ThemePicker } from '@/components/ThemePicker'
import { isThemeId } from '../model/themes'
import { SchemaEditor } from '../schema/SchemaEditor'
import type { Schema } from '../schema/types'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { announce, LiveRegion } from '@/lib/announce'
import { hasMod, isTyping, useBrowserGuard } from '@/lib/shortcuts'

const THEME_KEY = 'schema-theme'
const readTheme = (): ThemeId => { try { const t = localStorage.getItem(THEME_KEY); return isThemeId(t) ? t : 'dark' } catch { return 'dark' } }
const rid = () => Math.random().toString(36).slice(2, 8)

export function SchemaPage() {
  const { id } = useParams()
  const [schema, setSchema] = useState<Schema | null>(null)
  const [theme, setTheme] = useState<ThemeId>(readTheme)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [conflict, setConflict] = useState(false)
  const [help, setHelp] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const [decks, setDecks] = useState<{ id: string; title: string }[]>([])
  const [added, setAdded] = useState<{ deck: string; title: string; n: number } | null>(null)
  const revRef = useRef<string | null>(null)
  const dirty = useRef(false)
  const current = useRef<Schema | null>(null)
  current.current = schema

  useEffect(() => { schemaApi.rev(id!).then((r) => { revRef.current = r.rev; return schemaApi.get(id!) }).then((s) => { setSchema(s) }) }, [id])

  const persist = async (s: Schema, force = false) => {
    setSaveState('saving')
    try { const r = await schemaApi.save(s, force ? null : revRef.current); revRef.current = r.rev; dirty.current = false; setSaveState('saved'); setConflict(false); return true }
    catch (e) { setSaveState('error'); if (e instanceof ConflictError) setConflict(true); return false }
  }
  const saveNow = async () => { if (current.current && (await persist(current.current))) announce('Saved') }
  useBrowserGuard({ onSave: saveNow })

  const onChange = (s: Schema) => { dirty.current = true; setSchema(s) }
  useEffect(() => {
    if (!schema || !dirty.current || conflict) return
    setSaveState('saving')
    const t = setTimeout(() => { void persist(schema) }, 600)
    return () => clearTimeout(t)
  }, [schema, conflict])

  // pick up edits made elsewhere (AI agent over MCP, another tab)
  useEffect(() => {
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible' || !id) return
      busy = true
      try {
        const { rev } = await schemaApi.rev(id)
        if (!rev || rev === revRef.current) return
        if (dirty.current) { setConflict(true); return }
        const fresh = await schemaApi.get(id); revRef.current = rev
        if (JSON.stringify(fresh) !== JSON.stringify(current.current)) { setSchema(fresh); announce('Schema updated from outside the editor') }
      } catch { /* server briefly unavailable */ } finally { busy = false }
    }
    const t = setInterval(tick, 1500)
    return () => clearInterval(t)
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (!isTyping(e.target) && (e.key === '?' || (hasMod(e) && e.key === '/'))) { e.preventDefault(); setHelp(true) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loadLatest = async () => { const { rev } = await schemaApi.rev(id!); const s = await schemaApi.get(id!); revRef.current = rev; dirty.current = false; setSchema(s); setConflict(false); setSaveState('saved') }
  const changeTheme = (t: string) => { setTheme(t as ThemeId); try { localStorage.setItem(THEME_KEY, t) } catch { /* private mode */ } }

  const openDeckPicker = async () => { setAdded(null); setDeckOpen(true); setDecks((await api.list()).map((d) => ({ id: d.id, title: d.title }))) }
  const addToDeck = async (deckId: string) => {
    if (!current.current) return
    const deck = await api.get(deckId)
    const s = structuredClone(current.current)
    const slide = { id: rid(), layout: 'schema' as const, title: s.name, elements: [], schema: { ...s, id: 'slide', tables: s.tables.map((t, i) => ({ ...t, reveal: i + 1 })) } }
    deck.slides.push(slide)
    await api.save(deck)
    setAdded({ deck: deckId, title: deck.title, n: deck.slides.length })
  }

  if (!schema) return <div className="p-10" role="status">Loading…</div>
  return (
    <TooltipProvider>
      <LiveRegion />
      <div className="grid h-full grid-rows-[auto_1fr] bg-muted/40 select-none [&_input]:select-text [&_textarea]:select-text">
        <div>
          <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/schemas" />}>← Schemas</Button>
            <input aria-label="Schema name" value={schema.name} onChange={(e) => onChange({ ...schema, name: e.target.value })} className="flex-1 bg-transparent text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <ThemePicker value={theme} onChange={(t) => changeTheme(t)} className="w-40 justify-between" />
            <span className={`w-14 text-xs ${saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{saveState}</span>
            <Button variant="outline" size="icon-sm" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}><Keyboard /></Button>
            <Button size="sm" onClick={() => void openDeckPicker()}><Presentation /> Add to a deck</Button>
          </header>
          {conflict && (
            <div role="alert" className="flex items-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-amber-500" />
              <span className="flex-1">This schema was changed somewhere else (an AI agent or another tab). Your unsaved edits are paused so nothing gets overwritten.</span>
              <Button size="sm" variant="outline" onClick={() => void loadLatest()}>Load latest (discard mine)</Button>
              <Button size="sm" variant="outline" onClick={() => { if (current.current) void persist(current.current, true) }}>Keep mine (overwrite)</Button>
            </div>
          )}
        </div>
        <div className="flex min-h-0"><SchemaEditor key={schema.id} schema={schema} onChange={onChange} theme={theme} mode="page" /></div>
      </div>
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <Dialog open={deckOpen} onOpenChange={(o) => !o && setDeckOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add “{schema.name}” to a deck</DialogTitle>
            <DialogDescription>A copy becomes a new slide at the end of the deck, with its tables set to appear one by one. Changing this schema later won't change the slide.</DialogDescription>
          </DialogHeader>
          {added ? (
            <div className="grid gap-2 text-sm" role="status">
              <p>Added as slide {added.n} of “{added.title}”.</p>
              <div className="flex gap-2">
                <Button size="sm" nativeButton={false} render={<Link to={`/edit/${added.deck}`} />}>Open the deck</Button>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link to={`/present/${added.deck}#${added.n - 1}.0`} />}>Present it</Button>
              </div>
            </div>
          ) : (
            <div className="grid max-h-72 gap-1.5 overflow-auto">
              {decks.map((d) => <Button key={d.id} variant="outline" className="justify-start" onClick={() => void addToDeck(d.id)}>{d.title}</Button>)}
              {!decks.length && <p className="text-sm text-muted-foreground">No decks yet. Create one on the Decks page first.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
