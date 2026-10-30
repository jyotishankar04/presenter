import { icons } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { ThemeId, CodeEl, ArrowEl, BoxEl, CardListEl, DemoEl, El, ImageEl, SequenceEl, Slide, StrikeEl, TextEl } from '../model/types'
import { connect } from '../model/geometry'
import { accentTextVar, accentVar, RoughRect } from './rough'
import { demos } from '../demos'
import { MermaidView } from './MermaidView'
import { CodeView } from './CodeView'

/** Hooks the editor passes in so text can be edited right on the slide. */
export interface EditCtx {
  editing: string | null
  apply: (id: string, fn: (e: any) => void) => void
  slideField: (field: 'title' | 'eyebrow', value: string) => void
  stop: () => void
}

/** Inline-editable text: commits on blur, Escape/Enter(single-line) finish. */
export function Ed({ value, active, on, stop, multiline, always }: { value: string; active: boolean; on: (v: string) => void; stop: () => void; multiline?: boolean; always?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!active || always || !ref.current) return
    ref.current.focus()
    const r = document.createRange(); r.selectNodeContents(ref.current)
    const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r)
  }, [active])
  if (!active) return <>{value}</>
  return (
    <span ref={ref} contentEditable suppressContentEditableWarning spellCheck={false} className={always ? 'ed-always' : 'ed-active'}
      style={{ cursor: 'text', minWidth: 20, display: 'inline-block' }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey))) { e.preventDefault(); (e.target as HTMLElement).blur() } e.stopPropagation() }}
      onBlur={(e) => { const v = (e.currentTarget.innerText ?? '').replace(/\n$/, ''); if (v !== value) on(v); stop() }}>
      {value}
    </span>
  )
}

export function Icon({ name, size = 30, color }: { name?: string; size?: number; color?: string }) {
  if (!name) return null
  const C = icons[name as keyof typeof icons]
  return C ? <C size={size} color={color} strokeWidth={1.8} /> : null
}

const on = (reveal: number, step: number) => (reveal <= step ? 'on' : '')
const pos = (el: El) => ({ left: el.x, top: el.y, width: el.w, height: el.h })

function Text({ el, step, edit }: { el: TextEl; step: number; edit?: EditCtx }) {
  return (
    <div className={`el rv text ${el.style} ${on(el.reveal, step)}`}
      style={{ ...pos(el), fontSize: el.size, color: accentTextVar[el.accent], textAlign: el.align }}>
      {edit ? <Ed multiline active={edit.editing === el.id} value={el.text} on={(v) => edit.apply(el.id, (e) => { e.text = v })} stop={edit.stop} /> : el.text}
    </div>
  )
}

function Box({ el, step, edit }: { el: BoxEl; step: number; edit?: EditCtx }) {
  const color = el.muted ? 'var(--faint)' : accentVar[el.accent]
  return (
    <div className={`el rv box ${el.muted ? 'muted' : ''} ${on(el.reveal, step)}`} style={{ ...pos(el), borderColor: color }}>
      <div className="roughbox" style={{ position: 'absolute', inset: 0 }} data-rough>
        <RoughRect id={el.id} w={el.w} h={el.h} color={color} width={el.muted ? 3 : 4} />
      </div>
      <div className="lbl" style={{ color: el.muted ? undefined : accentTextVar[el.accent] }}>
        <Icon name={el.icon} size={el.muted ? 40 : 30} color={el.muted ? undefined : color} />
        {edit ? <Ed multiline active={edit.editing === el.id} value={el.label} on={(v) => edit.apply(el.id, (e) => { e.label = v })} stop={edit.stop} /> : el.label}
      </div>
    </div>
  )
}

function CardList({ el, step, edit }: { el: CardListEl; step: number; edit?: EditCtx }) {
  return (
    <div className={`el rv cardlist ${on(el.reveal, step)}`} style={pos(el)}>
      <div className="hdr" style={{ color: accentVar[el.accent], borderColor: accentVar[el.accent] }}>
        {edit ? <Ed active={edit.editing === el.id} value={el.header} on={(v) => edit.apply(el.id, (e) => { e.header = v })} stop={edit.stop} /> : el.header}
      </div>
      {el.cards.map((c, i) => (
        <div key={i} className={`card rv ${on(c.reveal, step)}`}>
          {edit ? <Ed active={edit.editing === el.id} value={c.text} on={(v) => edit.apply(el.id, (e) => { e.cards[i].text = v })} stop={edit.stop} /> : c.text}
        </div>
      ))}
    </div>
  )
}

function Strike({ el, step, edit }: { el: StrikeEl; step: number; edit?: EditCtx }) {
  return (
    <div className={`el rv strike ${on(el.reveal, step)}`} style={pos(el)}>
      <span className="wrong">{edit ? <Ed active={edit.editing === el.id} value={el.wrong} on={(v) => edit.apply(el.id, (e) => { e.wrong = v })} stop={edit.stop} /> : el.wrong}</span>
      <span className="is">is really</span>
      <span className="right">{edit ? <Ed active={edit.editing === el.id} value={el.right} on={(v) => edit.apply(el.id, (e) => { e.right = v })} stop={edit.stop} /> : el.right}</span>
    </div>
  )
}

function Sequence({ el, step }: { el: SequenceEl; step: number }) {
  const { w, h, actors, messages } = el
  const colW = w / actors.length
  const cx = (i: number) => colW * i + colW / 2
  const top = 56
  const rowH = (h - top - 30) / Math.max(messages.length, 1)
  return (
    <div className={`el rv ${on(el.reveal, step)}`} style={pos(el)}>
      <svg className="seq" width={w} height={h} style={{ overflow: 'visible' }}>
        {actors.map((a, i) => (
          <g key={a}>
            <rect x={cx(i) - 70} y={0} width={140} height={44} rx={12} fill="var(--card)" stroke="var(--cardline)" />
            <text x={cx(i)} y={27} textAnchor="middle" fontSize={18} fontWeight={600} fill="var(--ink)">{a}</text>
            <line x1={cx(i)} y1={44} x2={cx(i)} y2={h} stroke="var(--faint)" strokeDasharray="4 5" />
          </g>
        ))}
        {messages.map((m, i) => {
          const y = top + rowH * i + rowH / 2
          const x1 = cx(m.from), x2 = cx(m.to)
          const col = m.kind === 'request' ? 'var(--blue)' : 'var(--green)'
          const dir = x2 > x1 ? 1 : -1
          return (
            <g key={i} className={`rv ${on(m.reveal, step)}`} style={{ transition: 'opacity .45s' }}>
              <text x={Math.min(x1, x2) + 14} y={y - 14} fontSize={17} fill="var(--ink)">{m.text}</text>
              <line x1={x1} y1={y} x2={x2 - dir * 6} y2={y} stroke={col} strokeWidth={1.8} />
              <circle cx={x1} cy={y} r={4} fill="var(--bg)" stroke={col} strokeWidth={1.8} />
              <path d={`M${x2},${y} l${-dir * 9},-5 l0,10 z`} fill={col} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Image({ el, step }: { el: ImageEl; step: number }) {
  return (
    <div className={`el rv ${on(el.reveal, step)}`} style={pos(el)}>
      <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

function Demo({ el, step }: { el: DemoEl; step: number }) {
  const D = demos[el.demo]
  return (
    <div className={`el rv ${on(el.reveal, step)}`} style={pos(el)}>
      <div className="demo-frame">{D ? <D /> : <em>unknown demo “{el.demo}”</em>}</div>
    </div>
  )
}

function Arrow({ el, slide, step }: { el: ArrowEl; slide: Slide; step: number }) {
  const a = slide.elements.find((e) => e.id === el.from)
  const b = slide.elements.find((e) => e.id === el.to)
  if (!a || !b) return null
  const { from, to } = connect(a, b, 6)
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  const hl = 20
  const p1 = { x: to.x - hl * Math.cos(ang - 0.4), y: to.y - hl * Math.sin(ang - 0.4) }
  const p2 = { x: to.x - hl * Math.cos(ang + 0.4), y: to.y - hl * Math.sin(ang + 0.4) }
  const col = accentVar[el.accent]
  return (
    <svg className={`arrow ${on(el.reveal, step)}`} width={1600} height={900}>
      <path className="line" pathLength={1} d={`M${from.x},${from.y} L${to.x - 4 * Math.cos(ang)},${to.y - 4 * Math.sin(ang)}`} stroke={col} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path className="head" d={`M${p1.x},${p1.y} L${to.x},${to.y} L${p2.x},${p2.y} z`} fill={col} stroke={col} strokeWidth={2} strokeLinejoin="round" />
      {el.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 10} textAnchor="middle" fontSize={22} fill="var(--muted)" fontFamily="var(--hand)">{el.label}</text>}
    </svg>
  )
}

function Mermaid({ el, step, theme }: { el: Extract<El, { type: 'mermaid' }>; step: number; theme: ThemeId }) {
  return <div className={`el rv ${on(el.reveal, step)}`} style={pos(el)}><MermaidView code={el.code} theme={theme} /></div>
}

function Code({ el, step, theme }: { el: CodeEl; step: number; theme: ThemeId }) {
  return <div className={`el rv ${on(el.reveal, step)}`} style={pos(el)}><CodeView el={el} step={step} theme={theme} /></div>
}

export function ElementView({ el, slide, step, theme, edit }: { el: El; slide: Slide; step: number; theme: ThemeId; edit?: EditCtx }): ReactNode {
  switch (el.type) {
    case 'text': return <Text el={el} step={step} edit={edit} />
    case 'box': return <Box el={el} step={step} edit={edit} />
    case 'arrow': return <Arrow el={el} slide={slide} step={step} />
    case 'cardList': return <CardList el={el} step={step} edit={edit} />
    case 'sequence': return <Sequence el={el} step={step} />
    case 'image': return <Image el={el} step={step} />
    case 'demo': return <Demo el={el} step={step} />
    case 'strike': return <Strike el={el} step={step} edit={edit} />
    case 'mermaid': return <Mermaid el={el} step={step} theme={theme} />
    case 'code': return <Code el={el} step={step} theme={theme} />
  }
}
