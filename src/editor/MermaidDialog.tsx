import { useEffect, useState } from 'react'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SAMPLES: Record<string, string> = {
  Flowchart: 'flowchart LR\n  Client --> LB[Load balancer]\n  LB --> S1[Server 1]\n  LB --> S2[Server 2]\n  S1 --> DB[(Database)]\n  S2 --> DB',
  Sequence: 'sequenceDiagram\n  Browser->>Shortener: open sho.rt/aB3x9K\n  Shortener->>Database: which URL is aB3x9K?\n  Database-->>Shortener: the long URL\n  Shortener-->>Browser: redirect',
  Class: 'classDiagram\n  class Shortener {\n    +shorten(url)\n    +resolve(code)\n  }\n  class Store\n  Shortener --> Store',
}

/** Converts Mermaid source into normal, editable Excalidraw shapes and drops them in the middle of the view. */
export function MermaidDialog({ api, open, onClose }: { api: any; open: boolean; onClose: () => void }) {
  const [code, setCode] = useState(SAMPLES.Flowchart)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setErr('') }, [open])

  async function insert() {
    if (!api) return
    setBusy(true); setErr('')
    try {
      const parsed = await parseMermaidToExcalidraw(code, { themeVariables: { fontSize: '20px' } })
      const els: any[] = convertToExcalidrawElements(parsed.elements as any, { regenerateIds: true })
      if (!els.length) throw new Error('Nothing to draw')
      const x1 = Math.min(...els.map((e) => e.x)), y1 = Math.min(...els.map((e) => e.y))
      const x2 = Math.max(...els.map((e) => e.x + e.width)), y2 = Math.max(...els.map((e) => e.y + e.height))
      const st = api.getAppState()
      const cx = -st.scrollX + st.width / 2 / st.zoom.value, cy = -st.scrollY + st.height / 2 / st.zoom.value
      const dx = cx - (x1 + x2) / 2, dy = cy - (y1 + y2) / 2
      const moved = els.map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }))
      if (parsed.files) api.addFiles(Object.values(parsed.files))
      api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), ...moved],
        appState: { selectedElementIds: Object.fromEntries(moved.map((e) => [e.id, true])) },
        captureUpdate: 'IMMEDIATELY',
      })
      onClose()
    } catch (e) {
      setErr(String((e as Error).message ?? e).split('\n')[0])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Insert Mermaid diagram</DialogTitle>
          <DialogDescription>It becomes normal shapes and arrows you can move, restyle and reveal step by step.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5">
          {Object.keys(SAMPLES).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => setCode(SAMPLES[k])}>{k}</Button>)}
        </div>
        <Textarea className="min-h-56 font-mono text-xs" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
        {err && <p className="text-sm text-destructive">Mermaid error: {err}</p>}
        <DialogFooter><Button disabled={busy || !code.trim()} onClick={insert}>{busy ? 'Drawing…' : 'Insert'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
