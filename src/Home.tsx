import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Download, Pencil, Play, Plus, Trash2, Upload } from 'lucide-react'
import { api, type DeckInfo } from './api'
import type { Deck } from './model/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppNav } from '@/components/AppNav'
import { ThemeCards, ThemeSwatch } from '@/components/ThemePicker'
import { themeDef, type ThemeId } from './model/themes'
import { useBrowserGuard } from '@/lib/shortcuts'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const uid = () => Math.random().toString(36).slice(2, 9)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'

export function Home() {
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [newTheme, setNewTheme] = useState<ThemeId>('sketch')
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<DeckInfo | null>(null)
  const nav = useNavigate()
  const [dragOver, setDragOver] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  useBrowserGuard()
  const load = () => api.list().then(setDecks).catch(() => setDecks([]))
  useEffect(() => { load() }, [])

  async function create() {
    if (!creating || !title.trim()) return
    let id = slug(title)
    if (decks.some((d) => d.id === id)) id += '-' + uid().slice(0, 3)
    await api.save({ id, title, theme: newTheme, slides: [{ id: uid(), layout: 'canvas', elements: [], scene: { elements: [], files: {} } }] })
    nav(`/edit/${id}`)
  }

  async function exportDeck(d: DeckInfo) {
    const deck = await api.get(d.id)
    const url = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${d.id}.json`; a.click(); URL.revokeObjectURL(url)
  }

  async function importFiles(files: FileList | File[]) {
    const done: string[] = []
    for (const f of files) {
      try {
        const deck = JSON.parse(await f.text()) as Deck
        if (!deck || !Array.isArray(deck.slides) || !deck.title) throw new Error('not a deck')
        let id = slug(deck.id || deck.title)
        if (decks.some((x) => x.id === id) || done.includes(id)) id += '-' + uid().slice(0, 3)
        await api.save({ ...deck, id }); done.push(id)
      } catch { setImportMsg(`“${f.name}” isn’t a deck file`); return }
    }
    setImportMsg(done.length ? `Imported ${done.length} deck${done.length > 1 ? 's' : ''}` : '')
    load()
  }

  async function duplicate(d: DeckInfo) {
    const src = await api.get(d.id)
    await api.save({ ...src, id: d.id + '-copy-' + uid().slice(0, 3), title: d.title + ' (copy)' })
    load()
  }

  return (
    <div className={`mx-auto max-w-3xl px-5 py-14 ${dragOver ? 'rounded-xl ring-2 ring-primary' : ''}`} data-dropzone
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(e.dataTransfer.files) }}>
      <AppNav />
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Presenter</h1>
      <p className="mb-6 text-sm text-muted-foreground">Step-by-step slides for coding and system design videos.</p>
      <div className="mb-6 flex gap-2">
        <Button onClick={() => { setTitle(''); setCreating(true) }}><Plus /> New deck</Button>
        <Button variant="outline" nativeButton={false} render={<label />}><Upload /> Import<input type="file" accept="application/json,.json" multiple className="sr-only" onChange={(e) => e.target.files && importFiles(e.target.files)} /></Button>
      </div>

      <p className="mb-3 text-sm text-muted-foreground" role="status">{importMsg || 'Tip: drop a deck .json file anywhere on this page to import it.'}</p>
      <div className="grid gap-2.5">
        {decks.map((d) => (
          <ContextMenu key={d.id}>
          <ContextMenuTrigger className="block">
          <Card className="flex-row items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-medium">{d.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="gap-1.5"><ThemeSwatch theme={themeDef(d.theme)} size={10} />{themeDef(d.theme).label}</Badge>{d.slides} slides</div>
            </div>
            <Button size="sm" nativeButton={false} render={<Link to={`/present/${d.id}`} />}><Play /> Present</Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to={`/edit/${d.id}`} />}><Pencil /> Edit</Button>
            <Button size="icon-sm" variant="ghost" title="Duplicate" aria-label={`Duplicate ${d.title}`} onClick={() => duplicate(d)}><Copy /></Button>
            <Button size="icon-sm" variant="ghost" title="Export as JSON" aria-label={`Export ${d.title}`} onClick={() => exportDeck(d)}><Download /></Button>
            <Button size="icon-sm" variant="ghost" title="Delete" aria-label={`Delete ${d.title}`} onClick={() => setDeleting(d)}><Trash2 /></Button>
          </Card>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => nav(`/present/${d.id}`)}><Play />Present</ContextMenuItem>
            <ContextMenuItem onClick={() => nav(`/edit/${d.id}`)}><Pencil />Edit</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => duplicate(d)}><Copy />Duplicate</ContextMenuItem>
            <ContextMenuItem onClick={() => exportDeck(d)}><Download />Export as JSON</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => setDeleting(d)}><Trash2 />Delete…</ContextMenuItem>
          </ContextMenuContent>
          </ContextMenu>
        ))}
        {decks.length === 0 && <p className="text-sm text-muted-foreground">No decks yet.</p>}
      </div>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New deck</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Deck title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <ThemeCards value={newTheme} onChange={setNewTheme} />
          <DialogFooter><Button onClick={create} disabled={!title.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete “{deleting?.title}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes the deck file. It can't be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await api.remove(deleting!.id); setDeleting(null); load() }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
