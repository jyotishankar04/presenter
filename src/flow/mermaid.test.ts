import { describe, expect, it } from 'vitest'
import { parseMermaidFlow } from './mermaid'

describe('mermaid flowchart parser', () => {
  it('parses shapes, labels and direction', () => {
    const f = parseMermaidFlow(`flowchart TD
      A[Start] --> B{Is it cached?}
      B -->|yes| C([Return])
      B -- no --> D[(Database)]
      D --> C`)
    expect(f.direction).toBe('TB')
    expect(f.nodes.map((n) => [n.id, n.label, n.shape])).toEqual([['A', 'Start', 'box'], ['B', 'Is it cached?', 'decision'], ['C', 'Return', 'pill'], ['D', 'Database', 'database']])
    expect(f.edges).toEqual([{ from: 'A', to: 'B' }, { from: 'B', to: 'C', label: 'yes' }, { from: 'B', to: 'D', label: 'no' }, { from: 'D', to: 'C' }])
  })
  it('handles chains, ampersand groups, dashed links, comments and ignored lines', () => {
    const f = parseMermaidFlow(`graph LR
      %% a comment
      A --> B --> C
      C -.-> D & E
      classDef x fill:#fff
      subgraph s
      F --> A
      end`)
    expect(f.direction).toBe('LR')
    expect(f.edges).toEqual([
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D', dashed: true }, { from: 'C', to: 'E', dashed: true }, { from: 'F', to: 'A' }])
  })
  it('later labels override bare ids; quoted text may contain brackets; <br> becomes a newline', () => {
    const f = parseMermaidFlow('flowchart LR\n  A --> B\n  B["Cache (Redis)"]\n  A[Client<br/>app]')
    expect(f.nodes.find((n) => n.id === 'B')!.label).toBe('Cache (Redis)')
    expect(f.nodes.find((n) => n.id === 'A')!.label).toBe('Client\napp')
  })
  it('gives readable errors', () => {
    expect(() => parseMermaidFlow('sequenceDiagram\n A->>B: hi')).toThrow(/flowchart/)
    expect(() => parseMermaidFlow('flowchart LR\n A B')).toThrow(/Expected an arrow/)
    expect(() => parseMermaidFlow('flowchart LR')).toThrow(/No nodes/)
  })
})
