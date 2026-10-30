import '@xyflow/react/dist/style.css'
import { applyNodeChanges, Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow, type Edge, type Node, type NodeChange, type EdgeChange, type OnConnect } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRightLeft, GitCompare, Spline, Download, Eye, FileCode2, Maximize, MousePointerClick, Pencil, Plus, Redo2, Search, Undo2 } from 'lucide-react'
import { badgeColor } from '../flow/theme'
import { isDarkTheme } from '../model/themes'
import { useBackgroundAttr } from '../render/background'
import { STAGE_H, STAGE_W, type ThemeId } from '../model/types'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { announce } from '@/lib/announce'
import { hasMod, isTyping, MOD } from '@/lib/shortcuts'
import { Field } from '../editor/ui'
import { fkColumnSet, schemaToRf } from './adapt'
import { SchemaContext } from './context'
import { layoutSchema } from './layout'
import { schemaEdgeTypes, schemaNodeTypes } from './nodes'
import { addColumn, addTable, connectColumns, duplicateTable, freeSpot, mergeImported, moveColumn, removeColumn, removeTable } from './ops'
import { schemaSteps } from './reveal'
import { CompareDialog, ExportDialog, ImportSqlDialog } from './SchemaDialogs'
import { DialectSelect, RelPanel, Swatches, TablePanel } from './SchemaPanels'
import { SchemaSlideView } from './SchemaSlideView'
import { TABLE_W, type Column, type Dialect, type Relationship, type Schema, type Table } from './types'

export interface SchemaEditorProps {
  schema: Schema
  onChange: (s: Schema) => void
  theme: ThemeId
  mode: 'page' | 'slide'
  title?: string
  onTitle?: (t: string) => void
  /** Extra buttons for the top-left toolbar (e.g. "Add to deck"). */
  toolbarExtra?: ReactNode
}

export function SchemaEditor(props: SchemaEditorProps) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>
}

function Inner({ schema, onChange, theme, mode: kind, title, onTitle, toolbarExtra }: SchemaEditorProps) {
  const rf = useReactFlow()
  const bgAttr = useBackgroundAttr()
  const slideMode = kind === 'slide'
  const [nodes, setNodes] = useState<Node[]>(() => schemaToRf(schema, null).nodes)
  const [selEdge, setSelEdge] = useState<string | null>(null)
  const [selCol, setSelCol] = useState<{ table: string; column: string } | null>(null)
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [previewStep, setPreviewStep] = useState(0)
  const [orderMode, setOrderMode] = useState(false)
  const [nextOrder, setNextOrder] = useState(1)
  const [ctx, setCtx] = useState<{ kind: 'table' | 'edge' | 'pane'; id?: string; x: number; y: number }>({ kind: 'pane', x: 0, y: 0 })

  const schemaRef = useRef(schema); schemaRef.current = schema
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  /** The last schema this editor itself produced; anything else arriving via props came from outside (an AI agent, another tab). */
  const lastLocal = useRef<Schema>(schema)
  const firstRun = useRef(true)
  const emit = useCallback((s: Schema) => { lastLocal.current = s; onChangeRef.current(s) }, [])
  /** Select this table as soon as its node exists (right after it was added). */
  const pendingSelect = useRef<string | null>(null)
  const nodesRef = useRef<Node[]>([])
  const steps = schemaSteps(schema)
  const selTables = nodes.filter((n) => n.selected)
  const table1 = selTables.length === 1 ? schema.tables.find((t) => t.id === selTables[0].id) ?? null : null
  const rel1 = selEdge ? schema.relationships.find((r) => r.id === selEdge) ?? null : null

  // ---------- schema -> RF nodes (keeps selection, measurements and in-progress drags) ----------
  useEffect(() => {
    if (firstRun.current) firstRun.current = false
    else if (schema !== lastLocal.current) setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 250)
    const want = pendingSelect.current // read once, outside the updater (React may run updaters twice)
    if (want && schema.tables.some((t) => t.id === want)) pendingSelect.current = null
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return schema.tables.map((t) => {
        const o = old.get(t.id)
        return { ...(o ?? {}), id: t.id, type: 'table', position: o?.dragging ? o.position : { x: t.x, y: t.y }, selected: want ? t.id === want : o?.selected, data: { table: t, shown: true } } as Node
      })
    })
  }, [schema])

  const liveSchema = useMemo(() => {
    const pos = new Map(nodes.map((n) => [n.id, n.position]))
    return { ...schema, tables: schema.tables.map((t) => ({ ...t, x: pos.get(t.id)?.x ?? t.x, y: pos.get(t.id)?.y ?? t.y })) }
  }, [schema, nodes])
  const edges: Edge[] = useMemo(() => schemaToRf(liveSchema, null).edges.map((e) => ({ ...e, selected: e.id === selEdge })), [liveSchema, selEdge])
  const fkCols = useMemo(() => fkColumnSet(schema), [schema])

  // ---------- history ----------
  const lastJson = useRef(JSON.stringify(schema))
  const history = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  useEffect(() => {
    const t = setTimeout(() => {
      const json = JSON.stringify(schema)
      if (json === lastJson.current) return
      history.current.past = [...history.current.past.slice(-99), lastJson.current]; history.current.future = []; lastJson.current = json
    }, 250)
    return () => clearTimeout(t)
  }, [schema])
  const undo = () => { const h = history.current; if (!h.past.length) return; const prev = h.past.at(-1)!; h.past = h.past.slice(0, -1); h.future = [lastJson.current, ...h.future]; lastJson.current = prev; emit(JSON.parse(prev)); announce('Undone') }
  const redo = () => { const h = history.current; if (!h.future.length) return; const nx = h.future[0]; h.future = h.future.slice(1); h.past = [...h.past, lastJson.current]; lastJson.current = nx; emit(JSON.parse(nx)); announce('Redone') }

  // ---------- helpers ----------
  const mutate = useCallback((fn: (s: Schema) => Schema | void) => { const base = structuredClone(schemaRef.current); const out = fn(base) ?? base; emit(out) }, [onChange])
  const patchTable = (id: string, patch: Partial<Table>) => mutate((s) => { const t = s.tables.find((x) => x.id === id); if (t) Object.assign(t, patch) })
  const patchColumn = (tid: string, cid: string, patch: Partial<Column>) => mutate((s) => { const c = s.tables.find((x) => x.id === tid)?.columns.find((x) => x.id === cid); if (c) Object.assign(c, patch) })
  const patchRel = (id: string, patch: Partial<Relationship>) => mutate((s) => { const r = s.relationships.find((x) => x.id === id); if (r) Object.assign(r, patch) })
  nodesRef.current = nodes
  const selectOnly = (id: string | null) => { pendingSelect.current = id && !nodesRef.current.some((n) => n.id === id) ? id : null; setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id }))); setSelEdge(null); setSelCol(null) }

  const centre = () => { const el = document.getElementById('schema-canvas')?.getBoundingClientRect(); return rf.screenToFlowPosition({ x: (el?.left ?? 400) + (el?.width ?? 800) / 2, y: (el?.top ?? 300) + (el?.height ?? 600) / 2 }) }
  const doAddTable = (at?: { x: number; y: number }) => {
    const want = at ?? centre()
    const spot = freeSpot(schemaRef.current, { x: want.x - TABLE_W / 2, y: want.y - 60 })
    const r = addTable(schemaRef.current, spot); emit(r.schema); selectOnly(r.id); announce('Added table')
  }
  const doDeleteTable = (id: string) => { emit(removeTable(schemaRef.current, id)); setSelCol(null); announce('Deleted table') }
  const doDuplicate = (id: string) => { const r = duplicateTable(schemaRef.current, id); if (r) { emit(r.schema); selectOnly(r.id); announce('Duplicated table') } }
  const doAddColumn = (tid: string) => { const r = addColumn(schemaRef.current, tid, { name: 'column' }); if (r) { emit(r.schema); setSelCol({ table: tid, column: r.id }) } }
  const doLayout = () => { emit(layoutSchema(schemaRef.current)); setTimeout(() => rf.fitView({ padding: 0.12, duration: 300 }), 60); announce('Auto layout applied') }
  const doFit = () => rf.fitView({ padding: 0.12, duration: 300 })

  const commitPositions = useCallback((ns: Node[]) => {
    const pos = new Map(ns.map((n) => [n.id, n.position]))
    const cur = schemaRef.current
    if (!cur.tables.some((t) => { const p = pos.get(t.id); return p && (Math.round(p.x) !== t.x || Math.round(p.y) !== t.y) })) return
    emit({ ...cur, tables: cur.tables.map((t) => { const p = pos.get(t.id); return p ? { ...t, x: Math.round(p.x), y: Math.round(p.y) } : t }) })
  }, [onChange])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removed = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id)
    if (removed.length) { let s = schemaRef.current; for (const id of removed) s = removeTable(s, id); emit(s); announce(`Deleted ${removed.length} table${removed.length > 1 ? 's' : ''}`) }
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), ns))
    if (changes.some((c) => c.type === 'select' && (c as { selected: boolean }).selected)) setSelEdge(null)
  }, [onChange])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id)
    if (removed.length) { emit({ ...schemaRef.current, relationships: schemaRef.current.relationships.filter((r) => !removed.includes(r.id)) }); setSelEdge(null); announce('Deleted relationship') }
  }, [onChange])
  const onConnect: OnConnect = useCallback((c) => {
    const parse = (table: string, handle: string | null | undefined) => handle ? { table, column: handle.slice(0, handle.lastIndexOf('-')) } : null
    const a = parse(c.source, c.sourceHandle), b = parse(c.target, c.targetHandle)
    if (!a || !b) return
    const r = connectColumns(schemaRef.current, a, b)
    if (r) { emit(r.schema); setSelEdge(r.id); announce('Relationship created') } else announce('Those columns are already linked')
  }, [onChange])

  // ---------- click-order (slide mode) ----------
  const selKey = selTables.map((n) => n.id).join()
  const lastSel = useRef('')
  useEffect(() => {
    if (slideMode && orderMode && selKey && selKey !== lastSel.current) {
      const n = nextOrder
      const ids = new Set(selTables.map((x) => x.id))
      setNextOrder(n + 1)
      mutate((s) => { for (const t of s.tables) if (ids.has(t.id)) t.reveal = n })
      setNodes((ns) => ns.map((x) => ({ ...x, selected: false })))
      lastSel.current = ''
      return
    }
    lastSel.current = selKey
  }, [selKey, orderMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const setReveal = (n: number) => { const ids = new Set(selTables.map((x) => x.id)); mutate((s) => { for (const t of s.tables) if (ids.has(t.id)) t.reveal = n }) }

  // ---------- keyboard ----------
  const K = useRef({ undo, redo, doDuplicate, setReveal, selTables, steps, orderMode })
  K.current = { undo, redo, doDuplicate, setReveal, selTables, steps, orderMode }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.target as HTMLElement).closest?.('[aria-label="Slides"]')) return
      const k = e.key.toLowerCase(), A = K.current
      if (hasMod(e) && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo() }
      else if (hasMod(e) && k === 'y') { e.preventDefault(); A.redo() }
      else if (hasMod(e) && k === 'd') { e.preventDefault(); if (A.selTables[0]) A.doDuplicate(A.selTables[0].id) }
      else if (hasMod(e) && k === 'a') { e.preventDefault(); setNodes((ns) => ns.map((n) => ({ ...n, selected: true }))) }
      else if (slideMode && e.altKey && /^Digit[0-9]$/.test(e.code)) { e.preventDefault(); A.setReveal(Number(e.code.slice(5))) }
      else if (slideMode && e.altKey && e.code === 'KeyO') { e.preventDefault(); setOrderMode((o) => { if (!o) setNextOrder(A.steps + 1); return !o }) }
      else if (slideMode && e.altKey && e.code === 'KeyP') { e.preventDefault(); setOrderMode(false); setPreviewStep(0); setView((m) => (m === 'edit' ? 'preview' : 'edit')) }
      else if (e.key === 'Escape') { setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))); setSelEdge(null); setSelCol(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slideMode])
  useEffect(() => {
    if (view !== 'preview') return
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setPreviewStep((s) => Math.min(steps, s + 1)) } if (e.key === 'ArrowLeft') { e.preventDefault(); setPreviewStep((s) => Math.max(0, s - 1)) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [view, steps])

  // ---------- right-click ----------
  const onContextCapture = (e: React.MouseEvent) => {
    const nodeEl = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null
    const edgeEl = (e.target as HTMLElement).closest('.react-flow__edge') as HTMLElement | null
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (nodeEl) { const id = nodeEl.dataset.id!; setCtx({ kind: 'table', id, ...pos }); if (!nodes.find((n) => n.id === id)?.selected) selectOnly(id) }
    else if (edgeEl) { const id = edgeEl.dataset.id!; setCtx({ kind: 'edge', id, ...pos }); setSelEdge(id); setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))) }
    else { setCtx({ kind: 'pane', ...pos }); selectOnly(null) }
  }

  const ctxValue = useMemo(() => ({ theme, editable: true, badges: slideMode, fkCols, selectedColumn: selCol,
    onSelectColumn: (table: string, column: string) => { setSelCol({ table, column }); setSelEdge(null) },
    onAddColumn: (table: string) => doAddColumn(table) }), [theme, slideMode, fkCols, selCol]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = schema.tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  const focusTable = (id: string) => { selectOnly(id); rf.fitView({ nodes: [{ id }], padding: 1.2, duration: 350, maxZoom: 1 }) }
  const chips = Array.from({ length: steps + 2 }, (_, i) => i)
  const revealSet = new Set(selTables.map((n) => schema.tables.find((t) => t.id === n.id)?.reveal ?? 0))
  const activeStep = revealSet.size === 1 ? [...revealSet][0] : null

  const menu = ctx.kind === 'table' ? (
    <>
      <ContextMenuItem onClick={() => ctx.id && doAddColumn(ctx.id)}>Add column</ContextMenuItem>
      <ContextMenuItem onClick={() => ctx.id && doDuplicate(ctx.id)}>Duplicate<ContextMenuShortcut>{MOD}+D</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Colour</ContextMenuSubTrigger>
        <ContextMenuSubContent>{(['blue', 'green', 'amber', 'red', 'ink', 'muted'] as const).map((c) => <ContextMenuItem key={c} onClick={() => ctx.id && patchTable(ctx.id, { color: c })}>{c}</ContextMenuItem>)}</ContextMenuSubContent>
      </ContextMenuSub>
      {slideMode && <ContextMenuSub>
        <ContextMenuSubTrigger>Appears on click</ContextMenuSubTrigger>
        <ContextMenuSubContent>{Array.from({ length: Math.max(steps + 2, 6) }, (_, k) => <ContextMenuItem key={k} onClick={() => setReveal(k)}>{k === 0 ? 'Always (from the start)' : `Click ${k}`}</ContextMenuItem>)}</ContextMenuSubContent>
      </ContextMenuSub>}
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => ctx.id && doDeleteTable(ctx.id)}>Delete<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
    </>
  ) : ctx.kind === 'edge' ? (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Change kind</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => ctx.id && patchRel(ctx.id, { kind: 'N:1' })}>Many to one</ContextMenuItem>
          <ContextMenuItem onClick={() => ctx.id && patchRel(ctx.id, { kind: '1:1' })}>One to one</ContextMenuItem>
          <ContextMenuItem onClick={() => ctx.id && patchRel(ctx.id, { kind: '1:N' })}>One to many</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => { const id = ctx.id; if (id) { mutate((s) => { s.relationships = s.relationships.filter((r) => r.id !== id) }); setSelEdge(null) } }}>Delete relationship</ContextMenuItem>
    </>
  ) : (
    <>
      <ContextMenuItem onClick={() => doAddTable({ x: ctx.x, y: ctx.y })}>Add table here</ContextMenuItem>
      <ContextMenuItem onClick={() => setImportOpen(true)}>Import SQL…</ContextMenuItem>
      <ContextMenuItem onClick={() => setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))}>Select all<ContextMenuShortcut>{MOD}+A</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={doLayout}>Auto layout</ContextMenuItem>
      <ContextMenuItem onClick={doFit}>Fit to screen</ContextMenuItem>
    </>
  )

  return (
    <div id="editor-canvas" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_330px]">
        <div id="schema-canvas" className="relative min-h-0 min-w-0">
          {view === 'edit' ? (
            <SchemaContext.Provider value={ctxValue}>
              <ContextMenu>
                <ContextMenuTrigger className="block h-full w-full" onContextMenuCapture={onContextCapture}>
                  <div className="flow-theme h-full w-full" data-theme={theme} data-bg={bgAttr}>
                    <ReactFlow nodes={nodes} edges={edges} nodeTypes={schemaNodeTypes} edgeTypes={schemaEdgeTypes}
                      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                      onNodeDragStop={(_, __, ns) => commitPositions(ns as Node[])}
                      onEdgeClick={(_, e) => { setSelEdge(e.id); setSelCol(null); setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))) }}
                      onNodeClick={(e) => { if (!(e.target as HTMLElement).closest('.er-row')) setSelCol(null) }}
                      onPaneClick={() => { setSelEdge(null); setSelCol(null) }}
                      connectionMode={ConnectionMode.Loose} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} minZoom={0.1} maxZoom={2}
                      selectionOnDrag selectionMode={SelectionMode.Partial} panOnDrag={[1, 2]} multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
                      deleteKeyCode={['Backspace', 'Delete']} snapToGrid snapGrid={[10, 10]} elevateEdgesOnSelect proOptions={{ hideAttribution: true }}>
                      <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color={isDarkTheme(theme) ? '#ffffff22' : '#00000018'} />
                      <Controls showInteractive={false} position="bottom-left" />
                      {!slideMode && <MiniMap pannable zoomable position="bottom-right" nodeColor={() => (isDarkTheme(theme) ? '#3a3a44' : '#cfc8bb')} maskColor={isDarkTheme(theme) ? '#00000088' : '#ffffff99'} style={{ background: isDarkTheme(theme) ? '#18181b' : '#fff' }} />}
                      <Panel position="top-left" className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 p-1.5 text-foreground shadow-sm" aria-label="Schema tools">
                        <Button size="sm" onClick={() => doAddTable()}><Plus /> Table</Button>
                        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><FileCode2 /> Import SQL</Button>
                        <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}><Download /> Export</Button>
                        <Button size="sm" variant="outline" onClick={() => setCompareOpen(true)}><GitCompare /> Compare</Button>
                        <span className="mx-1 h-5 w-px bg-border" />
                        <Button size="sm" variant="outline" title="Change how relationship lines are drawn" onClick={() => mutate((s) => { s.edgeStyle = ({ step: 'curve', curve: 'straight', straight: 'step' } as const)[s.edgeStyle ?? 'step'] })}><Spline /> Lines: {schema.edgeStyle ?? 'step'}</Button>
                        <Button size="sm" variant="outline" onClick={doLayout}><ArrowRightLeft /> Layout</Button>
                        <Button size="icon-sm" variant="outline" title="Fit to screen" aria-label="Fit to screen" onClick={doFit}><Maximize /></Button>
                        <Button size="icon-sm" variant="outline" title={`Undo (${MOD}+Z)`} aria-label="Undo" onClick={undo}><Undo2 /></Button>
                        <Button size="icon-sm" variant="outline" title={`Redo (${MOD}+Shift+Z)`} aria-label="Redo" onClick={redo}><Redo2 /></Button>
                        {toolbarExtra}
                      </Panel>
                    </ReactFlow>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">{menu}</ContextMenuContent>
              </ContextMenu>
            </SchemaContext.Provider>
          ) : <PreviewBox schema={schema} title={title} theme={theme} step={previewStep} />}
        </div>

        <aside className="overflow-auto border-l bg-background p-3.5" aria-label="Schema properties">
          {rel1 ? (
            <RelPanel rel={rel1} schema={schema} onChange={(p) => patchRel(rel1.id, p)} onDelete={() => { mutate((s) => { s.relationships = s.relationships.filter((r) => r.id !== rel1.id) }); setSelEdge(null) }} />
          ) : table1 ? (
            <TablePanel key={table1.id} table={table1} dialect={schema.dialect} slideMode={slideMode}
              selectedColumn={selCol?.table === table1.id ? selCol.column : null} onSelectColumn={(c) => setSelCol(c ? { table: table1.id, column: c } : null)}
              onTable={(p) => patchTable(table1.id, p)} onColumn={(c, p) => patchColumn(table1.id, c, p)} onAddColumn={() => doAddColumn(table1.id)}
              onRemoveColumn={(c) => { emit(removeColumn(schemaRef.current, table1.id, c)); setSelCol(null) }} onMoveColumn={(c, d) => emit(moveColumn(schemaRef.current, table1.id, c, d))}
              onDuplicate={() => doDuplicate(table1.id)} onDelete={() => doDeleteTable(table1.id)} />
          ) : selTables.length > 1 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">{selTables.length} tables selected</h4>
              <Field label="Colour"><Swatches value="blue" onChange={(a) => { const ids = new Set(selTables.map((n) => n.id)); mutate((s) => { for (const t of s.tables) if (ids.has(t.id)) t.color = a }) }} /></Field>
              <Button size="sm" variant="destructive" onClick={() => { let s = schemaRef.current; for (const n of selTables) s = removeTable(s, n.id); emit(s) }}>Delete {selTables.length} tables</Button>
            </div>
          ) : (
            <div>
              <h4 className="mb-3 text-sm font-semibold">{slideMode ? 'Schema slide' : 'Schema'}</h4>
              {slideMode ? (
                <Field label="Title"><Input className="h-8" value={title ?? ''} onChange={(e) => onTitle?.(e.target.value)} /></Field>
              ) : (
                <Field label="Name"><Input className="h-8" value={schema.name} onChange={(e) => mutate((s) => { s.name = e.target.value })} aria-label="Schema name" /></Field>
              )}
              <Field label="Dialect"><DialectSelect value={schema.dialect as Dialect} onChange={(d) => mutate((s) => { s.dialect = d })} /></Field>
              <p className="mb-3 text-xs text-muted-foreground">{schema.tables.length} tables · {schema.relationships.length} relationships</p>
              {slideMode && (
                <div className="mb-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Reveal order</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => mutate((s) => { [...s.tables].sort((a, b) => a.x - b.x || a.y - b.y).forEach((t, i) => { t.reveal = i + 1 }) })}>One by one (left→right)</Button>
                    <Button size="sm" variant="outline" onClick={() => mutate((s) => { for (const t of s.tables) t.reveal = 0 })}>All at once</Button>
                  </div>
                </div>
              )}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
                <Input className="h-8 pl-8" placeholder="Find a table…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a table" />
              </div>
              <div role="listbox" aria-label="Tables" className="max-h-64 overflow-auto rounded-md border">
                {filtered.map((t) => (
                  <button key={t.id} role="option" aria-selected={false} onClick={() => focusTable(t.id)} className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                    <span className="truncate font-mono">{t.name}</span><span className="text-xs text-muted-foreground">{t.columns.length}</span>
                  </button>
                ))}
                {!filtered.length && <p className="p-3 text-xs text-muted-foreground">{schema.tables.length ? 'No match.' : 'No tables yet. Add one, or import SQL.'}</p>}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Drag from the dot beside one column to another table's column to create a foreign key. Drag empty space to select several tables; hold the middle or right mouse button to pan.</p>
            </div>
          )}
        </aside>
      </div>

      {slideMode && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-background px-3 py-2">
          <div className="flex rounded-md border p-0.5">
            <Button size="sm" variant={view === 'edit' ? 'default' : 'ghost'} onClick={() => { setView('edit'); setOrderMode(false) }}><Pencil /> Edit</Button>
            <Button size="sm" variant={view === 'preview' ? 'default' : 'ghost'} onClick={() => { setView('preview'); setOrderMode(false); setPreviewStep(0) }}><Eye /> Preview</Button>
          </div>
          {view === 'edit' ? (
            <>
              <span className="ml-2 text-xs text-muted-foreground">{orderMode ? <>Click tables in the order they should appear · <b>next is {nextOrder}</b></> : selTables.length ? <>Show {selTables.length} selected on click:</> : <>Select tables, then pick the click they appear on:</>}</span>
              {!orderMode && chips.map((n) => <Button key={n} size="sm" disabled={!selTables.length} variant={activeStep === n ? 'default' : 'outline'} style={n > 0 && activeStep !== n ? { borderColor: badgeColor(n), color: badgeColor(n) } : undefined} onClick={() => setReveal(n)}>{n === 0 ? 'Always' : n}</Button>)}
              {!orderMode && <Button size="sm" variant="secondary" disabled={!selTables.length} title="Move the selected items to a brand-new next step" onClick={() => setReveal(steps + 1)}><Plus /> Add step</Button>}
              <div className="ml-auto">{orderMode ? <Button size="sm" variant="secondary" onClick={() => setOrderMode(false)}>Done ordering</Button> : <Button size="sm" variant="outline" onClick={() => { setNextOrder(steps + 1); setOrderMode(true); setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))) }}><MousePointerClick /> Click-order</Button>}</div>
            </>
          ) : (
            <>
              <span className="ml-2 text-xs text-muted-foreground">Click:</span>
              {Array.from({ length: steps + 1 }, (_, n) => <Button key={n} size="sm" variant={previewStep === n ? 'default' : 'outline'} onClick={() => setPreviewStep(n)}>{n}</Button>)}
              <span className="text-xs text-muted-foreground">← → to step</span>
            </>
          )}
        </div>
      )}
      <ImportSqlDialog open={importOpen} onClose={() => setImportOpen(false)} hasTables={schema.tables.length > 0}
        onImport={(r, m) => {
          if (m === 'replace') emit({ ...schemaRef.current, tables: r.tables, relationships: r.relationships })
          else { const out = mergeImported(schemaRef.current, r); emit(out.schema) }
          setTimeout(() => rf.fitView({ padding: 0.12, duration: 300 }), 120); announce(`Imported ${r.tables.length} tables`)
        }} />
      <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} schema={schema} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} schema={schema} />
    </div>
  )
}

function PreviewBox({ schema, title, theme, step }: { schema: Schema; title?: string; theme: ThemeId; step: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setScale(Math.min((e.contentRect.width - 32) / STAGE_W, (e.contentRect.height - 32) / STAGE_H)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex h-full items-center justify-center bg-muted/40">
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, boxShadow: '0 1px 8px #0003' }}>
        <SchemaSlideView schema={schema} title={title} theme={theme} step={step} style={{ transform: `scale(${scale})` }} />
      </div>
    </div>
  )
}
