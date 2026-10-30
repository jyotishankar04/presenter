import { Check, ChevronDown } from 'lucide-react'
import { THEMES, themeDef, type ThemeDef, type ThemeId } from '@/model/themes'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/** Three dots that sum up a theme: its background, ink and main accent. */
export function ThemeSwatch({ theme, size = 14 }: { theme: ThemeDef; size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center rounded-full border" style={{ background: theme.bg, padding: 2, gap: 2 }}>
      {[theme.accents.blue, theme.accents.amber, theme.accents.green].map((c, i) => <span key={i} style={{ width: size / 2, height: size / 2, borderRadius: 9999, background: c, display: 'block' }} />)}
    </span>
  )
}

/** Drop-down theme chooser with a colour preview for every theme. */
export function ThemePicker({ value, onChange, className }: { value: string; onChange: (id: ThemeId) => void; className?: string }) {
  const cur = themeDef(value)
  const light = THEMES.filter((t: ThemeDef) => !t.dark), dark = THEMES.filter((t: ThemeDef) => t.dark)
  const item = (t: ThemeDef) => (
    <DropdownMenuItem key={t.id} onClick={() => onChange(t.id as ThemeId)} aria-label={`${t.label} theme`}>
      <ThemeSwatch theme={t} />
      <div className="min-w-0 flex-1"><div className="font-medium">{t.label}</div><div className="truncate text-xs text-muted-foreground">{t.description}</div></div>
      {t.id === cur.id && <Check className="ml-auto size-4" />}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={className ?? 'w-44 justify-between'} aria-label={`Theme: ${cur.label}`} />}>
        <span className="flex items-center gap-2"><ThemeSwatch theme={cur} />{cur.label}</span><ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup><DropdownMenuLabel>Light</DropdownMenuLabel>{light.map(item)}</DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup><DropdownMenuLabel>Dark</DropdownMenuLabel>{dark.map(item)}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Grid of theme cards for the "new deck" dialog. */
export function ThemeCards({ value, onChange }: { value: string; onChange: (id: ThemeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {THEMES.map((t: ThemeDef) => (
        <button key={t.id} role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id as ThemeId)}
          className={`rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${value === t.id ? 'border-primary ring-2 ring-primary/40' : 'hover:bg-muted'}`}>
          <div className="mb-1.5 flex h-14 items-end gap-1 rounded-lg p-2" style={{ background: t.bg, border: `1px solid ${t.cardline}` }}>
            <span style={{ width: 16, height: 22, borderRadius: 3, background: t.card, border: `1.5px solid ${t.accents.blue}` }} />
            <span style={{ width: 16, height: 32, borderRadius: 3, background: t.card, border: `1.5px solid ${t.accents.amber}` }} />
            <span style={{ width: 16, height: 16, borderRadius: 3, background: t.card, border: `1.5px solid ${t.accents.green}` }} />
            <span className="ml-auto text-[10px] font-bold" style={{ color: t.ink }}>Aa</span>
          </div>
          <div className="text-sm font-medium">{t.label}</div>
          <div className="text-[11px] leading-tight text-muted-foreground">{t.description}</div>
        </button>
      ))}
    </div>
  )
}
