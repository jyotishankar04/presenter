import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OUTLINE_SAMPLE, outlineToSlides } from '../outline'
import { SlideAny } from '../render/SlideAny'
import { STAGE_W, type Slide, type ThemeId } from '../model/types'
import { TEMPLATES } from '../templates'

/** Type an outline, get slides. */
export function OutlineDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (s: Slide[]) => void }) {
  const [text, setText] = useState('')
  const [stepByStep, setStepByStep] = useState(true)
  const slides = useMemo(() => outlineToSlides(text, { stepByStep }), [text, stepByStep])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Make slides from an outline</DialogTitle>
          <DialogDescription>A line at the left edge is a slide title (start it with <code>#</code> for a big section slide, then <code>&gt; label</code> for the small text above). Indented lines are bullets; deeper-indented bullets stay on their parent's click.</DialogDescription>
        </DialogHeader>
        <Textarea className="min-h-64 font-mono text-xs" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Why we plan first\n  - Requirements\n  - High-level design\n  - Low-level design'} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={stepByStep} onChange={(e) => setStepByStep(e.target.checked)} /> Reveal bullets one click at a time</label>
          <Button size="sm" variant="outline" onClick={() => setText(OUTLINE_SAMPLE)}>Try an example</Button>
        </div>
        <p className="text-sm text-muted-foreground" role="status">{slides.length ? `${slides.length} slide${slides.length > 1 ? 's' : ''}: ${slides.map((s) => s.title).join(' · ')}` : 'Nothing to make yet.'}</p>
        <DialogFooter><Button disabled={!slides.length} onClick={() => { onInsert(slides); setText(''); onClose() }}>Add {slides.length || ''} slide{slides.length === 1 ? '' : 's'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pick a ready-made slide. */
export function TemplateDialog({ open, onClose, onInsert, theme }: { open: boolean; onClose: () => void; onInsert: (s: Slide[]) => void; theme: ThemeId }) {
  const previews = useMemo(() => (open ? TEMPLATES.map((t) => ({ t, slide: t.build()[0] })) : []), [open])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Start from a template</DialogTitle><DialogDescription>The slide is added after the current one. Change the text, then adjust which click each part appears on.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {previews.map(({ t, slide }) => (
            <button key={t.id} onClick={() => { onInsert(t.build()); onClose() }} className="rounded-xl border bg-card p-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <div style={{ width: 260, height: 146, overflow: 'hidden', borderRadius: 6, pointerEvents: 'none' }}><SlideAny slide={slide} step={999} theme={theme} style={{ transform: `scale(${260 / STAGE_W})` }} /></div>
              <div className="mt-1.5 text-sm font-medium">{t.label}</div><div className="text-xs text-muted-foreground">{t.description}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
