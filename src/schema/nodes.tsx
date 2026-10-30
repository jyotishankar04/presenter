import { BaseEdge, EdgeLabelRenderer, Handle, Position, getBezierPath, getSmoothStepPath, getStraightPath, useConnection, useStore, type EdgeProps, type NodeProps } from '@xyflow/react'
import { KeyRound, Link2, Plus } from 'lucide-react'
import { useMemo } from 'react'
import rough from 'roughjs'
import { ACCENT_HEX, badgeColor } from '../flow/theme'
import { seedOf } from '../render/rough'
import { useSchemaCtx } from './context'
import { HEADER_H, ROW_H, TABLE_W, type RelKind, type Table } from './types'

const gen = rough.generator()

function SketchBorder({ id, color }: { id: string; color: string }) {
  const w = useStore((s) => s.nodeLookup.get(id)?.measured?.width ?? 0)
  const h = useStore((s) => s.nodeLookup.get(id)?.measured?.height ?? 0)
  const paths = useMemo(() => (w && h ? gen.toPaths(gen.rectangle(2, 2, w - 4, h - 4, { seed: seedOf(id), roughness: 1.2, strokeWidth: 3, stroke: color })) : []), [id, w, h, color])
  if (!w) return null
  return <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>{paths.map((p, i) => <path key={i} d={p.d} stroke={color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" />)}</svg>
}

function TableNodeView({ id, data, selected }: NodeProps) {
  const { theme, editable, badges, fkCols, selectedColumn, onSelectColumn, onAddColumn } = useSchemaCtx()
  const t = (data as { table: Table; shown?: boolean }).table
  const shown = (data as { shown?: boolean }).shown !== false
  const color = ACCENT_HEX[theme][t.color ?? 'blue']
  const connecting = useConnection((c) => c.inProgress)
  return (
    <div className="er-table" data-theme-kind={theme} data-selected={selected || undefined} data-connecting={connecting || undefined}
      style={{ width: TABLE_W, opacity: shown ? 1 : 0, transition: 'opacity .45s ease', ['--er-accent' as string]: color }}>
      {theme === 'sketch' && <SketchBorder id={id} color={color} />}
      <div className="er-header" style={{ height: HEADER_H }}>
        <span className="er-title" title={t.comment}>{t.name}</span>
        <span className="er-count">{t.columns.length}</span>
      </div>
      {t.columns.map((c) => {
        const fk = fkCols.has(`${t.id}:${c.id}`)
        const sel = selectedColumn?.table === t.id && selectedColumn.column === c.id
        return (
          <div key={c.id} className="er-row" data-selected={sel || undefined} style={{ height: ROW_H }}
            onClick={editable ? () => onSelectColumn?.(t.id, c.id) : undefined}>
            <Handle id={`${c.id}-l`} type="source" position={Position.Left} className="er-handle" isConnectable={editable} />
            <span className="er-key">{c.pk ? <KeyRound size={14} style={{ color: '#e0a43a' }} /> : fk ? <Link2 size={14} style={{ color: '#5b7bff' }} /> : null}</span>
            <span className="er-name" data-pk={c.pk || undefined}>{c.name}</span>
            <span className="er-flags">{c.unique && !c.pk ? 'UQ ' : ''}{!c.notNull && !c.pk ? 'null' : ''}</span>
            <span className="er-type" title={c.comment}>{c.type}</span>
            <Handle id={`${c.id}-r`} type="source" position={Position.Right} className="er-handle" isConnectable={editable} />
          </div>
        )
      })}
      {editable && (
        <button className="er-add nodrag" onClick={() => onAddColumn?.(t.id)} aria-label={`Add a column to ${t.name}`}><Plus size={14} /> column</button>
      )}
      {editable && badges && (t.reveal ?? 0) > 0 && <span className="flow-badge" style={{ background: badgeColor(t.reveal!) }}>{t.reveal}</span>}
    </div>
  )
}

export const schemaNodeTypes = { table: TableNodeView }

/** Crow's-foot / bar glyph at an edge end. `pos` is the side of the table the edge leaves from. */
function Glyph({ x, y, pos, kind, color }: { x: number; y: number; pos: Position; kind: 'one' | 'many'; color: string }) {
  const d = pos === Position.Right ? [1, 0] : pos === Position.Left ? [-1, 0] : pos === Position.Bottom ? [0, 1] : [0, -1]
  const n = [-d[1], d[0]]
  const P = (a: number, b: number) => `${x + d[0] * a + n[0] * b},${y + d[1] * a + n[1] * b}`
  const line = (a1: number, b1: number, a2: number, b2: number, key: string) => <polyline key={key} points={`${P(a1, b1)} ${P(a2, b2)}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
  return kind === 'one'
    ? <g>{line(10, -8, 10, 8, 'a')}{line(17, -8, 17, 8, 'b')}</g>
    : <g>{line(18, 0, 0, -9, 'a')}{line(18, 0, 0, 9, 'b')}{line(18, 0, 0, 0, 'c')}{line(22, -8, 22, 8, 'd')}</g>
}

export interface RelEdgeData { style?: 'step' | 'curve' | 'straight'; kind: RelKind; accent: string; shown?: boolean; name?: string }

function RelEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) {
  const { theme } = useSchemaCtx()
  const d = (data ?? {}) as unknown as RelEdgeData
  const color = selected ? '#4a6cf7' : ACCENT_HEX[theme].ink
  const shown = d.shown !== false
  const g = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }
  const [path, lx, ly] = d.style === 'curve' ? getBezierPath(g) : d.style === 'straight' ? getStraightPath(g) : getSmoothStepPath({ ...g, borderRadius: 14, offset: 34 })
  const srcMany = d.kind === 'N:1', dstMany = d.kind === '1:N'
  return (
    <g style={{ opacity: shown ? 1 : 0, transition: 'opacity .45s ease' }}>
      <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: selected ? 3 : 2 }} interactionWidth={20} />
      <Glyph x={sourceX} y={sourceY} pos={sourcePosition} kind={srcMany ? 'many' : 'one'} color={color} />
      <Glyph x={targetX} y={targetY} pos={targetPosition} kind={dstMany ? 'many' : 'one'} color={color} />
      {d.name && <EdgeLabelRenderer><div className="flow-edge-label" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, fontSize: 13 }}>{d.name}</div></EdgeLabelRenderer>}
    </g>
  )
}

export const schemaEdgeTypes = { rel: RelEdgeView }
