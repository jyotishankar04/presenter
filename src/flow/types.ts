import type { Accent } from '../model/types'

export type FlowShape = 'box' | 'decision' | 'pill' | 'database' | 'note'
export type FlowDirection = 'LR' | 'TB'
export const FLOW_SHAPES: FlowShape[] = ['box', 'decision', 'pill', 'database', 'note']

export interface FlowNodeData {
  label: string
  icon?: string
  accent: Accent
  muted?: boolean
  /** Click on which this node appears (0 = from the start). */
  reveal: number
  [k: string]: unknown
}

/** Plain-JSON React Flow node: what we store in the deck. `type` is the shape. */
export interface FlowNode {
  id: string
  type: FlowShape
  position: { x: number; y: number }
  style?: { width: number; height: number }
  data: FlowNodeData
}

export interface FlowEdgeData {
  accent: Accent
  /** Edges also wait for both of their nodes, so this is usually 0. */
  reveal: number
  dashed?: boolean
  [k: string]: unknown
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  /** Handle ids are 't' | 'r' | 'b' | 'l' on every node. */
  sourceHandle?: string
  targetHandle?: string
  label?: string
  data?: FlowEdgeData
}

export interface FlowData { nodes: FlowNode[]; edges: FlowEdge[] }

export const emptyFlow = (): FlowData => ({ nodes: [], edges: [] })

/** Default node size for a shape and label (the editor lets you resize afterwards). */
export function defaultSize(shape: FlowShape, label: string, hasIcon = false): { width: number; height: number } {
  const text = label.split('\n').reduce((m, l) => Math.max(m, l.length), 0)
  switch (shape) {
    case 'decision': return { width: Math.min(300, Math.max(200, text * 11 + 90)), height: 130 }
    case 'pill': return { width: Math.min(320, Math.max(180, text * 14 + 70)), height: 70 }
    case 'database': return { width: Math.min(300, Math.max(190, text * 14 + 60)), height: 110 }
    case 'note': return { width: Math.min(420, Math.max(200, text * 13 + 40)), height: 70 }
    default: return { width: Math.min(340, Math.max(180, text * 14 + (hasIcon ? 80 : 50))), height: 80 }
  }
}
