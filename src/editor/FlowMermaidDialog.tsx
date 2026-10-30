import { useEffect, useState } from 'react'
import { mermaidToFlow } from '../flow/mermaidFlow'
import type { FlowData } from '../flow/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SAMPLES: Record<string, string> = {
  'Cache flow': 'flowchart LR\n  A([User opens link]) --> B[Server]\n  B --> C{In cache?}\n  C -->|yes| D[Return URL]\n  C -->|no| E[(Database)]\n  E --> F[Cache it]\n  F --> D',
  'Web stack': 'flowchart LR\n  Client --> LB[Load balancer]\n  LB --> S1[App server 1]\n  LB --> S2[App server 2]\n  S1 --> DB[(Database)]\n  S2 --> DB',
  'Login': 'flowchart TD\n  S([Start]) --> F[Enter credentials]\n  F --> V{Valid?}\n  V -->|yes| H[Home page]\n  V -->|no| E[Show error]\n  E --> F',
}

export function FlowMermaidDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (flow: FlowData, direction: 'LR' | 'TB') => void }) {
  const [code, setCode] = useState(SAMPLES['Cache flow'])
  const [err, setErr] = useState('')
  useEffect(() => { if (open) setErr('') }, [open])

  const insert = () => {
    try { const r = mermaidToFlow(code); onInsert(r.flow, r.direction); onClose() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import a Mermaid flowchart</DialogTitle>
          <DialogDescription>Nodes, shapes ([ ] { } ( ) [( )]), arrows and |labels| become editable flow nodes.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">{Object.keys(SAMPLES).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => setCode(SAMPLES[k])}>{k}</Button>)}</div>
        <Textarea className="min-h-56 font-mono text-xs" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button disabled={!code.trim()} onClick={insert}>Insert</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
