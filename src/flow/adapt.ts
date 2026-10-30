import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Accent, ThemeId } from '../model/types'
import { edgeReveal, nodeReveal } from './reveal'
import { ACCENT_HEX } from './theme'
import { defaultSize, type FlowData, type FlowEdge, type FlowNode } from './types'

/** Stored deck data -> React Flow nodes/edges. step = null shows everything (editing). */
export function toRf(flow: FlowData, theme: ThemeId, step: number | null): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = flow.nodes.map((n) => {
    const size = n.style ?? defaultSize(n.type, n.data.label, !!n.data.icon)
    return { id: n.id, type: n.type, position: n.position, width: size.width, height: size.height, data: { ...n.data, shown: step === null || nodeReveal(n) <= step } }
  })
  const edges: Edge[] = flow.edges.map((e) => {
    const accent = e.data?.accent ?? 'ink'
    return {
      id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null, label: e.label, type: 'flow',
      markerEnd: { type: MarkerType.ArrowClosed, color: ACCENT_HEX[theme][accent], width: 18, height: 18 },
      data: { accent, dashed: e.data?.dashed, reveal: e.data?.reveal ?? 0, shown: step === null || edgeReveal(e, flow) <= step },
    }
  })
  return { nodes, edges }
}

/** React Flow state -> the plain JSON we store (drops transient fields like `shown`, `selected`, measurements). */
export function fromRf(nodes: Node[], edges: Edge[]): FlowData {
  return {
    nodes: nodes.map((n): FlowNode => {
      const { shown: _shown, ...data } = n.data as Record<string, unknown>
      void _shown
      const size = { width: Math.round(n.width ?? n.measured?.width ?? 180), height: Math.round(n.height ?? n.measured?.height ?? 80) }
      return { id: n.id, type: n.type as FlowNode['type'], position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, style: size, data: data as FlowNode['data'] }
    }),
    edges: edges.map((e): FlowEdge => {
      const d = (e.data ?? {}) as { accent?: Accent; reveal?: number; dashed?: boolean }
      return {
        id: e.id, source: e.source, target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}), ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
        ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}),
        data: { accent: d.accent ?? 'ink', reveal: d.reveal ?? 0, ...(d.dashed ? { dashed: true } : {}) },
      }
    }),
  }
}

/** Cheap signature to remount/refit when the diagram's structure changes. */
export const flowSignature = (f?: FlowData) => (f ? `${f.nodes.map((n) => `${n.id}@${n.position.x},${n.position.y}:${n.style?.width}x${n.style?.height}`).join('|')}#${f.edges.map((e) => e.id).join(',')}` : '')
