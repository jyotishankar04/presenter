import { createContext, useContext } from 'react'
import { THEMES } from '../model/themes'
import type { Accent, ThemeId } from '../model/types'

export interface FlowCtx {
  theme: ThemeId
  /** Editor: handles visible, labels editable, resizable. */
  editable: boolean
  /** Editor: show the "appears on click N" badge on nodes. */
  badges: boolean
}

export const FlowContext = createContext<FlowCtx>({ theme: 'sketch', editable: false, badges: false })
export const useFlowCtx = () => useContext(FlowContext)

/** Literal colours (React Flow arrow markers can't use CSS variables), taken from the theme registry. */
export const ACCENT_HEX = Object.fromEntries(THEMES.map((t) => [t.id, t.accents])) as Record<ThemeId, Record<Accent, string>>
export const ACCENT_TEXT = Object.fromEntries(THEMES.map((t) => [t.id, t.accentText])) as Record<ThemeId, Record<Accent, string>>
export const BADGE_COLORS = ['#4a6cf7', '#d9930d', '#1f7a52', '#c2410c', '#9333ea', '#0891b2']
export const badgeColor = (n: number) => BADGE_COLORS[(n - 1) % BADGE_COLORS.length]
