import { Check, ChevronDown } from 'lucide-react'
import { BACKGROUNDS, type BackgroundId } from '@/model/themes'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/** Small tile showing a background pattern in the deck's own theme colours. */
export function BackgroundTile({ theme, bg, size = 34 }: { theme: string; bg: BackgroundId | undefined; size?: number }) {
  return <span aria-hidden data-theme={theme} data-bg={bg && bg !== 'theme' ? bg : undefined} className="bg-preview inline-block shrink-0" style={{ width: size, height: size * 0.7 }} />
}

/** Drop-down for the deck's slide background. */
export function BackgroundPicker({ theme, value, onChange, className }: { theme: string; value: BackgroundId | undefined; onChange: (b: BackgroundId) => void; className?: string }) {
  const cur = BACKGROUNDS.find((b) => b.id === (value ?? 'theme')) ?? BACKGROUNDS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={className ?? 'w-44 justify-between'} aria-label={`Background: ${cur.label}`} />}>
        <span className="flex items-center gap-2"><BackgroundTile theme={theme} bg={cur.id} size={22} />{cur.label}</span><ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {BACKGROUNDS.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => onChange(b.id)} aria-label={`${b.label} background`}>
            <BackgroundTile theme={theme} bg={b.id} />
            <div className="min-w-0 flex-1"><div className="font-medium">{b.label}</div><div className="truncate text-xs text-muted-foreground">{b.description}</div></div>
            {b.id === cur.id && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
