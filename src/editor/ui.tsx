import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Label className="w-16 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Pick({ value, onChange, options, className }: {
  value: string
  onChange: (v: string) => void
  options: (string | { value: string; label: string })[]
  className?: string
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <Select value={value} items={items} onValueChange={(v) => v != null && v !== value && onChange(v)}>
      <SelectTrigger size="sm" className={className ?? 'w-full'}><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function Num({ value, onChange, min, className }: { value: number; onChange: (n: number) => void; min?: number; className?: string }) {
  return <Input type="number" min={min} value={value} className={className ?? 'h-8'} onChange={(e) => onChange(Number(e.target.value))} />
}
