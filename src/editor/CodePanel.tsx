import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ClipboardCopy, RotateCcw, WandSparkles } from 'lucide-react'
import { slideToCode, validateSlideCode } from '../model/validate'
import type { Slide } from '../model/types'
import { Button } from '@/components/ui/button'
import { announce } from '@/lib/announce'
import { errorPosition, tokenizeJson, type TokenKind } from './highlight'
import { useStore } from './store'

const COLOR: Record<TokenKind, string> = {
  key: 'text-sky-600 dark:text-sky-300',
  string: 'text-emerald-600 dark:text-emerald-300',
  number: 'text-amber-600 dark:text-amber-300',
  literal: 'text-violet-600 dark:text-violet-300',
  punct: 'text-muted-foreground',
  plain: '',
}
const ERR = 'underline decoration-red-500 decoration-wavy underline-offset-4 bg-red-500/20'

/** Coloured copy of the text that sits exactly under the transparent textarea. */
function Highlighted({ text, errorAt }: { text: string; errorAt: number | null }) {
  const tokens = useMemo(() => tokenizeJson(text), [text])
  return (
    <>
      {tokens.map((t) => {
        const hit = errorAt != null && errorAt >= t.start && errorAt < t.start + t.text.length
        if (!hit) return <span key={t.start} className={COLOR[t.kind]}>{t.text}</span>
        const i = errorAt! - t.start
        return (
          <Fragment key={t.start}>
            <span className={COLOR[t.kind]}>{t.text.slice(0, i)}</span>
            <span className={`${COLOR[t.kind]} ${ERR}`}>{t.text.slice(i, i + 1)}</span>
            <span className={COLOR[t.kind]}>{t.text.slice(i + 1)}</span>
          </Fragment>
        )
      })}
      {errorAt != null && errorAt >= text.length && <span className={ERR}> </span>}
      {'\n'}
    </>
  )
}

const pretty = (s: Slide) => JSON.stringify(slideToCode(s), null, 2)

/** Edit a normal slide as JSON. Valid code is applied live; the visual panel and the slide stay in sync. */
export function CodePanel({ slide, slideIdx }: { slide: Slide; slideIdx: number }) {
  const commit = useStore((s) => s.commit)
  const canonical = useMemo(() => pretty(slide), [slide])
  const [text, setText] = useState(canonical)
  const [error, setError] = useState<string | null>(null)
  const focused = useRef(false)
  const pre = useRef<HTMLPreElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastApplied = useRef(canonical)

  // pull in changes made visually, unless the user is mid-edit here
  useEffect(() => {
    if (!focused.current && canonical !== text) { setText(canonical); setError(null) }
    lastApplied.current = canonical
  }, [canonical]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (value: string) => {
    let obj: any
    try { obj = JSON.parse(value) } catch (e) { setError((e as Error).message); return }
    const problem = validateSlideCode(obj)
    if (problem) { setError(problem); return }
    setError(null)
    if (JSON.stringify(obj) === JSON.stringify(slideToCode(useStore.getState().deck!.slides[slideIdx]))) return
    commit((d) => {
      const sl = d.slides[slideIdx]
      sl.layout = obj.layout
      if (obj.title === undefined) delete sl.title; else sl.title = obj.title
      if (obj.eyebrow === undefined) delete sl.eyebrow; else sl.eyebrow = obj.eyebrow
      sl.elements = obj.elements
    })
    const live = useStore.getState()
    const ids = new Set(obj.elements.map((e: any) => e.id))
    if (live.selectedIds.some((id) => !ids.has(id))) live.selectMany(live.selectedIds.filter((id) => ids.has(id)))
  }

  const onChange = (v: string) => {
    setText(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => apply(v), 450)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const status = error
    ? <span className="flex items-start gap-1.5 text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</span>
    : <span className="flex items-center gap-1.5 text-muted-foreground"><Check className="size-4" /> Valid — changes apply as you type</span>

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative h-[60vh] min-h-64 rounded-lg border bg-muted/30 focus-within:ring-2 ${error ? 'border-destructive focus-within:ring-destructive/40' : 'focus-within:ring-ring'}`}>
        <pre ref={pre} aria-hidden className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 font-mono text-xs leading-relaxed">
          <Highlighted text={text} errorAt={errorPosition(error)} />
        </pre>
        <textarea
          aria-label="Slide as code (JSON)" aria-invalid={!!error} aria-describedby="code-status"
          spellCheck={false} wrap="off" value={text}
          onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft } }}
          onFocus={() => { focused.current = true }}
          onBlur={() => { focused.current = false; clearTimeout(timer.current); apply(text); if (!validateSlideCode(safeParse(text))) setText(pretty(useStore.getState().deck!.slides[slideIdx])) }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget, s = t.selectionStart; const v = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd); onChange(v); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2 }) }
            e.stopPropagation()
          }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-xs leading-relaxed text-transparent caret-foreground outline-none selection:bg-primary/30"
        />
      </div>
      <div id="code-status" role="status" className="min-h-9 text-xs">{status}</div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => { const o = safeParse(text); if (o) setText(JSON.stringify(o, null, 2)) }}><WandSparkles /> Format</Button>
        <Button size="sm" variant="outline" onClick={() => { setText(canonical); setError(null) }}><RotateCcw /> Revert</Button>
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(text); announce('Copied slide code') }}><ClipboardCopy /> Copy</Button>
      </div>
      <p className="text-xs text-muted-foreground">Each element has <code>x y w h</code> (on a 1600×900 stage), <code>reveal</code> (the click it appears on) and type-specific fields. Arrows connect boxes by <code>from</code>/<code>to</code> id.</p>
    </div>
  )
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
