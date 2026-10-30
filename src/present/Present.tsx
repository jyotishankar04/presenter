import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { next, prev, totalSteps, type Position } from '../model/reveal'
import { STAGE_H, STAGE_W, type Deck } from '../model/types'
import { SlideAny } from '../render/SlideAny'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'
import { announce, LiveRegion } from '@/lib/announce'
import { useBrowserGuard } from '@/lib/shortcuts'
import { BackgroundContext } from '../render/background'
import { channelName } from './PresenterView'

export function useFitScale(w = STAGE_W, h = STAGE_H) {
  const [s, setS] = useState(1)
  useLayoutEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / w, window.innerHeight / h))
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [w, h])
  return s
}

function readHash(): Position {
  const [a, b] = location.hash.replace('#', '').split('.').map(Number)
  return { slide: Number.isFinite(a) ? a : 0, step: Number.isFinite(b) ? b : 0 }
}

export function Present() {
  const { id } = useParams()
  const nav = useNavigate()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [pos, setPos] = useState<Position>(readHash)
  const [grid, setGrid] = useState(false)
  const [blank, setBlank] = useState(false)
  const [help, setHelp] = useState(false)
  const [jump, setJump] = useState('')
  const [idle, setIdle] = useState(false)
  const scale = useFitScale()
  useBrowserGuard()

  const [notes, setNotes] = useState(false)
  useEffect(() => { api.get(id!).then(setDeck) }, [id])
  useEffect(() => { history.replaceState(null, '', `#${pos.slide}.${pos.step}`) }, [pos])

  // keep a presenter-view window (key V) in sync, in both directions
  const chan = useRef<BroadcastChannel | null>(null)
  const posRef = useRef(pos); posRef.current = pos
  useEffect(() => {
    const c = new BroadcastChannel(channelName(id!)); chan.current = c
    c.onmessage = (e) => {
      if (e.data?.type === 'ask') c.postMessage({ type: 'pos', pos: posRef.current })
      if (e.data?.type === 'goto') { setBlank(false); setPos(e.data.pos) }
    }
    return () => c.close()
  }, [id])
  useEffect(() => { chan.current?.postMessage({ type: 'pos', pos }) }, [pos])

  const go = useCallback((dir: 1 | -1) => {
    if (!deck) return
    setBlank(false)
    setPos((p) => (dir === 1 ? next(deck.slides, p) : prev(deck.slides, p)))
  }, [deck])

  // tell screen readers where we are
  useEffect(() => {
    if (!deck) return
    const s = deck.slides[Math.min(pos.slide, deck.slides.length - 1)]
    announce(`Slide ${pos.slide + 1} of ${deck.slides.length}${s.title ? `: ${s.title}` : ''}. Click ${pos.step} of ${totalSteps(s)}.`)
  }, [deck, pos])

  const jumpRef = useRef(jump); jumpRef.current = jump
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (help && k !== '?' && k !== 'Escape') return
      if (/^[0-9]$/.test(k)) { setJump((j) => (j + k).slice(0, 3)); return }
      if (k === 'Enter' && jumpRef.current) {
        e.preventDefault()
        const n = Math.max(1, Math.min(deck?.slides.length ?? 1, Number(jumpRef.current)))
        setJump(''); setBlank(false); setPos({ slide: n - 1, step: 0 }); return
      }
      if (k === 'Escape' && jumpRef.current) { setJump(''); return }
      if (['ArrowRight', 'ArrowDown', ' ', 'Enter', 'PageDown', 'n', 'N'].includes(k)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'ArrowUp', 'Backspace', 'PageUp', 'p', 'P'].includes(k)) { e.preventDefault(); go(-1) }
      else if (k === 'Home') { e.preventDefault(); setBlank(false); setPos({ slide: 0, step: 0 }) }
      else if (k === 'End' && deck) { e.preventDefault(); setBlank(false); const last = deck.slides.length - 1; setPos({ slide: last, step: totalSteps(deck.slides[last]) }) }
      else if (k === 'b' || k === 'B' || k === '.') setBlank((b) => !b)
      else if (k === 'f' || k === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
      else if (k === 'g' || k === 'G') setGrid((g) => !g)
      else if (k === 's' || k === 'S') setNotes((n) => !n)
      else if (k === 'v' || k === 'V') window.open(`/presenter/${id}`, 'presenter-view', 'popup,width=1100,height=760')
      else if (k === '?') setHelp((h) => !h)
      else if (k === 'Escape' && help) setHelp(false)
      else if (k === 'Escape' && !document.fullscreenElement) nav(`/edit/${id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, nav, id, deck, help])

  // hide the cursor a moment after the mouse stops (cleaner screen recordings)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2000) }
    wake()
    window.addEventListener('mousemove', wake)
    return () => { clearTimeout(t); window.removeEventListener('mousemove', wake) }
  }, [])

  // swipe on touch screens
  const touch = useRef<number | null>(null)

  if (!deck) return <div className="present-wrap" role="status" aria-label="Loading" />
  const slide = deck.slides[Math.min(pos.slide, deck.slides.length - 1)]

  const wrap = (node: React.ReactNode) => <BackgroundContext.Provider value={deck.background}>{node}</BackgroundContext.Provider>

  if (grid) {
    return wrap(
      <div role="listbox" aria-label="Slides" style={{ position: 'fixed', inset: 0, background: '#111', overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 320px)', gap: 16 }}>
        {deck.slides.map((s, i) => (
          <div key={s.id} role="option" aria-selected={i === pos.slide} aria-label={`Slide ${i + 1}: ${s.title ?? ''}`} tabIndex={0}
            onClick={() => { setPos({ slide: i, step: 0 }); setGrid(false) }} onKeyDown={(e) => { if (e.key === 'Enter') { setPos({ slide: i, step: 0 }); setGrid(false) } }}
            style={{ width: 320, height: 180, overflow: 'hidden', cursor: 'pointer', outline: i === pos.slide ? '3px solid #4a6cf7' : 'none' }}>
            <SlideAny slide={s} step={999} theme={deck.theme} style={{ transform: 'scale(0.2)' }} />
          </div>
        ))}
      </div>
    )
  }

  return wrap(
    <div className="present-wrap" style={{ cursor: idle ? 'none' : 'default' }}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.demo-frame')) go(1) }}
      onContextMenu={(e) => { e.preventDefault(); go(-1) }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (touch.current != null) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null } }}>
      <LiveRegion />
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, visibility: blank ? 'hidden' : 'visible' }}>
        <SlideAny slide={slide} step={pos.step} theme={deck.theme} style={{ transform: `scale(${scale})` }} />
      </div>
      {notes && <div className="fixed inset-x-0 bottom-0 max-h-[30vh] overflow-auto whitespace-pre-wrap bg-black/85 px-8 py-4 text-lg text-white" role="note" aria-label="Speaker notes">{slide.notes || 'No notes for this slide. (S hides this panel.)'}</div>}
      {jump && <div className="fixed bottom-6 right-6 rounded-md bg-black/70 px-4 py-2 font-mono text-2xl text-white" role="status">Go to slide {jump}…</div>}
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </div>
  )
}
