import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_IDS, BACKGROUNDS, DARK_THEME_IDS, isBackgroundId, isDarkTheme, isThemeId, THEMES, themeCss, themeDef } from './themes'

const lum = (hex: string) => {
  const c = hex.replace('#', '').slice(0, 6).match(/../g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('theme registry', () => {
  it('has the expected themes, with unique ids and the neutral dark fallback', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['sketch', 'dark', 'midnight', 'terminal', 'violet', 'ember'])
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
    expect(themeDef('nope').id).toBe('dark'); expect(themeDef(undefined).id).toBe('dark')
    expect(isThemeId('violet')).toBe(true); expect(isThemeId('purple')).toBe(false)
    expect(isDarkTheme('sketch')).toBe(false); expect(DARK_THEME_IDS).toEqual(['dark', 'midnight', 'terminal', 'violet', 'ember'])
  })

  it('every theme defines every accent colour, text colour and font', () => {
    for (const t of THEMES) {
      for (const a of ['amber', 'blue', 'green', 'red', 'ink', 'muted'] as const) {
        expect(t.accents[a], `${t.id} accent ${a}`).toMatch(/^#[0-9a-f]{6}$/i)
        expect(t.accentText[a], `${t.id} text ${a}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
      for (const f of [t.serif, t.sans, t.hand, t.mono, t.shiki]) expect(f.length).toBeGreaterThan(2)
    }
  })

  it('text is readable: body text 7:1, muted text 4.5:1, accent text 4.5:1, borders visible', () => {
    for (const t of THEMES) {
      expect(contrast(t.ink, t.bg), `${t.id} ink on bg`).toBeGreaterThanOrEqual(7)
      expect(contrast(t.ink, t.card), `${t.id} ink on card`).toBeGreaterThanOrEqual(7)
      expect(contrast(t.muted, t.bg), `${t.id} muted on bg`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.muted, t.card), `${t.id} muted on card`).toBeGreaterThanOrEqual(4.5)
      for (const a of ['amber', 'blue', 'green', 'red'] as const) {
        expect(contrast(t.accentText[a], t.bg), `${t.id} ${a} text on bg`).toBeGreaterThanOrEqual(4.5)
        // outlines on dark themes must be clearly visible; Sketch keeps the softer palette of the reference slides (its labels still pass above)
        if (t.dark) expect(contrast(t.accents[a], t.bg), `${t.id} ${a} stroke on bg`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('generates CSS variables for every theme; dark themes also get the grid', () => {
    const css = themeCss()
    for (const t of THEMES) { expect(css).toContain(`[data-theme='${t.id}']`); expect(css).toContain(`--bg:${t.bg};`) }
    expect(css.match(/background-size:40px 40px/g)).toHaveLength(DARK_THEME_IDS.length)
  })

  it('theme.css structural dark rules list every dark theme (so a new dark theme cannot be forgotten)', () => {
    const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8')
    const lists = css.match(/:is\(\[data-theme='dark'\][^)]*\)/g) ?? []
    expect(lists.length).toBeGreaterThan(3)
    for (const list of lists) for (const id of DARK_THEME_IDS) expect(list, id).toContain(`[data-theme='${id}']`)
  })

  it('every background has CSS (and a distinct id); "theme" is the default', () => {
    const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8')
    expect(BACKGROUND_IDS[0]).toBe('theme')
    expect(new Set(BACKGROUND_IDS).size).toBe(BACKGROUNDS.length)
    for (const id of BACKGROUND_IDS.filter((b) => b !== 'theme')) expect(css, id).toContain(`[data-bg][data-bg='${id}']`)
    expect(isBackgroundId('dots')).toBe(true); expect(isBackgroundId('stripes')).toBe(false)
    expect(themeCss()).toContain('.bg-preview[data-theme=')
  })
})
