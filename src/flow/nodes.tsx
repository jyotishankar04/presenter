import { useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, Handle, NodeResizer, Position, getSmoothStepPath, useConnection, useReactFlow, useStore, type EdgeProps, type NodeProps } from '@xyflow/react'
import rough from 'roughjs'
import { Icon } from '../render/ElementView'
import { seedOf } from '../render/rough'
import type { Accent } from '../model/types'
import { isDarkTheme } from '../model/themes'
import { ACCENT_HEX, ACCENT_TEXT, badgeColor, useFlowCtx } from './theme'
import type { FlowShape } from './types'

const gen = rough.generator()

/** SVG path strings that outline a shape inside a w×h box. */
export function shapePaths(shape: FlowShape, w: number, h: number): string[] {
  const m = 2
  switch (shape) {
    case 'decision': return [`M${w / 2},${m} L${w - m},${h / 2} L${w / 2},${h - m} L${m},${h / 2} Z`]
    case 'pill': { const r = (h - m * 2) / 2; return [`M${m + r},${m} H${w - m - r} A${r},${r} 0 0 1 ${w - m - r},${h - m} H${m + r} A${r},${r} 0 0 1 ${m + r},${m} Z`] }
    case 'database': { const ry = Math.min(14, h / 5); return [`M${m},${ry + m} A${w / 2 - m},${ry} 0 0 1 ${w - m},${ry + m} V${h - ry - m} A${w / 2 - m},${ry} 0 0 1 ${m},${h - ry - m} Z`, `M${m},${ry + m} A${w / 2 - m},${ry} 0 0 0 ${w - m},${ry + m}`] }
    default: { const r = shape === 'note' ? 6 : 14; return [`M${m + r},${m} H${w - m - r} Q${w - m},${m} ${w - m},${m + r} V${h - m - r} Q${w - m},${h - m} ${w - m - r},${h - m} H${m + r} Q${m},${h - m} ${m},${h - m - r} V${m + r} Q${m},${m} ${m + r},${m} Z`] }
  }
}

function ShapeSvg({ id, shape, w, h, color, muted, fill }: { id: string; shape: FlowShape; w: number; h: number; color: string; muted?: boolean; fill: string }) {
  const { theme } = useFlowCtx()
  const paths = useMemo(() => shapePaths(shape, w, h), [shape, w, h])
  const sketchy = useMemo(() => (theme === 'sketch'
    ? paths.flatMap((d, i) => gen.toPaths(gen.path(d, { seed: seedOf(id) + i, roughness: 1.3, strokeWidth: 3.5, stroke: color, ...(i === 0 ? {} : {}) })))
    : []), [theme, paths, id, color])
  if (!w || !h) return null
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={paths[0]} style={{ fill: shape === 'note' ? 'transparent' : fill }} stroke={theme === 'sketch' ? 'none' : color} strokeWidth={muted ? 1.5 : 2} strokeDasharray={shape === 'note' ? '6 5' : undefined} />
      {theme !== 'sketch' && paths.slice(1).map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />)}
      {theme === 'sketch' && sketchy.map((p, i) => <path key={i} d={p.d} fill="none" stroke={color} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeDasharray={shape === 'note' ? '2 9' : undefined} />)}
    </svg>
  )
}

const SIDES: [string, Position][] = [['t', Position.Top], ['r', Position.Right], ['b', Position.Bottom], ['l', Position.Left]]

function FlowNodeView({ id, data, selected, type }: NodeProps) {
  const { theme, editable, badges } = useFlowCtx()
  const rf = useReactFlow()
  const [editing, setEditing] = useState(false)
  const connecting = useConnection((c) => c.inProgress)
  const w = useStore((s) => s.nodeLookup.get(id)?.measured?.width ?? s.nodeLookup.get(id)?.width ?? 0)
  const h = useStore((s) => s.nodeLookup.get(id)?.measured?.height ?? s.nodeLookup.get(id)?.height ?? 0)
  const d = data as { label: string; icon?: string; accent: Accent; muted?: boolean; reveal: number; shown?: boolean }
  const shape = type as FlowShape
  const accent = d.muted ? 'muted' : d.accent
  const color = ACCENT_HEX[theme][accent]
  const text = ACCENT_TEXT[theme][accent]
  const fill = isDarkTheme(theme) ? 'var(--card)' : 'var(--bg)'
  const shown = d.shown !== false
  const commit = (v: string) => { setEditing(false); if (v !== d.label) rf.updateNodeData(id, { label: v }) }

  return (
    <div className="flow-node" data-shape={shape} data-connecting={connecting || undefined} style={{ opacity: shown ? 1 : 0, transition: 'opacity .45s ease', width: '100%', height: '100%', color: text }}>
      {editable && <NodeResizer isVisible={selected} minWidth={90} minHeight={50} color="#4a6cf7" handleStyle={{ width: 10, height: 10, borderRadius: 3 }} />}
      <ShapeSvg id={id} shape={shape} w={w} h={h} color={color} muted={d.muted} fill={fill} />
      <div className="flow-label" onDoubleClick={() => editable && setEditing(true)}>
        {d.icon && <Icon name={d.icon} size={isDarkTheme(theme) ? 24 : 30} color={color} />}
        {editing ? (
          <textarea autoFocus defaultValue={d.label} className="nodrag nowheel"
            onFocus={(e) => e.currentTarget.select()} onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') (e.target as HTMLElement).blur(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur() } }}
            style={{ font: 'inherit', color: 'inherit', background: 'transparent', border: '2px solid #4a6cf7', borderRadius: 6, textAlign: 'center', resize: 'none', width: '90%', minHeight: 40, outline: 'none' }} />
        ) : <span style={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>{d.label}</span>}
      </div>
      {SIDES.map(([hid, pos]) => (
        <Handle key={hid} id={hid} type="source" position={pos} isConnectable={editable} className="flow-handle"
          style={{ width: 12, height: 12, background: '#4a6cf7', border: '2px solid #fff', pointerEvents: editable ? 'auto' : 'none' }} />
      ))}
      {editable && badges && d.reveal > 0 && (
        <span className="flow-badge" style={{ background: badgeColor(d.reveal) }}>{d.reveal}</span>
      )}
    </div>
  )
}

export const nodeTypes = { box: FlowNodeView, decision: FlowNodeView, pill: FlowNodeView, database: FlowNodeView, note: FlowNodeView }

function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, selected, markerEnd }: EdgeProps) {
  const { theme, editable } = useFlowCtx()
  const d = (data ?? {}) as { accent?: Accent; dashed?: boolean; shown?: boolean }
  const color = ACCENT_HEX[theme][d.accent ?? 'ink']
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18 })
  const shown = d.shown !== false
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd}
        style={{ stroke: selected ? '#4a6cf7' : color, strokeWidth: selected ? 4 : 3, opacity: shown ? 1 : 0, transition: 'opacity .45s ease', ...(d.dashed ? { strokeDasharray: '9 7' } : {}) }}
        interactionWidth={editable ? 24 : 0} />
      {label && (
        <EdgeLabelRenderer>
          <div className="flow-edge-label" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: shown ? 1 : 0, color: ACCENT_TEXT[theme][d.accent ?? 'ink'] }}>{label as string}</div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const edgeTypes = { flow: FlowEdgeView }
