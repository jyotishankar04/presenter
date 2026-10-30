import type { CSSProperties } from 'react'
import { RoughLine } from './rough'
import { useBackgroundAttr } from './background'
import { Ed, ElementView, type EditCtx } from './ElementView'
import type { Slide, ThemeId } from '../model/types'

export function SlideView({ slide, step, theme, style, edit, ghost }: { slide: Slide; step: number; theme: ThemeId; style?: CSSProperties; edit?: EditCtx; ghost?: boolean }) {
  const field = (f: 'title' | 'eyebrow', v: string) => (edit ? <Ed always active value={v} on={(x) => edit.slideField(f, x)} stop={() => {}} /> : v)
  const section = slide.layout === 'section'
  const bgAttr = useBackgroundAttr()
  return (
    <div className={`stage${ghost ? ' ghost' : ''}`} data-theme={theme} data-bg={bgAttr} style={style}>
      {section ? (
        <div className="section">
          {(slide.eyebrow || edit) && <div className="eyebrow">{field('eyebrow', slide.eyebrow ?? '')}</div>}
          <h1>{field('title', slide.title ?? '')}</h1>
          {theme === 'sketch' && (
            <svg className="scribble" width={760} height={40} style={{ overflow: 'visible' }}>
              <RoughLine id={slide.id + 'a'} x1={4} y1={14} x2={720} y2={14} color="var(--blue)" width={6} />
              <RoughLine id={slide.id + 'b'} x1={30} y1={24} x2={470} y2={26} color="var(--mint)" width={4} />
            </svg>
          )}
        </div>
      ) : (
        (slide.title || edit) && <h1 className="title">{field('title', slide.title ?? '')}</h1>
      )}
      {slide.elements.map((el) => (
        <ElementView key={el.id} el={el} slide={slide} step={step} theme={theme} edit={edit} />
      ))}
    </div>
  )
}
