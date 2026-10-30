import '@xyflow/react/dist/style.css'
import { ConnectionMode, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useMemo, type CSSProperties } from 'react'
import type { ThemeId } from '../model/types'
import { useBackgroundAttr } from '../render/background'
import { flowSignature, toRf } from './adapt'
import { edgeTypes, nodeTypes } from './nodes'
import { FlowContext } from './theme'
import type { FlowData } from './types'

const CTX = (theme: ThemeId) => ({ theme, editable: false, badges: false })

/** Read-only stage-sized view of a flow slide at a given click: nodes and edges fade in as their step arrives. */
export function FlowSlideView({ flow, title, theme, step, style }: { flow?: FlowData; title?: string; theme: ThemeId; step: number; style?: CSSProperties }) {
  const data = flow ?? { nodes: [], edges: [] }
  const { nodes, edges } = useMemo(() => toRf(data, theme, step), [data, theme, step])
  const ctx = useMemo(() => CTX(theme), [theme])
  const top = title ? 150 : 40
  const bgAttr = useBackgroundAttr()
  return (
    <div className="stage flow-theme" data-theme={theme} data-bg={bgAttr} style={style}>
      {title && <h1 className="flow-title">{title}</h1>}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top }}>
        <FlowContext.Provider value={ctx}>
          <ReactFlowProvider>
            <ReactFlow key={flowSignature(data) + theme} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose}
              fitView fitViewOptions={{ padding: 0.1, minZoom: 0.1, maxZoom: 1.25 }} minZoom={0.1}
              nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
              panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
              proOptions={{ hideAttribution: true }} />
          </ReactFlowProvider>
        </FlowContext.Provider>
      </div>
    </div>
  )
}
