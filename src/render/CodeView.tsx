import { useEffect, useState } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'
import { focusedLines } from '../model/reveal'
import { isDarkTheme, themeDef, THEMES } from '../model/themes'
import type { CodeEl, ThemeId } from '../model/types'

let hl: Promise<Highlighter> | null = null
const LANGS = ['typescript', 'javascript', 'python', 'go', 'java', 'rust', 'sql', 'bash', 'json', 'yaml', 'tsx', 'c', 'cpp']
export const CODE_LANGS = LANGS

const get = () => (hl ??= createHighlighter({ themes: [...new Set(THEMES.map((t) => t.shiki))], langs: LANGS }))

export function CodeView({ el, step, theme }: { el: CodeEl; step: number; theme: ThemeId }) {
  const [lines, setLines] = useState<string[] | null>(null)

  useEffect(() => {
    let live = true
    get().then((h) => {
      const { tokens } = h.codeToTokens(el.code, { lang: (LANGS.includes(el.lang) ? el.lang : 'typescript') as 'typescript', theme: themeDef(theme).shiki })
      if (live) setLines(tokens.map((line) => line.map((t) => `<span style="color:${t.color}">${t.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join('')))
    })
    return () => { live = false }
  }, [el.code, el.lang, theme])

  const focus = focusedLines(el.focus, step)
  const rows = lines ?? el.code.split('\n')
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 16, padding: '24px 0', overflow: 'hidden',
      background: 'var(--card)', border: '1.5px solid var(--cardline)', font: `${el.size}px/1.55 var(--mono)` }}>
      {rows.map((html, i) => {
        const on = !focus || focus.has(i + 1)
        return (
          <div key={i} style={{ display: 'flex', padding: '0 24px', opacity: on ? 1 : 0.5, transition: 'opacity .4s',
            background: focus && on ? (isDarkTheme(theme) ? 'color-mix(in oklab, var(--blue) 20%, transparent)' : '#fff8c5') : 'transparent' }}>
            <span style={{ width: 40, color: 'var(--faint)', userSelect: 'none', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ whiteSpace: 'pre' }} dangerouslySetInnerHTML={{ __html: lines ? html || ' ' : html.replace(/</g, '&lt;') || ' ' }} />
          </div>
        )
      })}
    </div>
  )
}
