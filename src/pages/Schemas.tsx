import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Database, Download, FileCode2, Pencil, Plus, Trash2 } from 'lucide-react'
import { schemaApi, type SchemaInfo } from '../api'
import { AppNav } from '@/components/AppNav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useBrowserGuard } from '@/lib/shortcuts'
import { DialectSelect } from '../schema/SchemaPanels'
import { ImportSqlDialog, exportText } from '../schema/SchemaDialogs'
import { layoutSchema } from '../schema/layout'
import { SAMPLES } from '../schema/samples'
import { parseSql } from '../schema/sqlParse'
import { emptySchema, type Dialect, type Schema } from '../schema/types'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'schema'
const rnd = () => Math.random().toString(36).slice(2, 5)

export function Schemas() {
  const nav = useNavigate()
  const [list, setList] = useState<SchemaInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [dialect, setDialect] = useState<Dialect>('postgres')
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<SchemaInfo | null>(null)
  const [msg, setMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  useBrowserGuard()
  const load = () => schemaApi.list().then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [])

  const freeId = (base: string) => { let id = slug(base); if (list.some((s) => s.id === id)) id += '-' + rnd(); return id }
  const save = async (s: Schema) => { await schemaApi.save(s); nav(`/schema/${s.id}`) }

  const create = async () => { if (name.trim()) await save(emptySchema(freeId(name), name.trim(), dialect)) }
  const fromSample = async (id: string) => {
    const smp = SAMPLES.find((s) => s.id === id)!
    await save(layoutSchema({ id: freeId(smp.label), name: smp.label, dialect: 'postgres', ...parseSql(smp.sql).schema }))
  }
  const duplicate = async (s: SchemaInfo) => { const src = await schemaApi.get(s.id); await schemaApi.save({ ...src, id: s.id + '-copy-' + rnd(), name: s.name + ' (copy)' }); load() }
  const exportSql = async (s: SchemaInfo) => {
    const src = await schemaApi.get(s.id)
    const url = URL.createObjectURL(new Blob([exportText(src, src.dialect === 'generic' ? 'postgres' : src.dialect)], { type: 'text/plain' }))
    const a = document.createElement('a'); a.href = url; a.download = `${s.id}.sql`; a.click(); URL.revokeObjectURL(url)
  }
  const importFiles = async (files: FileList | File[]) => {
    let n = 0
    for (const f of files) {
      const text = await f.text()
      try {
        if (f.name.endsWith('.json')) { const s = JSON.parse(text) as Schema; if (!Array.isArray(s.tables)) throw new Error(); await schemaApi.save({ ...s, id: freeId(s.id || s.name || f.name) }); n++ }
        else { const r = parseSql(text); if (!r.schema.tables.length) throw new Error(); await schemaApi.save(layoutSchema({ id: freeId(f.name.replace(/\.\w+$/, '')), name: f.name.replace(/\.\w+$/, ''), dialect: 'postgres', ...r.schema })); n++ }
      } catch { setMsg(`“${f.name}” isn’t a SQL file with CREATE TABLE statements, or a schema .json`); return }
    }
    setMsg(n ? `Imported ${n} schema${n > 1 ? 's' : ''}` : ''); load()
  }

  return (
    <div className={`mx-auto max-w-3xl px-5 py-14 ${dragOver ? 'rounded-xl ring-2 ring-primary' : ''}`} data-dropzone
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }} onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(e.dataTransfer.files) }}>
      <AppNav />
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Database schemas</h1>
      <p className="mb-6 text-sm text-muted-foreground">Design tables and relationships visually. Import from SQL, export to PostgreSQL / MySQL / SQLite / Mermaid / DBML, and drop any schema into a deck as a slide.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button onClick={() => { setName(''); setCreating(true) }}><Plus /> New schema</Button>
        <Button variant="outline" onClick={() => setImporting(true)}><FileCode2 /> Import SQL</Button>
        <Button variant="outline" nativeButton={false} render={<label />}><Download className="rotate-180" /> Open .sql / .json<input type="file" multiple accept=".sql,.json,text/plain,application/json" className="sr-only" onChange={(e) => e.target.files && importFiles(e.target.files)} /></Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground" role="status">{msg || 'Tip: drop a .sql or schema .json file anywhere on this page.'}</p>

      <div className="grid gap-2.5">
        {list.map((s) => (
          <ContextMenu key={s.id}>
            <ContextMenuTrigger className="block">
              <Card className="flex-row items-center gap-3 px-4 py-3">
                <Database className="size-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{s.dialect}</Badge>{s.tables} tables · {s.relationships} relationships</div>
                </div>
                <Button size="sm" nativeButton={false} render={<Link to={`/schema/${s.id}`} />}><Pencil /> Open</Button>
                <Button size="icon-sm" variant="ghost" title="Duplicate" aria-label={`Duplicate ${s.name}`} onClick={() => duplicate(s)}><Copy /></Button>
                <Button size="icon-sm" variant="ghost" title="Export SQL" aria-label={`Export ${s.name} as SQL`} onClick={() => exportSql(s)}><Download /></Button>
                <Button size="icon-sm" variant="ghost" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 /></Button>
              </Card>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => nav(`/schema/${s.id}`)}><Pencil />Open</ContextMenuItem>
              <ContextMenuItem onClick={() => duplicate(s)}><Copy />Duplicate</ContextMenuItem>
              <ContextMenuItem onClick={() => exportSql(s)}><Download />Export SQL</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => setDeleting(s)}><Trash2 />Delete…</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No schemas yet. Create one, import SQL, or start from a sample below.</p>}
      </div>

      <h2 className="mb-2 mt-10 text-sm font-semibold">Start from a sample</h2>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {SAMPLES.map((s) => (
          <button key={s.id} onClick={() => void fromSample(s.id)} className="rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <div className="font-medium">{s.label}</div><div className="text-xs text-muted-foreground">{s.description}</div>
          </button>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New schema</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Schema name, e.g. Shop database" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <div className="w-52"><DialectSelect value={dialect} onChange={setDialect} /></div>
          <DialogFooter><Button disabled={!name.trim()} onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportSqlDialog open={importing} onClose={() => setImporting(false)} hasTables={false}
        onImport={async (r) => { const nm = 'Imported schema'; await save({ id: freeId(nm), name: nm, dialect: 'postgres', tables: r.tables, relationships: r.relationships }) }} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete “{deleting?.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes the schema file. Slides that already copied it keep their own copy.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await schemaApi.remove(deleting!.id); setDeleting(null); load() }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
