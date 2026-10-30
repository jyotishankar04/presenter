import mermaid from 'mermaid'
import { useEffect, useId, useState } from 'react'
import { isDarkTheme } from '../model/themes'
import type { ThemeId } from '../model/types'

let n = 0

/** Renders mermaid source to SVG; hand-drawn look in the sketch theme. */
export function MermaidView({ code, theme }: { code: string; theme: ThemeId }) {
  const uid = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkTheme(theme) ? 'dark' : 'neutral',
          look: isDarkTheme(theme) ? 'classic' : 'handDrawn',
          fontFamily: isDarkTheme(theme) ? 'JetBrains Mono, monospace' : 'Caveat, cursive',
          securityLevel: 'strict',
        })
        const { svg } = await mermaid.render(`m${uid}-${n++}`, code)
        if (live) { setSvg(svg); setErr('') }
      } catch (e) {
        if (live) setErr(String((e as Error).message ?? e).split('\n')[0])
      }
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [code, theme, uid])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {err ? <div style={{ color: 'var(--red)', font: '16px var(--mono)' }}>Mermaid error: {err}</div>
        : <div className="mermaid-out" style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  )
}
