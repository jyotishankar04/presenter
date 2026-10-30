import { useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pick } from '../editor/ui'
import { layoutSchema } from './layout'
import { SAMPLES } from './samples'
import { parseSql } from './sqlParse'
import { toDbml, toMermaid, toSql } from './sqlGen'
import { toDrizzle, toPrisma } from './orm'
import { describeDiff, diffSchemas, isEmptyDiff, migrationSql } from './diff'
import type { Schema } from './types'

export function ImportSqlDialog({ open, onClose, onImport, hasTables }: { open: boolean; onClose: () => void; hasTables: boolean; onImport: (r: { tables: Schema['tables']; relationships: Schema['relationships'] }, mode: 'replace' | 'add') => void }) {
  const [sql, setSql] = useState('')
  const [mode, setMode] = useState<'replace' | 'add'>(hasTables ? 'add' : 'replace')
  const parsed = useMemo(() => (sql.trim() ? parseSql(sql) : null), [sql])
  const ok = !!parsed && parsed.schema.tables.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from SQL</DialogTitle>
          <DialogDescription>Paste <code>CREATE TABLE</code> (and optional <code>ALTER TABLE … FOREIGN KEY</code>) statements from PostgreSQL, MySQL or SQLite — a <code>pg_dump --schema-only</code> or <code>.schema</code> output works.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try a sample:</span>
          {SAMPLES.map((s) => <Button key={s.id} size="sm" variant="outline" title={s.description} onClick={() => setSql(s.sql.trim())}>{s.label}</Button>)}
        </div>
        <Textarea className="min-h-64 font-mono text-xs" spellCheck={false} placeholder="CREATE TABLE users (&#10;  id uuid PRIMARY KEY,&#10;  email text NOT NULL UNIQUE&#10;);" value={sql} onChange={(e) => setSql(e.target.value)} />
        {parsed && (
          <div className="text-sm" role="status">
            <p className={ok ? 'text-foreground' : 'text-destructive'}>{ok ? `Found ${parsed.schema.tables.length} table${parsed.schema.tables.length > 1 ? 's' : ''} and ${parsed.schema.relationships.length} relationship${parsed.schema.relationships.length === 1 ? '' : 's'}.` : 'No tables found.'}</p>
            {parsed.warnings.length > 0 && (
              <ul className="mt-1 max-h-24 list-disc overflow-auto pl-5 text-xs text-muted-foreground">{parsed.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul>
            )}
          </div>
        )}
        {hasTables && (
          <div className="flex items-center gap-2 text-sm" role="radiogroup" aria-label="Import mode">
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'add'} onChange={() => setMode('add')} /> Add to this schema</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace everything</label>
          </div>
        )}
        <DialogFooter>
          <Button disabled={!ok} onClick={() => { const laid = layoutSchema({ id: 'x', name: 'x', dialect: 'postgres', ...parsed!.schema }); onImport({ tables: laid.tables, relationships: laid.relationships }, hasTables ? mode : 'replace'); setSql(''); onClose() }}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const FORMATS = [
  { value: 'postgres', label: 'PostgreSQL', ext: 'sql' }, { value: 'mysql', label: 'MySQL', ext: 'sql' }, { value: 'sqlite', label: 'SQLite', ext: 'sql' },
  { value: 'prisma', label: 'Prisma schema', ext: 'prisma' }, { value: 'drizzle', label: 'Drizzle (PostgreSQL)', ext: 'ts' },
  { value: 'mermaid', label: 'Mermaid ER diagram', ext: 'mmd' }, { value: 'dbml', label: 'DBML', ext: 'dbml' }, { value: 'json', label: 'JSON (this app)', ext: 'json' },
] as const

export function exportText(s: Schema, format: string): string {
  if (format === 'mermaid') return toMermaid(s)
  if (format === 'dbml') return toDbml(s)
  if (format === 'prisma') return toPrisma(s)
  if (format === 'drizzle') return toDrizzle(s)
  if (format === 'json') return JSON.stringify(s, null, 2) + '\n'
  return toSql(s, format as 'postgres' | 'mysql' | 'sqlite')
}

export function ExportDialog({ open, onClose, schema }: { open: boolean; onClose: () => void; schema: Schema }) {
  const [format, setFormat] = useState<string>(schema.dialect === 'generic' ? 'postgres' : schema.dialect)
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => (open ? exportText(schema, format) : ''), [open, schema, format])
  const ext = FORMATS.find((f) => f.value === format)?.ext ?? 'txt'

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a'); a.href = url; a.download = `${schema.name.replace(/[^\w-]+/g, '_') || 'schema'}.${ext}`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export “{schema.name}”</DialogTitle>
          <DialogDescription>{schema.tables.length} tables, {schema.relationships.length} relationships.</DialogDescription>
        </DialogHeader>
        <div className="w-64"><Pick value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} /></div>
        <Textarea readOnly className="min-h-80 font-mono text-xs" spellCheck={false} value={text} aria-label="Exported text" onFocus={(e) => e.currentTarget.select()} />
        <DialogFooter>
          <Button variant="outline" onClick={download}><Download /> Download .{ext}</Button>
          <Button onClick={async () => { await navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Paste the SQL of another version; see what differs and get the SQL that migrates it to this schema. */
export function CompareDialog({ open, onClose, schema }: { open: boolean; onClose: () => void; schema: Schema }) {
  const [old, setOld] = useState('')
  const [dialect, setDialect] = useState<string>(schema.dialect === 'generic' ? 'postgres' : schema.dialect)
  const [copied, setCopied] = useState(false)
  const res = useMemo(() => {
    if (!open || !old.trim()) return null
    const parsed = parseSql(old)
    const a: Schema = { ...schema, tables: parsed.schema.tables, relationships: parsed.schema.relationships }
    const d = diffSchemas(a, schema)
    return { lines: describeDiff(d), empty: isEmptyDiff(d), sql: migrationSql(a, schema, dialect as Schema['dialect']), warn: parsed.warnings }
  }, [open, old, schema, dialect])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare with an older version</DialogTitle>
          <DialogDescription>Paste the CREATE TABLE SQL of the <b>old</b> database. You get the differences and the SQL that changes it into “{schema.name}”. Renamed tables or columns show up as a drop plus an add, so review before running.</DialogDescription>
        </DialogHeader>
        <Textarea className="min-h-32 font-mono text-xs" spellCheck={false} value={old} onChange={(e) => setOld(e.target.value)} placeholder="CREATE TABLE users (...);" aria-label="Old schema SQL" />
        <div className="w-64"><Pick value={dialect} onChange={setDialect} options={[{ value: 'postgres', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'sqlite', label: 'SQLite' }]} /></div>
        {res && (
          <>
            <ul className="max-h-40 overflow-auto rounded-md border p-2 font-mono text-xs" aria-label="Differences">
              {res.empty ? <li>No differences.</li> : res.lines.map((l, i) => <li key={i} className={l[0] === '+' ? 'text-green-600' : l[0] === '-' ? 'text-red-500' : 'text-amber-500'}>{l}</li>)}
            </ul>
            <Textarea readOnly className="min-h-40 font-mono text-xs" value={res.sql} aria-label="Migration SQL" onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
        <DialogFooter><Button disabled={!res} onClick={async () => { await navigator.clipboard?.writeText(res?.sql ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy migration'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
