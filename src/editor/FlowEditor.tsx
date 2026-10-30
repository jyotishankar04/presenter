import '@xyflow/react/dist/style.css'
import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, ConnectionMode, Controls, MarkerType, Panel, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow, type Edge, type EdgeChange, type Node, type NodeChange, type OnConnect } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Plus, ArrowDownUp, ArrowRightLeft, Box, Database, Diamond, Eye, GitBranch, Maximize, MousePointerClick, Pencil, Pill, StickyNote, Trash2, Copy, Wand2 } from 'lucide-react'
import { fromRf, toRf } from '../flow/adapt'
import { FlowSlideView } from '../flow/FlowSlideView'
import { autoReveal, layoutFlow } from '../flow/layout'
import { edgeTypes, nodeTypes } from '../flow/nodes'
import { flowSteps } from '../flow/reveal'
import { isDarkTheme } from '../model/themes'
import { useBackgroundAttr } from '../render/background'
import { ACCENT_HEX, badgeColor, FlowContext } from '../flow/theme'
import { cloneFlowSelection } from '../flow/clone'
import { defaultSize, emptyFlow, FLOW_SHAPES, type FlowData, type FlowDirection, type FlowShape } from '../flow/types'
import { STAGE_H, STAGE_W, type Accent, type Slide, type ThemeId } from '../model/types'
import { IconPicker } from '@/components/IconPicker'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { COMPONENT_GROUPS, COMPONENTS, type ComponentPreset } from '../flow/components'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { announce } from '@/lib/announce'
import { hasMod, isTyping, MOD } from '@/lib/shortcuts'
import { FlowMermaidDialog } from './FlowMermaidDialog'
import { useStore } from './store'
import { Field, Num, Pick } from './ui'

const rid = () => Math.random().toString(36).slice(2, 8)
const ACCENTS: Accent[] = ['amber', 'blue', 'green', 'red', 'ink', 'muted']
const SHAPE_META: Record<FlowShape, { label: string; icon: React.ReactNode; text: string; accent: Accent }> = {
  box: { label: 'Step', icon: <Box size={16} />, text: 'New step', accent: 'blue' },
  decision: { label: 'Decision', icon: <Diamond size={16} />, text: 'Condition?', accent: 'amber' },
  pill: { label: 'Start / end', icon: <Pill size={16} />, text: 'Start', accent: 'amber' },
  database: { label: 'Database', icon: <Database size={16} />, text: 'Database', accent: 'green' },
  note: { label: 'Note', icon: <StickyNote size={16} />, text: 'Note', accent: 'ink' },
}

let flowClip: FlowData | null = null
let pasteCount = 0

const marker = (theme: ThemeId, accent: Accent) => ({ type: MarkerType.ArrowClosed, color: ACCENT_HEX[theme][accent], width: 18, height: 18 })

export function FlowEditor(props: { slideIdx: number; slide: Slide; theme: ThemeId }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>
}

function Inner({ slideIdx, slide, theme }: { slideIdx: number; slide: Slide; theme: ThemeId }) {
  const setFlow = useStore((s) => s.setFlow)
  const commit = useStore((s) => s.commit)
  const rf = useReactFlow()
  const bgAttr = useBackgroundAttr()
  const first = useMemo(() => toRf(slide.flow ?? emptyFlow(), theme, null), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes] = useState<Node[]>(first.nodes)
  const [edges, setEdges] = useState<Edge[]>(first.edges)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [previewStep, setPreviewStep] = useState(0)
  const [orderMode, setOrderMode] = useState(false)
  const [nextOrder, setNextOrder] = useState(1)
  const [mermaidOpen, setMermaidOpen] = useState(false)
  const [dir, setDir] = useState<FlowDirection>('LR')
  const [ctx, setCtx] = useState<{ kind: 'node' | 'edge' | 'pane'; id?: string; x: number; y: number }>({ kind: 'pane', x: 0, y: 0 })

  const stored = useMemo(() => fromRf(nodes, edges), [nodes, edges])
  const steps = flowSteps(stored)
  const selNodes = nodes.filter((n) => n.selected)
  const selEdges = edges.filter((e) => e.selected)

  // ---------- persistence + undo history ----------
  const lastJson = useRef(JSON.stringify(fromRf(first.nodes, first.edges)))
  const history = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  useEffect(() => {
    const t = setTimeout(() => {
      const json = JSON.stringify(stored)
      if (json === lastJson.current) return
      history.current.past = [...history.current.past.slice(-99), lastJson.current]
      history.current.future = []
      lastJson.current = json
      setFlow(slideIdx, stored)
    }, 250)
    return () => clearTimeout(t)
  }, [stored, setFlow, slideIdx])

  const applyFlow = useCallback((f: FlowData, keepSelection = false) => {
    const r = toRf(f, theme, null)
    const sel = keepSelection ? new Set(selNodes.map((n) => n.id)) : null
    setNodes(r.nodes.map((n) => (sel?.has(n.id) ? { ...n, selected: true } : n)))
    setEdges(r.edges)
  }, [theme, selNodes])

  const undo = () => {
    const h = history.current
    if (!h.past.length) return
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1); h.future = [lastJson.current, ...h.future]
    lastJson.current = prev; applyFlow(JSON.parse(prev) as FlowData); setFlow(slideIdx, JSON.parse(prev)); announce('Undone')
  }
  const redo = () => {
    const h = history.current
    if (!h.future.length) return
    const nx = h.future[0]
    h.future = h.future.slice(1); h.past = [...h.past, lastJson.current]
    lastJson.current = nx; applyFlow(JSON.parse(nx) as FlowData); setFlow(slideIdx, JSON.parse(nx)); announce('Redone')
  }

  // changes made from outside (an AI agent over MCP): reload the graph
  useEffect(() => {
    if (!slide.flow) return
    const json = JSON.stringify(slide.flow)
    if (json !== lastJson.current && json !== JSON.stringify(stored)) { lastJson.current = json; applyFlow(slide.flow) }
  }, [slide.flow]) // eslint-disable-line react-hooks/exhaustive-deps

  // theme switch: recolour arrowheads
  useEffect(() => { setEdges((es) => es.map((e) => ({ ...e, markerEnd: marker(theme, ((e.data as { accent?: Accent })?.accent) ?? 'ink') }))) }, [theme])

  // ---------- RF event handlers ----------
  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((ns) => applyNodeChanges(c, ns)), [])
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((es) => applyEdgeChanges(c, es)), [])
  const onConnect: OnConnect = useCallback((c) => {
    setEdges((es) => [...es, { id: `e-${rid()}`, source: c.source, target: c.target, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle, type: 'flow', markerEnd: marker(theme, 'ink'), data: { accent: 'ink', reveal: 0 } }])
    announce('Connected')
  }, [theme])

  // ---------- editing actions ----------
  const patchNode = (id: string, patch: { type?: FlowShape; data?: Record<string, unknown>; width?: number; height?: number }) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...(patch.type ? { type: patch.type } : {}), ...(patch.width ? { width: patch.width } : {}), ...(patch.height ? { height: patch.height } : {}), data: { ...n.data, ...(patch.data ?? {}) } } : n)))
  const patchEdge = (id: string, patch: { label?: string; data?: Record<string, unknown> }) =>
    setEdges((es) => es.map((e) => {
      if (e.id !== id) return e
      const data = { ...e.data, ...(patch.data ?? {}) } as { accent?: Accent }
      return { ...e, ...('label' in patch ? { label: patch.label || undefined } : {}), data, markerEnd: marker(theme, data.accent ?? 'ink') }
    }))

  const addNode = (shape: FlowShape, at?: { x: number; y: number }, preset?: ComponentPreset) => {
    const meta = preset ? { ...SHAPE_META[shape], label: preset.label, text: preset.label, accent: preset.accent } : SHAPE_META[shape]
    const size = defaultSize(shape, meta.text)
    const el = document.getElementById('flow-canvas')?.getBoundingClientRect()
    const centre = at ?? rf.screenToFlowPosition({ x: (el?.left ?? 400) + (el?.width ?? 800) / 2, y: (el?.top ?? 300) + (el?.height ?? 600) / 2 })
    const id = 'n' + rid()
    // start at the centre (or the right-click point) and slide aside until the spot is free
    let px = Math.round((centre.x - size.width / 2) / 10) * 10, py = Math.round((centre.y - size.height / 2) / 10) * 10
    // also keep clear of arrows (approximated by the straight line between the two nodes' centres)
    const lines = edges.flatMap((e) => { const a = nodes.find((n) => n.id === e.source), b = nodes.find((n) => n.id === e.target); return a && b ? [[a.position.x + (a.width ?? 180) / 2, a.position.y + (a.height ?? 80) / 2, b.position.x + (b.width ?? 180) / 2, b.position.y + (b.height ?? 80) / 2]] : [] })
    const onLine = (x: number, y: number) => lines.some(([x1, y1, x2, y2]) => { for (let t = 0; t <= 1; t += 0.02) { const lx = x1 + (x2 - x1) * t, ly = y1 + (y2 - y1) * t; if (lx > x - 10 && lx < x + size.width + 10 && ly > y - 10 && ly < y + size.height + 10) return true } return false })
    const hits = (x: number, y: number) => onLine(x, y) || nodes.some((o) => x < o.position.x + (o.width ?? 180) + 20 && x + size.width + 20 > o.position.x && y < o.position.y + (o.height ?? 80) + 20 && y + size.height + 20 > o.position.y)
    for (let i = 0; i < 40 && hits(px, py); i++) { if (i % 8 === 7) { px -= 7 * 40; py += 120 } else px += 40 }
    const n: Node = {
      id, type: shape, position: { x: px, y: py },
      width: size.width, height: size.height, selected: true, data: { label: meta.text, ...(preset?.icon ? { icon: preset.icon } : {}), accent: meta.accent, reveal: steps + 1, shown: true },
    }
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), n])
    setEdges((es) => es.map((e) => ({ ...e, selected: false })))
    announce(`Added ${meta.label.toLowerCase()}`)
  }

  const deleteSelection = () => {
    const ids = new Set(selNodes.map((n) => n.id)), eids = new Set(selEdges.map((e) => e.id))
    if (!ids.size && !eids.size) return
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)))
    setEdges((es) => es.filter((e) => !eids.has(e.id) && !ids.has(e.source) && !ids.has(e.target)))
    announce(`Deleted ${ids.size + eids.size} item${ids.size + eids.size > 1 ? 's' : ''}`)
  }

  const copySel = () => { if (selNodes.length) { flowClip = fromRf(nodes, edges); flowClip = { nodes: flowClip.nodes.filter((n) => selNodes.some((s) => s.id === n.id)), edges: flowClip.edges }; pasteCount = 0; announce(`Copied ${selNodes.length}`) } }
  const pasteClip = (at?: { x: number; y: number }) => {
    if (!flowClip?.nodes.length) return
    pasteCount++
    const copy = cloneFlowSelection(flowClip, flowClip.nodes.map((n) => n.id), at ? 0 : 40 * pasteCount, rid, at)
    const r = toRf(copy, theme, null)
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), ...r.nodes.map((n) => ({ ...n, selected: true }))])
    setEdges((es) => [...es.map((e) => ({ ...e, selected: false })), ...r.edges])
    announce(`Pasted ${copy.nodes.length}`)
  }
  const duplicateSel = () => {
    if (!selNodes.length) return
    const cur = fromRf(nodes, edges)
    const copy = cloneFlowSelection(cur, selNodes.map((n) => n.id), 40, rid)
    const r = toRf(copy, theme, null)
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), ...r.nodes.map((n) => ({ ...n, selected: true }))])
    setEdges((es) => [...es, ...r.edges])
    announce(`Duplicated ${copy.nodes.length}`)
  }

  const setReveal = (n: number) => {
    const nids = new Set(selNodes.map((x) => x.id)), eids = new Set(selEdges.map((x) => x.id))
    setNodes((ns) => ns.map((x) => (nids.has(x.id) ? { ...x, data: { ...x.data, reveal: n } } : x)))
    setEdges((es) => es.map((x) => (eids.has(x.id) ? { ...x, data: { ...x.data, reveal: n } } : x)))
  }

  const layout = (d: FlowDirection) => {
    setDir(d)
    const out = layoutFlow(fromRf(nodes, edges), d)
    applyFlow(out, true)
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 60)
    announce('Auto layout applied')
  }
  const applyReveal = (mode: 'level' | 'node' | 'none') => { applyFlow(autoReveal(fromRf(nodes, edges), mode, dir), true); announce('Reveal order updated') }

  const insertMermaid = (f: FlowData, d: FlowDirection) => {
    setDir(d)
    const cur = fromRf(nodes, edges)
    let add = f
    if (cur.nodes.length) {
      const bottom = Math.max(...cur.nodes.map((n) => n.position.y + (n.style?.height ?? 80)))
      const ids = new Set(cur.nodes.map((n) => n.id))
      const remap = new Map(add.nodes.map((n) => [n.id, ids.has(n.id) ? `${n.id}-${rid()}` : n.id]))
      add = {
        nodes: add.nodes.map((n) => ({ ...n, id: remap.get(n.id)!, position: { x: n.position.x, y: n.position.y + bottom + 100 }, data: { ...n.data, reveal: steps + 1 } })),
        edges: add.edges.map((e) => ({ ...e, id: `${e.id}-${rid()}`, source: remap.get(e.source)!, target: remap.get(e.target)! })),
      }
    } else add = autoReveal(add, 'level', d)
    const r = toRf(add, theme, null)
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), ...r.nodes])
    setEdges((es) => [...es, ...r.edges])
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 80)
    announce(`Imported ${add.nodes.length} nodes`)
  }

  // ---------- click-order mode ----------
  const selKey = selNodes.map((n) => n.id).join()
  const lastSel = useRef('')
  useEffect(() => {
    if (orderMode && selKey && selKey !== lastSel.current) {
      const n = nextOrder
      const ids = new Set(selNodes.map((x) => x.id))
      setNextOrder(n + 1)
      setNodes((ns) => ns.map((x) => (ids.has(x.id) ? { ...x, selected: false, data: { ...x.data, reveal: n } } : x)))
      lastSel.current = ''
      return
    }
    lastSel.current = selKey
  }, [selKey, orderMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- keyboard ----------
  const K = useRef({ undo, redo, copySel, pasteClip, duplicateSel, deleteSelection, setReveal, nodes, steps, orderMode })
  K.current = { undo, redo, copySel, pasteClip, duplicateSel, deleteSelection, setReveal, nodes, steps, orderMode }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.target as HTMLElement).closest?.('[aria-label="Slides"]')) return
      const k = e.key.toLowerCase()
      const A = K.current
      if (hasMod(e) && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo() }
      else if (hasMod(e) && k === 'y') { e.preventDefault(); A.redo() }
      else if (hasMod(e) && k === 'a') { e.preventDefault(); setNodes((ns) => ns.map((n) => ({ ...n, selected: true }))); announce('Selected all') }
      else if (hasMod(e) && k === 'd') { e.preventDefault(); A.duplicateSel() }
      else if (hasMod(e) && k === 'c') A.copySel()
      else if (hasMod(e) && k === 'x') { A.copySel(); A.deleteSelection() }
      else if (hasMod(e) && k === 'v') { e.preventDefault(); A.pasteClip() }
      else if (e.altKey && /^Digit[0-9]$/.test(e.code)) { e.preventDefault(); const n = Number(e.code.slice(5)); A.setReveal(n); announce(`Appears on click ${n}`) }
      else if (e.altKey && e.code === 'KeyO') { e.preventDefault(); setOrderMode((o) => { if (!o) setNextOrder(A.steps + 1); return !o }) }
      else if (e.altKey && e.code === 'KeyP') { e.preventDefault(); setOrderMode(false); setPreviewStep(0); setMode((m) => (m === 'edit' ? 'preview' : 'edit')) }
      else if (e.key === 'Escape') { setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))); setEdges((es) => es.map((x) => ({ ...x, selected: false }))) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (mode !== 'preview') return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setPreviewStep((s) => Math.min(steps, s + 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPreviewStep((s) => Math.max(0, s - 1)) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [mode, steps])

  // ---------- right-click ----------
  const onContextCapture = (e: React.MouseEvent) => {
    const nodeEl = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null
    const edgeEl = (e.target as HTMLElement).closest('.react-flow__edge') as HTMLElement | null
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (nodeEl) {
      const id = nodeEl.dataset.id!
      setCtx({ kind: 'node', id, ...pos })
      if (!nodes.find((n) => n.id === id)?.selected) setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })))
    } else if (edgeEl) {
      const id = edgeEl.dataset.id!
      setCtx({ kind: 'edge', id, ...pos })
      setEdges((es) => es.map((x) => ({ ...x, selected: x.id === id })))
    } else { setCtx({ kind: 'pane', ...pos }); setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))) }
  }

  const flowCtx = useMemo(() => ({ theme, editable: true, badges: true }), [theme])
  const chips = Array.from({ length: steps + 2 }, (_, i) => i)
  const sel1 = selNodes.length === 1 && !selEdges.length ? selNodes[0] : null
  const edge1 = selEdges.length === 1 && !selNodes.length ? selEdges[0] : null
  const reveals = new Set([...selNodes, ...selEdges].map((x) => (x.data as { reveal?: number }).reveal ?? 0))
  const activeStep = reveals.size === 1 ? [...reveals][0] : null
  const anySel = selNodes.length + selEdges.length > 0

  const menu = ctx.kind === 'node' ? (
    <>
      <ContextMenuItem onClick={duplicateSel}>Duplicate<ContextMenuShortcut>{MOD}+D</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={copySel}>Copy<ContextMenuShortcut>{MOD}+C</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!flowClip} onClick={() => pasteClip({ x: ctx.x, y: ctx.y })}>Paste here<ContextMenuShortcut>{MOD}+V</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Appears on click</ContextMenuSubTrigger>
        <ContextMenuSubContent>{Array.from({ length: Math.max(steps + 2, 6) }, (_, k) => <ContextMenuItem key={k} onClick={() => setReveal(k)}>{k === 0 ? 'Always (from the start)' : `Click ${k}`}</ContextMenuItem>)}</ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Change shape</ContextMenuSubTrigger>
        <ContextMenuSubContent>{FLOW_SHAPES.map((s) => <ContextMenuItem key={s} onClick={() => selNodes.forEach((n) => patchNode(n.id, { type: s }))}>{SHAPE_META[s].icon}{SHAPE_META[s].label}</ContextMenuItem>)}</ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={deleteSelection}>Delete<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
    </>
  ) : ctx.kind === 'edge' ? (
    <>
      <ContextMenuItem onClick={() => edge1 && patchEdge(edge1.id, { data: { dashed: !(edge1.data as { dashed?: boolean }).dashed } })}>Toggle dashed</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={deleteSelection}>Delete<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
    </>
  ) : (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Add here</ContextMenuSubTrigger>
        <ContextMenuSubContent>{FLOW_SHAPES.map((s) => <ContextMenuItem key={s} onClick={() => addNode(s, { x: ctx.x, y: ctx.y })}>{SHAPE_META[s].icon}{SHAPE_META[s].label}</ContextMenuItem>)}</ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem disabled={!flowClip} onClick={() => pasteClip({ x: ctx.x, y: ctx.y })}>Paste here<ContextMenuShortcut>{MOD}+V</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={() => setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))}>Select all<ContextMenuShortcut>{MOD}+A</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Auto layout</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => layout('LR')}>Left to right</ContextMenuItem>
          <ContextMenuItem onClick={() => layout('TB')}>Top to bottom</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onClick={() => rf.fitView({ padding: 0.15, duration: 300 })}>Fit to screen</ContextMenuItem>
    </>
  )

  return (
    <div id="editor-canvas" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px]">
        <div id="flow-canvas" className="relative min-h-0 min-w-0">
          {mode === 'edit' ? (
            <FlowContext.Provider value={flowCtx}>
              <ContextMenu>
                <ContextMenuTrigger className="block h-full w-full" onContextMenuCapture={onContextCapture}>
                  <div className="flow-theme h-full w-full" data-theme={theme} data-bg={bgAttr}>
                    <ReactFlow
                      nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                      connectionMode={ConnectionMode.Loose} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.1} maxZoom={2}
                      selectionOnDrag selectionMode={SelectionMode.Partial} panOnDrag={[1, 2]} multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
                      deleteKeyCode={['Backspace', 'Delete']} snapToGrid snapGrid={[10, 10]} elevateEdgesOnSelect
                      proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ type: 'flow' }}
                    >
                      <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color={isDarkTheme(theme) ? '#ffffff22' : '#00000018'} />
                      <Controls showInteractive={false} position="bottom-left" />
                      <Panel position="top-left" className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 p-1.5 text-foreground shadow-sm" aria-label="Add to diagram">
                        {FLOW_SHAPES.map((s) => <Button key={s} size="sm" variant="outline" title={`Add ${SHAPE_META[s].label.toLowerCase()}`} onClick={() => addNode(s)}>{SHAPE_META[s].icon}{SHAPE_META[s].label}</Button>)}
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button size="sm" variant="outline" title="Ready-made system-design components" />}><Boxes />Components</DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-96 w-56 overflow-auto">
                            {COMPONENT_GROUPS.map((g) => (
                              <DropdownMenuGroup key={g}>
                                <DropdownMenuLabel>{g}</DropdownMenuLabel>
                                {COMPONENTS.filter((c) => c.group === g).map((c) => <DropdownMenuItem key={c.id} onClick={() => addNode(c.shape, undefined, c)}>{c.label}</DropdownMenuItem>)}
                              </DropdownMenuGroup>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="mx-1 h-5 w-px bg-border" />
                        <Button size="sm" variant="outline" title="Auto layout left to right" onClick={() => layout('LR')}><ArrowRightLeft />Layout</Button>
                        <Button size="icon-sm" variant="outline" title="Auto layout top to bottom" aria-label="Auto layout top to bottom" onClick={() => layout('TB')}><ArrowDownUp /></Button>
                        <Button size="sm" variant="outline" onClick={() => setMermaidOpen(true)}><GitBranch />Mermaid</Button>
                        <Button size="icon-sm" variant="outline" title="Fit to screen" aria-label="Fit to screen" onClick={() => rf.fitView({ padding: 0.15, duration: 300 })}><Maximize /></Button>
                      </Panel>
                    </ReactFlow>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">{menu}</ContextMenuContent>
              </ContextMenu>
            </FlowContext.Provider>
          ) : (
            <PreviewBox flow={stored} title={slide.title} theme={theme} step={previewStep} />
          )}
        </div>

        {/* properties */}
        <aside className="overflow-auto border-l bg-background p-3.5" aria-label="Diagram properties">
          {sel1 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Node</h4>
              <Field label="Label"><Textarea className="min-h-16" value={(sel1.data as { label: string }).label} onChange={(e) => patchNode(sel1.id, { data: { label: e.target.value } })} /></Field>
              <Field label="Shape"><Pick value={sel1.type as string} options={FLOW_SHAPES.map((s) => ({ value: s, label: SHAPE_META[s].label }))} onChange={(v) => patchNode(sel1.id, { type: v as FlowShape })} /></Field>
              <Field label="Icon"><IconPicker value={(sel1.data as { icon?: string }).icon} onChange={(n) => patchNode(sel1.id, { data: { icon: n } })} /></Field>
              <Field label="Colour"><Swatches value={(sel1.data as { accent: Accent }).accent} onChange={(a) => patchNode(sel1.id, { data: { accent: a } })} /></Field>
              <Field label="Muted"><Switch checked={!!(sel1.data as { muted?: boolean }).muted} onCheckedChange={(c) => patchNode(sel1.id, { data: { muted: c } })} /></Field>
              <Field label="Appears"><Num value={(sel1.data as { reveal: number }).reveal} min={0} onChange={(n) => patchNode(sel1.id, { data: { reveal: Math.max(0, n) } })} /></Field>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="text-[11px] text-muted-foreground">width<Num value={Math.round(sel1.width ?? 0)} min={60} onChange={(n) => patchNode(sel1.id, { width: n })} /></label>
                <label className="text-[11px] text-muted-foreground">height<Num value={Math.round(sel1.height ?? 0)} min={40} onChange={(n) => patchNode(sel1.id, { height: n })} /></label>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={duplicateSel}><Copy /> Duplicate</Button>
                <Button size="sm" variant="destructive" onClick={deleteSelection}><Trash2 /> Delete</Button>
              </div>
            </div>
          ) : edge1 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Connection</h4>
              <Field label="Label"><Input className="h-8" placeholder="e.g. yes" value={typeof edge1.label === 'string' ? edge1.label : ''} onChange={(e) => patchEdge(edge1.id, { label: e.target.value })} /></Field>
              <Field label="Colour"><Swatches value={(edge1.data as { accent: Accent }).accent} onChange={(a) => patchEdge(edge1.id, { data: { accent: a } })} /></Field>
              <Field label="Dashed"><Switch checked={!!(edge1.data as { dashed?: boolean }).dashed} onCheckedChange={(c) => patchEdge(edge1.id, { data: { dashed: c } })} /></Field>
              <p className="mb-3 text-xs text-muted-foreground">A connection appears once both of its nodes are visible.</p>
              <Button size="sm" variant="destructive" onClick={deleteSelection}><Trash2 /> Delete</Button>
            </div>
          ) : selNodes.length > 1 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">{selNodes.length} nodes selected</h4>
              <Field label="Appears"><Num value={activeStep ?? 0} min={0} onChange={(n) => setReveal(Math.max(0, n))} /></Field>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={duplicateSel}><Copy /> Duplicate</Button>
                <Button size="sm" variant="destructive" onClick={deleteSelection}><Trash2 /> Delete</Button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Diagram</h4>
              <Field label="Title"><Input className="h-8" value={slide.title ?? ''} onChange={(e) => commit((d) => { d.slides[slideIdx].title = e.target.value })} /></Field>
              <div className="mb-1 mt-4 text-xs font-medium text-muted-foreground">Auto layout</div>
              <div className="mb-3 flex gap-1.5"><Button size="sm" variant="outline" onClick={() => layout('LR')}><ArrowRightLeft /> Left→right</Button><Button size="sm" variant="outline" onClick={() => layout('TB')}><ArrowDownUp /> Top→down</Button></div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Reveal order</div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => applyReveal('level')}><Wand2 /> By column</Button>
                <Button size="sm" variant="outline" onClick={() => applyReveal('node')}>One by one</Button>
                <Button size="sm" variant="outline" onClick={() => applyReveal('none')}>All at once</Button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Drag from a node's dot to another node to connect them. Drag on empty space to select several; hold the middle or right mouse button to pan. Double-click a node to edit its text. Press <kbd className="rounded border px-1">?</kbd> for shortcuts.</p>
            </div>
          )}
        </aside>
      </div>

      {/* reveal bar */}
      <div className="flex flex-wrap items-center gap-2 border-t bg-background px-3 py-2">
        <div className="flex rounded-md border p-0.5">
          <Button size="sm" variant={mode === 'edit' ? 'default' : 'ghost'} onClick={() => { setMode('edit'); setOrderMode(false) }}><Pencil /> Edit</Button>
          <Button size="sm" variant={mode === 'preview' ? 'default' : 'ghost'} onClick={() => { setMode('preview'); setOrderMode(false); setPreviewStep(0) }}><Eye /> Preview</Button>
        </div>
        {mode === 'edit' ? (
          <>
            <span className="ml-2 text-xs text-muted-foreground">
              {orderMode ? <>Click nodes in the order they should appear · <b>next is {nextOrder}</b></> : anySel ? <>Show {selNodes.length + selEdges.length} selected on click:</> : <>Select nodes, then pick the click they appear on:</>}
            </span>
            {!orderMode && chips.map((n) => (
              <Button key={n} size="sm" disabled={!anySel} variant={activeStep === n ? 'default' : 'outline'}
                style={n > 0 && activeStep !== n ? { borderColor: badgeColor(n), color: badgeColor(n) } : undefined} onClick={() => setReveal(n)}>{n === 0 ? 'Always' : n}</Button>
            ))}
            {!orderMode && <Button size="sm" variant="secondary" disabled={!anySel} title="Move the selected items to a brand-new next step" onClick={() => setReveal(steps + 1)}><Plus /> Add step</Button>}
            <div className="ml-auto">
              {orderMode ? <Button size="sm" variant="secondary" onClick={() => setOrderMode(false)}>Done ordering</Button>
                : <Button size="sm" variant="outline" onClick={() => { setNextOrder(steps + 1); setOrderMode(true); setNodes((ns) => ns.map((n) => ({ ...n, selected: false }))) }}><MousePointerClick /> Click-order</Button>}
            </div>
          </>
        ) : (
          <>
            <span className="ml-2 text-xs text-muted-foreground">Click:</span>
            {Array.from({ length: steps + 1 }, (_, n) => <Button key={n} size="sm" variant={previewStep === n ? 'default' : 'outline'} onClick={() => setPreviewStep(n)}>{n}</Button>)}
            <span className="text-xs text-muted-foreground">← → to step</span>
          </>
        )}
      </div>
      <FlowMermaidDialog open={mermaidOpen} onClose={() => setMermaidOpen(false)} onInsert={insertMermaid} />
    </div>
  )
}

function Swatches({ value, onChange }: { value: Accent; onChange: (a: Accent) => void }) {
  const colors: Record<Accent, string> = { amber: '#d9930d', blue: '#4a6cf7', green: '#1f7a52', red: '#ef5b3f', ink: '#2a2622', muted: '#b8b0a3' }
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
      {ACCENTS.map((a) => <button key={a} role="radio" aria-checked={value === a} title={a} onClick={() => onChange(a)} style={{ background: colors[a] }} className={`size-6 rounded-full border-2 ${value === a ? 'border-primary ring-2 ring-ring/40' : 'border-transparent'}`} />)}
    </div>
  )
}

function PreviewBox({ flow, title, theme, step }: { flow: FlowData; title?: string; theme: ThemeId; step: number }) {
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
        <FlowSlideView flow={flow} title={title} theme={theme} step={step} style={{ transform: `scale(${scale})` }} />
      </div>
    </div>
  )
}
