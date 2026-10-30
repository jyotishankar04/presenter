import { SHORTCUTS } from '@/lib/shortcuts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press <kbd className="rounded border px-1">?</kbd> any time to open this.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {SHORTCUTS.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="mb-2 text-sm font-semibold">{g.title}</h3>
              <dl className="grid gap-1.5 text-sm">
                {g.items.map(([keys, what]) => (
                  <div key={keys + what} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{what}</dt>
                    <dd><kbd className="whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 text-xs">{keys}</kbd></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
