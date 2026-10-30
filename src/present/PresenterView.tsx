import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { api } from '../api'
import { Button } from '@/components/ui/button'
import { next, prev, totalSteps, type Position } from '../model/reveal'
import { STAGE_W, type Deck } from '../model/types'
import { SlideAny } from '../render/SlideAny'
import { BackgroundContext } from '../render/background'

export const channelName = (deckId: string) => `presenter-sync:${deckId}`

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

function Thumb({ deck, pos, width }: { deck: Deck; pos: Position; width: number }) {
  const slide = deck.slides[Math.min(pos.slide, deck.slides.length - 1)]
  return (
    <div style={{ width, height: width * 9 / 16, overflow: 'hidden', borderRadius: 8, pointerEvents: 'none' }}>
      <SlideAny slide={slide} step={pos.step} theme={deck.theme} style={{ transform: `scale(${width / STAGE_W})` }} />
    </div>
  )
}

/** Second-window view for the speaker: current + next slide, notes, clock and timer. Follows (and can drive) the main presenter window. */
export function PresenterView() {
  const { id } = useParams()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [pos, setPos] = useState<Position>({ slide: 0, step: 0 })
  const [started, setStarted] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const chan = useRef<BroadcastChannel | null>(null)

  useEffect(() => { api.get(id!).then(setDeck) }, [id])
  useEffect(() => {
    const c = new BroadcastChannel(channelName(id!)); chan.current = c
    c.onmessage = (e) => { if (e.data?.type === 'pos') setPos(e.data.pos); if (e.data?.type === 'hello') c.postMessage({ type: 'ask' }) }
    c.postMessage({ type: 'ask' })   // main window answers with its position
    return () => c.close()
  }, [id])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])

  const drive = useCallback((dir: 1 | -1) => {
    if (!deck) return
    const np = dir === 1 ? next(deck.slides, pos) : prev(deck.slides, pos)
    setPos(np); chan.current?.postMessage({ type: 'goto', pos: np })
  }, [deck, pos])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); drive(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); drive(-1) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [drive])

  if (!deck) return <div className="p-10" role="status">Loading…</div>
  const slide = deck.slides[Math.min(pos.slide, deck.slides.length - 1)]
  const upcoming = pos.step < totalSteps(slide) ? { slide: pos.slide, step: pos.step + 1 } : pos.slide + 1 < deck.slides.length ? { slide: pos.slide + 1, step: 0 } : null

  return (
    <BackgroundContext.Provider value={deck.background}>
      <div className="grid h-full grid-rows-[auto_1fr] gap-3 bg-muted/40 p-4">
        <header className="flex items-center gap-3">
          <h1 className="flex-1 truncate text-lg font-semibold">{deck.title}</h1>
          <span className="text-sm text-muted-foreground">Slide {pos.slide + 1} / {deck.slides.length} · click {pos.step} / {totalSteps(slide)}</span>
          <span className="font-mono text-2xl tabular-nums" aria-label="Time spent">{fmt(now - started)}</span>
          <Button size="icon-sm" variant="outline" aria-label="Reset timer" title="Reset timer" onClick={() => setStarted(Date.now())}><RotateCcw /></Button>
          <Button size="icon-sm" variant="outline" aria-label="Previous" onClick={() => drive(-1)}><ChevronLeft /></Button>
          <Button size="icon-sm" aria-label="Next" onClick={() => drive(1)}><ChevronRight /></Button>
        </header>
        <div className="grid min-h-0 gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Now</div>
            <Thumb deck={deck} pos={pos} width={620} />
            <div className="text-xs font-semibold uppercase text-muted-foreground">Next</div>
            {upcoming ? <Thumb deck={deck} pos={upcoming} width={300} /> : <p className="text-sm text-muted-foreground">End of the deck.</p>}
          </div>
          <section className="min-h-0 overflow-auto rounded-xl border bg-background p-4" aria-label="Speaker notes">
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Notes</div>
            <p className="whitespace-pre-wrap text-xl leading-relaxed">{slide.notes || <span className="text-muted-foreground">No notes for this slide.</span>}</p>
          </section>
        </div>
      </div>
    </BackgroundContext.Provider>
  )
}
