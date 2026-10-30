import { createContext, useContext } from 'react'
import type { BackgroundId } from '../model/themes'

/** The deck's background choice, so every slide view (presenter, thumbnails, diagram canvases) draws the same pattern. */
export const BackgroundContext = createContext<BackgroundId | undefined>(undefined)

/** Value for a stage's data-bg attribute; undefined means "use the theme's default". */
export function useBackgroundAttr(): string | undefined {
  const bg = useContext(BackgroundContext)
  return bg && bg !== 'theme' ? bg : undefined
}
