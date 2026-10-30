import { icons } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const ALL = Object.keys(icons)
const COMMON = ['Server', 'Database', 'Cloud', 'Zap', 'Globe', 'Monitor', 'Smartphone', 'User', 'Users', 'Lock', 'ShieldCheck', 'Key', 'Mail', 'Bell', 'Search', 'Settings', 'Cog', 'Cpu', 'HardDrive', 'Network', 'Split', 'Layers', 'Box', 'Package', 'GitBranch', 'Terminal', 'Code', 'FileText', 'Folder', 'Activity', 'BarChart3', 'Clock', 'RefreshCw', 'Upload', 'Download', 'Share2', 'Webhook', 'Plug', 'Wifi', 'MessageSquare']

/** Words in the search match the icon name ("hard drive" finds HardDrive). */
export function searchIcons(query: string, limit = 160): string[] {
  const q = query.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!q) return COMMON.filter((n) => n in icons)
  const starts: string[] = [], contains: string[] = []
  for (const n of ALL) { const l = n.toLowerCase(); if (l.startsWith(q)) starts.push(n); else if (l.includes(q)) contains.push(n) }
  return [...starts, ...contains].slice(0, limit)
}

/** Button that shows the current icon and opens a searchable grid of lucide icons. */
export function IconPicker({ value, onChange }: { value?: string; onChange: (name: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const results = useMemo(() => (open ? searchIcons(q) : []), [open, q])
  const Cur = value ? icons[value as keyof typeof icons] : undefined
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 font-normal" onClick={() => setOpen(true)} aria-label={value ? `Icon: ${value}. Change icon` : 'Choose an icon'}>
        {Cur ? <Cur size={16} /> : <Search size={16} className="opacity-50" />}<span className="truncate">{value ?? 'Choose icon…'}</span>
        {value && <span role="button" tabIndex={0} aria-label="Remove icon" className="ml-auto rounded p-0.5 hover:bg-muted" onClick={(e) => { e.stopPropagation(); onChange(undefined) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(undefined) } }}><X size={14} /></span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader><DialogTitle>Choose an icon</DialogTitle><DialogDescription>{ALL.length} icons. Type to search, e.g. “database”, “lock”, “cloud”.</DialogDescription></DialogHeader>
          <Input autoFocus placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search icons" />
          <div role="listbox" aria-label="Icons" className="grid max-h-[50vh] grid-cols-6 gap-1.5 overflow-auto sm:grid-cols-8">
            {results.map((n) => {
              const I = icons[n as keyof typeof icons]
              return (
                <button key={n} role="option" aria-selected={n === value} title={n} onClick={() => { onChange(n); setOpen(false); setQ('') }}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${n === value ? 'border-primary bg-primary/10' : ''}`}>
                  <I size={22} /><span className="w-full truncate text-center">{n}</span>
                </button>
              )
            })}
            {!results.length && <p className="col-span-full p-4 text-sm text-muted-foreground">No icon matches “{q}”.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
