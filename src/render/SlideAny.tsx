import type { CSSProperties } from 'react'
import { CanvasSlideView } from '../canvas/CanvasSlideView'
import { FlowSlideView } from '../flow/FlowSlideView'
import type { Slide, ThemeId } from '../model/types'
import { SchemaSlideView } from '../schema/SchemaSlideView'
import { SlideView } from './Stage'

/** Renders any slide kind (read-only) at a given click: used by the presenter and the thumbnails. */
export function SlideAny({ slide, step, theme, style }: { slide: Slide; step: number; theme: ThemeId; style?: CSSProperties }) {
  if (slide.layout === 'canvas') return <CanvasSlideView scene={slide.scene} theme={theme} step={step} style={style} />
  if (slide.layout === 'flow') return <FlowSlideView flow={slide.flow} title={slide.title} theme={theme} step={step} style={style} />
  if (slide.layout === 'schema') return <SchemaSlideView schema={slide.schema} title={slide.title} theme={theme} step={step} style={style} />
  return <SlideView slide={slide} step={step} theme={theme} style={style} />
}
