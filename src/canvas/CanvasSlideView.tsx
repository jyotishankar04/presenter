import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { themeDef } from '../model/themes'
import type { Scene, ThemeId } from '../model/types'
import { useBackgroundAttr } from '../render/background'
import { renderStepSvg } from './render'

/** SVG for `step`; empty until that exact step has rendered. */
function useSvg(scene: Scene | undefined, theme: ThemeId, step: number) {
  const [res, setRes] = useState({ html: '', step: -1 })
  useEffect(() => {
    let live = true
    if (!scene) return
    renderStepSvg(scene, theme, step).then((html) => live && setRes({ html, step }))
    return () => { live = false }
  }, [scene, theme, step])
  return res.step === step ? res.html : ''
}

const bg = (t: ThemeId) => themeDef(t).bg
const layer: CSSProperties = { position: 'absolute', inset: 0 }

/** Stage-sized view of a canvas slide at a given click; new content fades in over the previous step. */
export function CanvasSlideView({ scene, theme, step, style }: { scene?: Scene; theme: ThemeId; step: number; style?: CSSProperties }) {
  const bgAttr = useBackgroundAttr()
  const cur = useSvg(scene, theme, step)
  const prev = useSvg(scene, theme, Math.max(0, step - 1))
  const lastStep = useRef(step)
  const forward = useRef(false)
  if (lastStep.current !== step) { forward.current = step > lastStep.current; lastStep.current = step }
  const [, force] = useState(0)
  useEffect(() => { force((n) => n + 1) }, [cur])

  return (
    <div className="stage" data-theme={theme} data-bg={bgAttr} style={{ backgroundColor: bg(theme), ...style }}>
      {forward.current && step > 0 && <div style={layer} dangerouslySetInnerHTML={{ __html: prev }} />}
      <div key={`${step}-${cur ? 1 : 0}`} className={forward.current ? 'canvas-fade' : ''} style={layer} dangerouslySetInnerHTML={{ __html: cur }} />
    </div>
  )
}
