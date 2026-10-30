import { convertToExcalidrawElements, exportToSvg } from '@excalidraw/excalidraw'
import type { Scene, ThemeId } from '../model/types'
import { elementsAtStep, live, sceneSignature } from './reveal'

const ASPECT = 16 / 9
import { isDarkTheme } from '../model/themes'

/** Excalidraw background colour: dark themes use white because Excalidraw's dark mode inverts it to near-black. */
export const bgFor = (theme: ThemeId) => (isDarkTheme(theme) ? '#ffffff' : '#f9f7f3')

function bounds(elements: any[]) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const e of elements) {
    x1 = Math.min(x1, e.x, e.x + e.width); y1 = Math.min(y1, e.y, e.y + e.height)
    x2 = Math.max(x2, e.x, e.x + e.width); y2 = Math.max(y2, e.y, e.y + e.height)
  }
  return Number.isFinite(x1) ? { x1, y1, x2, y2 } : { x1: 0, y1: 0, x2: 1600, y2: 900 }
}

/** Invisible 16:9 rectangle around the whole scene so every step shares one viewBox. */
function frameAnchor(all: any[]) {
  const b = bounds(all)
  let w = (b.x2 - b.x1) * 1.12 + 40, h = (b.y2 - b.y1) * 1.12 + 40
  if (w / h < ASPECT) w = h * ASPECT; else h = w / ASPECT
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2
  return convertToExcalidrawElements([
    { type: 'rectangle', x: cx - w / 2, y: cy - h / 2, width: w, height: h, strokeColor: 'transparent', backgroundColor: 'transparent', roughness: 0 } as any,
  ])
}

const cache = new Map<string, Promise<string>>()

/** SVG markup of the scene with only the elements visible at `step`. */
export function renderStepSvg(scene: Scene, theme: ThemeId, step: number): Promise<string> {
  const key = `${theme}|${step}|${sceneSignature(live(scene.elements))}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const all = live(scene.elements)
      const svg = await exportToSvg({
        elements: [...frameAnchor(all), ...elementsAtStep(all, step)],
        // transparent export: the slide's own theme colour and background pattern show through
        appState: { exportBackground: false, viewBackgroundColor: bgFor(theme), exportWithDarkMode: isDarkTheme(theme) } as any,
        files: scene.files ?? {},
        exportPadding: 0,
      })
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', '100%')
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      return svg.outerHTML
    })()
    cache.set(key, p)
    if (cache.size > 300) cache.delete(cache.keys().next().value!)
  }
  return p
}
