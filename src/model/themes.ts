import type { Accent } from './types'

/** One place that defines every deck theme. CSS variables, diagram colours and code colours are all derived from it. */
export interface ThemeDef {
  id: string
  label: string
  description: string
  dark: boolean
  bg: string; ink: string; muted: string; faint: string; card: string; cardline: string
  /** Faint grid lines drawn on the slide background (dark themes). */
  grid?: string
  /** Literal accent colours (strokes, arrowheads). */
  accents: Record<Accent, string>
  /** Readable text colours for each accent. */
  accentText: Record<Accent, string>
  mint: string
  /** Font stacks. */
  serif: string; sans: string; hand: string; mono: string
  /** Shiki theme for code blocks. */
  shiki: string
}

const INTER = 'Inter, system-ui, sans-serif'
const MONO = "'JetBrains Mono', monospace"

export const THEMES = [
  { id: 'sketch', label: 'Sketch', description: 'Warm cream paper, hand-drawn boxes', dark: false,
    bg: '#f9f7f3', ink: '#2a2622', muted: '#6f6558', faint: '#b8b0a3', card: '#ffffff', cardline: '#e6e1d6',
    accents: { amber: '#d9930d', blue: '#4a6cf7', green: '#1f7a52', red: '#ef5b3f', ink: '#2a2622', muted: '#b8b0a3' },
    accentText: { amber: '#6b4400', blue: '#1e2a8a', green: '#1f7a52', red: '#c2371d', ink: '#2a2622', muted: '#6f6558' },
    mint: '#4fd6a8', serif: "'Source Serif 4', Georgia, serif", sans: INTER, hand: 'Caveat, cursive', mono: MONO, shiki: 'github-light' },
  { id: 'dark', label: 'Dark', description: 'Neutral near-black, technical', dark: true,
    bg: '#0b0b0c', ink: '#f2f2f3', muted: '#9a9aa2', faint: '#55555c', card: '#141416', cardline: '#2c2c31', grid: '#ffffff08',
    accents: { amber: '#e0a43a', blue: '#5b7bff', green: '#4fbf6f', red: '#ff6a55', ink: '#f2f2f3', muted: '#6b6b73' },
    accentText: { amber: '#f0c97a', blue: '#aebcff', green: '#7fdc9a', red: '#ff9a8a', ink: '#f2f2f3', muted: '#9a9aa2' },
    mint: '#4fbf6f', serif: INTER, sans: INTER, hand: MONO, mono: MONO, shiki: 'github-dark' },
  { id: 'midnight', label: 'Midnight', description: 'Deep navy with cool blue accents', dark: true,
    bg: '#0a1020', ink: '#e6eeff', muted: '#8fa3c8', faint: '#34476b', card: '#101a33', cardline: '#213158', grid: '#5aa2ff0d',
    accents: { amber: '#f2b84b', blue: '#5aa2ff', green: '#35d6a0', red: '#ff6b86', ink: '#e6eeff', muted: '#5c6f96' },
    accentText: { amber: '#ffd98f', blue: '#b9d6ff', green: '#8ef0cc', red: '#ffadbd', ink: '#e6eeff', muted: '#8fa3c8' },
    mint: '#35d6a0', serif: INTER, sans: INTER, hand: MONO, mono: MONO, shiki: 'tokyo-night' },
  { id: 'terminal', label: 'Terminal', description: 'Green phosphor, everything monospace', dark: true,
    bg: '#030a05', ink: '#c9f7d4', muted: '#6faa7e', faint: '#25502f', card: '#07140b', cardline: '#153c20', grid: '#3dff8b0c',
    accents: { amber: '#ffd24a', blue: '#38d4e8', green: '#3dff8b', red: '#ff5f6d', ink: '#c9f7d4', muted: '#3d7a4c' },
    accentText: { amber: '#ffe58f', blue: '#9cecf6', green: '#8dffb9', red: '#ff9ea7', ink: '#c9f7d4', muted: '#6faa7e' },
    mint: '#3dff8b', serif: MONO, sans: MONO, hand: MONO, mono: MONO, shiki: 'vitesse-black' },
  { id: 'violet', label: 'Violet', description: 'Purple dusk with soft neon accents', dark: true,
    bg: '#120d1f', ink: '#f3eeff', muted: '#a99bd0', faint: '#43366a', card: '#1b1430', cardline: '#32265a', grid: '#bd93f90c',
    accents: { amber: '#ffb86c', blue: '#bd93f9', green: '#50fa7b', red: '#ff5c7c', ink: '#f3eeff', muted: '#6d5f99' },
    accentText: { amber: '#ffd7a8', blue: '#dcc5ff', green: '#a2fdbb', red: '#ffa3b6', ink: '#f3eeff', muted: '#a99bd0' },
    mint: '#50fa7b', serif: INTER, sans: INTER, hand: MONO, mono: MONO, shiki: 'dracula' },
  { id: 'ember', label: 'Ember', description: 'Warm charcoal with orange glow', dark: true,
    bg: '#150f0b', ink: '#f7ece1', muted: '#b9a18d', faint: '#55402f', card: '#201710', cardline: '#3a2a1d', grid: '#ff9f430b',
    accents: { amber: '#ff9f43', blue: '#5ec4d6', green: '#8bd17c', red: '#ff6b5b', ink: '#f7ece1', muted: '#7b624c' },
    accentText: { amber: '#ffc78f', blue: '#a5e2ec', green: '#bde8b3', red: '#ffaa9f', ink: '#f7ece1', muted: '#b9a18d' },
    mint: '#8bd17c', serif: INTER, sans: INTER, hand: MONO, mono: MONO, shiki: 'ayu-dark' },
] as const satisfies readonly ThemeDef[]

export type ThemeId = (typeof THEMES)[number]['id']
export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[]
export const DEFAULT_THEME: ThemeId = 'sketch'

const BY_ID = new Map<string, ThemeDef>(THEMES.map((t) => [t.id, t]))
/** Unknown or missing ids fall back to the neutral dark theme (older decks used only "sketch" and "dark"). */
export const themeDef = (id: string | undefined): ThemeDef => BY_ID.get(id ?? '') ?? BY_ID.get('dark')!
export const isDarkTheme = (id: string | undefined) => themeDef(id).dark
export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && BY_ID.has(v)
export const DARK_THEME_IDS = THEMES.filter((t) => t.dark).map((t) => t.id)

/** Slide backgrounds: subtle patterns drawn from the theme's own colours, so they suit every theme. */
export const BACKGROUNDS = [
  { id: 'theme', label: 'Theme default', description: 'Fine grid on dark themes, plain on Sketch' },
  { id: 'none', label: 'Plain', description: 'Solid colour, nothing else' },
  { id: 'grid', label: 'Fine grid', description: 'Faint square grid' },
  { id: 'dots', label: 'Dot grid', description: 'Soft dots, like a bullet journal' },
  { id: 'lines', label: 'Ruled lines', description: 'Faint notebook lines' },
  { id: 'graph', label: 'Graph paper', description: 'Small squares with stronger big ones' },
  { id: 'glow', label: 'Soft glow', description: 'A gentle colour wash in two corners' },
  { id: 'gradient', label: 'Gentle gradient', description: 'Slow diagonal blend of the accents' },
  { id: 'grain', label: 'Paper grain', description: 'Very fine film grain' },
] as const
export type BackgroundId = (typeof BACKGROUNDS)[number]['id']
export const BACKGROUND_IDS = BACKGROUNDS.map((b) => b.id) as BackgroundId[]
export const isBackgroundId = (v: unknown): v is BackgroundId => typeof v === 'string' && (BACKGROUND_IDS as string[]).includes(v)

/** CSS custom properties for every theme, for slides (.stage) and diagram canvases (.flow-theme). */
export function themeCss(): string {
  return THEMES.map((t: ThemeDef) => {
    const sel = `.stage[data-theme='${t.id}'], .flow-theme[data-theme='${t.id}'], .bg-preview[data-theme='${t.id}']`
    const vars = [
      ['bg', t.bg], ['ink', t.ink], ['muted', t.muted], ['faint', t.faint], ['card', t.card], ['cardline', t.cardline],
      ['amber', t.accents.amber], ['amber-ink', t.accentText.amber], ['blue', t.accents.blue], ['blue-ink', t.accentText.blue],
      ['green', t.accents.green], ['green-ink', t.accentText.green], ['red', t.accents.red], ['mint', t.mint],
      ['serif', t.serif], ['sans', t.sans], ['hand', t.hand], ['mono', t.mono], ['rough', t.dark ? '0' : '1'],
    ].map(([k, v]) => `--${k}:${v};`).join('')
    const grid = t.grid ? `${sel}{background-image:linear-gradient(${t.grid} 1px,transparent 1px),linear-gradient(90deg,${t.grid} 1px,transparent 1px);background-size:40px 40px;}` : ''
    return `${sel}{${vars}}${grid}`
  }).join('\n')
}

/** Adds the generated theme variables to the page once. */
export function installThemeCss() {
  if (typeof document === 'undefined' || document.getElementById('theme-vars')) return
  const el = document.createElement('style')
  el.id = 'theme-vars'
  el.textContent = themeCss()
  document.head.prepend(el)
}
