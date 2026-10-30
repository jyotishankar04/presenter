import '@xyflow/react/dist/style.css'
import { ConnectionMode, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useMemo, type CSSProperties } from 'react'
import type { ThemeId } from '../model/types'
import { useBackgroundAttr } from '../render/background'
import { fkColumnSet, schemaSignature, schemaToRf } from './adapt'
import { SchemaContext } from './context'
import { schemaEdgeTypes, schemaNodeTypes } from './nodes'
import type { Schema } from './types'

/** Read-only stage-sized view of a schema slide: tables and relationships fade in as their click arrives. */
export function SchemaSlideView({ schema, title, theme, step, style }: { schema?: Schema; title?: string; theme: ThemeId; step: number; style?: CSSProperties }) {
  const s = schema ?? { id: '', name: '', dialect: 'postgres' as const, tables: [], relationships: [] }
  const bgAttr = useBackgroundAttr()
  const { nodes, edges } = useMemo(() => schemaToRf(s, step), [s, step])
  const ctx = useMemo(() => ({ theme, editable: false, badges: false, fkCols: fkColumnSet(s), selectedColumn: null }), [theme, s])
  return (
    <div className="stage flow-theme" data-theme={theme} data-bg={bgAttr} style={style}>
      {title && <h1 className="flow-title">{title}</h1>}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: title ? 140 : 30 }}>
        <SchemaContext.Provider value={ctx}>
          <ReactFlowProvider>
            <ReactFlow key={schemaSignature(s) + theme} nodes={nodes} edges={edges} nodeTypes={schemaNodeTypes} edgeTypes={schemaEdgeTypes} connectionMode={ConnectionMode.Loose}
              fitView fitViewOptions={{ padding: 0.08, minZoom: 0.1, maxZoom: 1.3 }} minZoom={0.1}
              nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
              panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} proOptions={{ hideAttribution: true }} />
          </ReactFlowProvider>
        </SchemaContext.Provider>
      </div>
    </div>
  )
}
