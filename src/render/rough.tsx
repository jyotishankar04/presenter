import { useMemo } from 'react'
import rough from 'roughjs'
import type { Accent } from '../model/types'

const gen = rough.generator()

export const accentVar: Record<Accent, string> = {
  amber: 'var(--amber)', blue: 'var(--blue)', green: 'var(--green)',
  red: 'var(--red)', ink: 'var(--ink)', muted: 'var(--faint)',
}
export const accentTextVar: Record<Accent, string> = {
  amber: 'var(--amber-ink)', blue: 'var(--blue-ink)', green: 'var(--green-ink)',
  red: 'var(--red)', ink: 'var(--ink)', muted: 'var(--muted)',
}

export function seedOf(id: string): number {
  let h = 7
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) + 1
}

/** Hand-drawn rectangle outline. Stable for a given id/size. */
export function RoughRect({ id, w, h, color, width = 4 }: { id: string; w: number; h: number; color: string; width?: number }) {
  const paths = useMemo(() => {
    const d = gen.rectangle(2, 2, w - 4, h - 4, { seed: seedOf(id), roughness: 1.4, strokeWidth: width, stroke: color })
    return gen.toPaths(d)
  }, [id, w, h, color, width])
  return (
    <svg className="rough" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} stroke={color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" />
      ))}
    </svg>
  )
}

/** Hand-drawn line, used for underlines / scribbles. */
export function RoughLine({ id, x1, y1, x2, y2, color, width = 6 }: { id: string; x1: number; y1: number; x2: number; y2: number; color: string; width?: number }) {
  const paths = useMemo(() => gen.toPaths(gen.line(x1, y1, x2, y2, { seed: seedOf(id), roughness: 2, strokeWidth: width, stroke: color })), [id, x1, y1, x2, y2, color, width])
  return <>{paths.map((p, i) => <path key={i} d={p.d} stroke={color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" />)}</>
}
