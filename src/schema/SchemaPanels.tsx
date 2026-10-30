import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import type { Accent } from '../model/types'
import { Field, Num, Pick } from '../editor/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DIALECTS, type Column, type Dialect, type RefAction, type RelKind, type Relationship, type Schema, type Table } from './types'

const ACCENTS: Accent[] = ['blue', 'green', 'amber', 'red', 'ink', 'muted']
const HEX: Record<Accent, string> = { amber: '#d9930d', blue: '#4a6cf7', green: '#1f7a52', red: '#ef5b3f', ink: '#2a2622', muted: '#b8b0a3' }
const ACTIONS: (RefAction | '')[] = ['', 'CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT']

const TYPES: Record<Dialect, string[]> = {
  postgres: ['uuid', 'text', 'varchar(255)', 'integer', 'bigint', 'smallint', 'serial', 'bigserial', 'boolean', 'numeric(10,2)', 'real', 'double precision', 'date', 'time', 'timestamp', 'timestamptz', 'jsonb', 'json', 'bytea', 'inet'],
  mysql: ['INT', 'BIGINT', 'SMALLINT', 'TINYINT(1)', 'VARCHAR(255)', 'TEXT', 'LONGTEXT', 'CHAR(36)', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'JSON', 'BLOB', 'ENUM(\'a\',\'b\')'],
  sqlite: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'VARCHAR(255)'],
  generic: ['int', 'bigint', 'varchar(255)', 'text', 'boolean', 'numeric(10,2)', 'date', 'timestamp', 'uuid', 'json'],
}

export function Swatches({ value, onChange }: { value: Accent; onChange: (a: Accent) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
      {ACCENTS.map((a) => <button key={a} role="radio" aria-checked={value === a} title={a} onClick={() => onChange(a)} style={{ background: HEX[a] }} className={`size-6 rounded-full border-2 ${value === a ? 'border-primary ring-2 ring-ring/40' : 'border-transparent'}`} />)}
    </div>
  )
}

function Flag({ on, label, title, onClick }: { on?: boolean; label: string; title: string; onClick: () => void }) {
  return <button type="button" title={title} aria-pressed={!!on} onClick={onClick} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${on ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>{label}</button>
}

export function TablePanel({ table, dialect, selectedColumn, onSelectColumn, onTable, onColumn, onAddColumn, onRemoveColumn, onMoveColumn, onDuplicate, onDelete, slideMode }: {
  table: Table; dialect: Dialect; selectedColumn: string | null; onSelectColumn: (id: string | null) => void
  onTable: (patch: Partial<Table>) => void; onColumn: (colId: string, patch: Partial<Column>) => void
  onAddColumn: () => void; onRemoveColumn: (id: string) => void; onMoveColumn: (id: string, dir: -1 | 1) => void
  onDuplicate: () => void; onDelete: () => void; slideMode: boolean
}) {
  const listId = `types-${dialect}`
  return (
    <div>
      <datalist id={listId}>{TYPES[dialect].map((t) => <option key={t} value={t} />)}</datalist>
      <h4 className="mb-3 text-sm font-semibold">Table</h4>
      <Field label="Name"><Input className="h-8 font-mono" value={table.name} onChange={(e) => onTable({ name: e.target.value })} aria-label="Table name" /></Field>
      <Field label="Colour"><Swatches value={table.color ?? 'blue'} onChange={(a) => onTable({ color: a })} /></Field>
      <Field label="Note"><Textarea className="min-h-12 text-xs" value={table.comment ?? ''} placeholder="What is this table for?" onChange={(e) => onTable({ comment: e.target.value || undefined })} /></Field>
      {slideMode && <Field label="Appears"><Num value={table.reveal ?? 0} min={0} onChange={(n) => onTable({ reveal: Math.max(0, n) })} /></Field>}

      <div className="mb-1.5 mt-4 flex items-center justify-between">
        <h5 className="text-xs font-semibold text-muted-foreground">Columns ({table.columns.length})</h5>
        <Button size="sm" variant="outline" onClick={onAddColumn}><Plus /> Add</Button>
      </div>
      <div className="grid gap-1.5" role="list" aria-label="Columns">
        {table.columns.map((c, i) => {
          const open = selectedColumn === c.id
          return (
            <div key={c.id} role="listitem" className={`rounded-lg border p-1.5 ${open ? 'border-primary bg-primary/5' : ''}`} onFocusCapture={() => onSelectColumn(c.id)}>
              <div className="flex items-center gap-1">
                <Input className="h-7 min-w-0 flex-1 font-mono text-xs" value={c.name} aria-label={`Column ${i + 1} name`} onChange={(e) => onColumn(c.id, { name: e.target.value })} />
                <Input className="h-7 w-28 font-mono text-xs" list={listId} value={c.type} aria-label={`Column ${c.name} type`} onChange={(e) => onColumn(c.id, { type: e.target.value })} />
              </div>
              <div className="mt-1 flex items-center gap-1">
                <Flag on={c.pk} label="PK" title="Primary key" onClick={() => onColumn(c.id, { pk: !c.pk, notNull: !c.pk ? true : c.notNull })} />
                <Flag on={c.notNull || c.pk} label="NN" title="Not null" onClick={() => onColumn(c.id, { notNull: !c.notNull })} />
                <Flag on={c.unique} label="UQ" title="Unique" onClick={() => onColumn(c.id, { unique: !c.unique })} />
                <Flag on={c.autoIncrement} label="AI" title="Auto increment" onClick={() => onColumn(c.id, { autoIncrement: !c.autoIncrement })} />
                <span className="flex-1" />
                <Button size="icon-sm" variant="ghost" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => onMoveColumn(c.id, -1)}><ArrowUp /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Move ${c.name} down`} disabled={i === table.columns.length - 1} onClick={() => onMoveColumn(c.id, 1)}><ArrowDown /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete column ${c.name}`} onClick={() => onRemoveColumn(c.id)}><Trash2 /></Button>
              </div>
              {open && (
                <div className="mt-1.5 grid gap-1">
                  <Input className="h-7 font-mono text-xs" placeholder="default (e.g. now(), 0, 'new')" value={c.default ?? ''} aria-label={`Column ${c.name} default`} onChange={(e) => onColumn(c.id, { default: e.target.value || undefined })} />
                  <Input className="h-7 text-xs" placeholder="comment" value={c.comment ?? ''} aria-label={`Column ${c.name} comment`} onChange={(e) => onColumn(c.id, { comment: e.target.value || undefined })} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <h5 className="text-xs font-semibold text-muted-foreground">Indexes ({table.indexes?.length ?? 0})</h5>
          <Button size="sm" variant="ghost" disabled={!table.columns.length} onClick={() => onTable({ indexes: [...(table.indexes ?? []), { id: 'ix' + Math.random().toString(36).slice(2, 7), name: `idx_${table.name}_${table.columns[0].name}`, columns: [table.columns[0].id] }] })}><Plus /> Index</Button>
        </div>
        <div className="grid gap-2" role="list" aria-label="Indexes">
          {(table.indexes ?? []).map((ix) => {
            const set = (p: Partial<typeof ix>) => onTable({ indexes: (table.indexes ?? []).map((x) => (x.id === ix.id ? { ...x, ...p } : x)) })
            return (
              <div key={ix.id} role="listitem" className="grid gap-1 rounded-md border p-2">
                <div className="flex gap-1">
                  <Input className="h-7 text-xs" value={ix.name} aria-label="Index name" onChange={(e) => set({ name: e.target.value })} />
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete index ${ix.name}`} onClick={() => onTable({ indexes: (table.indexes ?? []).filter((x) => x.id !== ix.id) })}><Trash2 /></Button>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {table.columns.map((c) => (
                    <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={ix.columns.includes(c.id)} onChange={(e) => { const cols = e.target.checked ? [...ix.columns, c.id] : ix.columns.filter((x) => x !== c.id); if (cols.length) set({ columns: table.columns.filter((x) => cols.includes(x.id)).map((x) => x.id) }) }} />{c.name}</label>
                  ))}
                  <label className="flex items-center gap-1 font-medium"><input type="checkbox" checked={!!ix.unique} onChange={(e) => set({ unique: e.target.checked || undefined })} />unique</label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" onClick={onDuplicate}><Copy /> Duplicate</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 /> Delete</Button>
      </div>
    </div>
  )
}

export function RelPanel({ rel, schema, onChange, onDelete }: { rel: Relationship; schema: Schema; onChange: (p: Partial<Relationship>) => void; onDelete: () => void }) {
  const f = schema.tables.find((t) => t.id === rel.from.table), t = schema.tables.find((x) => x.id === rel.to.table)
  const fc = f?.columns.find((c) => c.id === rel.from.column), tc = t?.columns.find((c) => c.id === rel.to.column)
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">Relationship</h4>
      <p className="mb-3 rounded-md bg-muted/50 p-2 font-mono text-xs">{f?.name}.{fc?.name} → {t?.name}.{tc?.name}</p>
      <Field label="Kind"><Pick value={rel.kind} onChange={(v) => onChange({ kind: v as RelKind })} options={[{ value: 'N:1', label: 'Many to one (foreign key)' }, { value: '1:1', label: 'One to one' }, { value: '1:N', label: 'One to many' }]} /></Field>
      <Field label="Name"><Input className="h-8 font-mono text-xs" placeholder="fk_orders_user" value={rel.name ?? ''} onChange={(e) => onChange({ name: e.target.value || undefined })} /></Field>
      <Field label="On delete"><Pick value={rel.onDelete ?? '-'} onChange={(v) => onChange({ onDelete: v === '-' ? undefined : (v as RefAction) })} options={ACTIONS.map((a) => ({ value: a || '-', label: a || '(default)' }))} /></Field>
      <Field label="On update"><Pick value={rel.onUpdate ?? '-'} onChange={(v) => onChange({ onUpdate: v === '-' ? undefined : (v as RefAction) })} options={ACTIONS.map((a) => ({ value: a || '-', label: a || '(default)' }))} /></Field>
      <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 /> Delete</Button>
    </div>
  )
}

export function DialectSelect({ value, onChange }: { value: Dialect; onChange: (d: Dialect) => void }) {
  return <Pick value={value} onChange={(v) => onChange(v as Dialect)} options={DIALECTS.map((d) => ({ value: d.value, label: d.label }))} />
}
