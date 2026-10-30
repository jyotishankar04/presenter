import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Eye, GitBranch, MousePointerClick, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CanvasSlideView } from '../canvas/CanvasSlideView'
import { bgFor } from '../canvas/render'
import { getReveal, live, sceneSignature, sceneSteps, setReveal } from '../canvas/reveal'
import { STAGE_H, STAGE_W, type Scene, type ThemeId } from '../model/types'
import { announce } from '@/lib/announce'
import { isDarkTheme } from '../model/themes'
import { MermaidDialog } from './MermaidDialog'
import { useStore } from './store'

const STEP_COLORS = ['#4a6cf7', '#d9930d', '#1f7a52', '#c2410c', '#9333ea', '#0891b2']
const stepColor = (n: number) => STEP_COLORS[(n - 1) % STEP_COLORS.length]

interface View { sx: number; sy: number; zoom: number; sel: string[] }

export function CanvasEditor({ slideIdx, scene, theme }: { slideIdx: number; scene?: Scene; theme: ThemeId }) {
  const setScene = useStore((s) => s.setScene)
  const [api, setApi] = useState<any>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [orderMode, setOrderMode] = useState(false)
  const [mermaidOpen, setMermaidOpen] = useState(false)
  const [elements, setElements] = useState<any[]>(() => live(scene?.elements ?? []))
  const [view, setView] = useState<View>({ sx: 0, sy: 0, zoom: 1, sel: [] })
  const [previewStep, setPreviewStep] = useState(0)
  const [nextOrder, setNextOrder] = useState(1)

  const initial = useRef(scene)
  const lastSig = useRef(sceneSignature(live(scene?.elements ?? [])))
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const orderRef = useRef(false); orderRef.current = orderMode
  const nextRef = useRef(1); nextRef.current = nextOrder
  const lastSelKey = useRef('')

  const steps = useMemo(() => sceneSteps({ elements, files: {} }), [elements])

  const assign = useCallback((ids: string[], n: number) => {
    if (!api || !ids.length) return
    api.updateScene({
      elements: setReveal(api.getSceneElementsIncludingDeleted(), new Set(ids), n),
      captureUpdate: 'IMMEDIATELY',
    })
  }, [api])

  const onChange = useCallback((els: readonly any[], app: any, files: any) => {
    const sel = Object.keys(app.selectedElementIds ?? {})
    setView((v) => (v.sx === app.scrollX && v.sy === app.scrollY && v.zoom === app.zoom.value && v.sel.join() === sel.join() ? v : { sx: app.scrollX, sy: app.scrollY, zoom: app.zoom.value, sel }))

    const alive = live(els as any[])
    const sig = sceneSignature(alive)
    if (sig !== lastSig.current) {
      lastSig.current = sig
      setElements(alive)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const used = new Set(alive.filter((e) => e.type === 'image').map((e) => e.fileId))
        setScene(slideIdx, { elements: alive, files: Object.fromEntries(Object.entries(files ?? {}).filter(([id]) => used.has(id))) })
      }, 300)
    }

    // click-order mode: every element you click gets the next step
    const key = sel.join()
    if (orderRef.current && key && key !== lastSelKey.current) {
      const n = nextRef.current
      setNextOrder(n + 1)
      setTimeout(() => { assign(sel, n); api?.updateScene({ appState: { selectedElementIds: {} } }) }, 0)
    }
    lastSelKey.current = key
  }, [api, assign, setScene, slideIdx])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  // fit the existing drawing in view when a slide opens
  useEffect(() => {
    if (!api) return
    const t = setTimeout(() => {
      const els = api.getSceneElements()
      if (els.length) api.scrollToContent(els, { fitToViewport: true, viewportZoomFactor: 0.88, animate: false })
    }, 80)
    return () => clearTimeout(t)
  }, [api])

  // keep canvas background in step with the deck theme
  useEffect(() => { api?.updateScene({ appState: { viewBackgroundColor: bgFor(theme) } }) }, [api, theme])

  const startOrder = () => { setNextOrder(steps + 1); setOrderMode(true); api?.updateScene({ appState: { selectedElementIds: {} } }) }

  // selection -> which chip is active
  const selected = elements.filter((e) => view.sel.includes(e.id) && !e.containerId)
  const selSteps = new Set(selected.map(getReveal))
  const activeStep = selected.length && selSteps.size === 1 ? [...selSteps][0] : null
  const chips = Array.from({ length: steps + 2 }, (_, i) => i)

  // canvas-slide shortcuts: Alt+0..9 = reveal step, Alt+O = click-order, Alt+P = edit/preview
  const kb = useRef({ assign, view, startOrder, orderMode })
  kb.current = { assign, view, startOrder, orderMode }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const K = kb.current
      if (/^Digit[0-9]$/.test(e.code)) {
        const ids = K.view.sel
        if (!ids.length) return
        e.preventDefault(); const n = Number(e.code.slice(5)); K.assign(ids, n); announce(`Selection appears on click ${n}`)
      } else if (e.code === 'KeyO') { e.preventDefault(); if (K.orderMode) setOrderMode(false); else K.startOrder() }
      else if (e.code === 'KeyP') { e.preventDefault(); setOrderMode(false); setPreviewStep(0); setMode((m) => (m === 'edit' ? 'preview' : 'edit')) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // preview keyboard
  useEffect(() => {
    if (mode !== 'preview') return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setPreviewStep((s) => Math.min(steps, s + 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPreviewStep((s) => Math.max(0, s - 1)) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [mode, steps])

  return (
    <div id="editor-canvas" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <div className="relative min-h-0 flex-1">
        {mode === 'edit' ? (
          <>
            <Excalidraw
              excalidrawAPI={setApi}
              onChange={onChange}
              theme={isDarkTheme(theme) ? 'dark' : 'light'}
              initialData={{
                elements: initial.current?.elements ?? [],
                files: initial.current?.files ?? {},
                appState: { viewBackgroundColor: bgFor(theme) },
              }}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
            />
            {/* step badges */}
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              {elements.filter((e) => !e.containerId && getReveal(e) > 0).map((e) => (
                <div key={e.id} style={{ left: (Math.min(e.x, e.x + e.width) + view.sx) * view.zoom - 11, top: (Math.min(e.y, e.y + e.height) + view.sy) * view.zoom - 11, background: stepColor(getReveal(e)) }}
                  className="absolute flex size-[22px] items-center justify-center rounded-full text-xs font-bold text-white shadow ring-2 ring-white">
                  {getReveal(e)}
                </div>
              ))}
            </div>
            <div className="absolute bottom-3 right-3 z-10">
              <Button size="sm" variant="secondary" onClick={() => setMermaidOpen(true)}><GitBranch /> Mermaid</Button>
            </div>
          </>
        ) : (
          <Preview scene={{ elements, files: scene?.files ?? {} }} theme={theme} step={previewStep} />
        )}
      </div>

      {/* reveal bar */}
      <div className="flex flex-wrap items-center gap-2 border-t bg-background px-3 py-2">
        <div className="flex rounded-md border p-0.5">
          <Button size="sm" variant={mode === 'edit' ? 'default' : 'ghost'} onClick={() => { setMode('edit'); setOrderMode(false) }}><Pencil /> Edit</Button>
          <Button size="sm" variant={mode === 'preview' ? 'default' : 'ghost'} onClick={() => { setMode('preview'); setOrderMode(false); setPreviewStep(0) }}><Eye /> Preview</Button>
        </div>

        {mode === 'edit' ? (
          <>
            <span className="ml-2 text-xs text-muted-foreground">
              {orderMode ? <>Click shapes in the order they should appear · <b>next is {nextOrder}</b></> : selected.length ? <>Show {selected.length} selected on click:</> : <>Select shapes, then pick the click they appear on:</>}
            </span>
            {!orderMode && chips.map((n) => (
              <Button key={n} size="sm" disabled={!selected.length} variant={activeStep === n ? 'default' : 'outline'}
                style={n > 0 && activeStep !== n ? { borderColor: stepColor(n), color: stepColor(n) } : undefined}
                onClick={() => assign(selected.map((e) => e.id), n)}>{n === 0 ? 'Always' : n}</Button>
            ))}
            {!orderMode && <Button size="sm" variant="secondary" disabled={!selected.length} title="Move the selected items to a brand-new next step" onClick={() => assign(selected.map((e) => e.id), steps + 1)}><Plus /> Add step</Button>}
            <div className="ml-auto">
              {orderMode
                ? <Button size="sm" variant="secondary" onClick={() => setOrderMode(false)}>Done ordering</Button>
                : <Button size="sm" variant="outline" onClick={startOrder}><MousePointerClick /> Click-order</Button>}
            </div>
          </>
        ) : (
          <>
            <span className="ml-2 text-xs text-muted-foreground">Click:</span>
            {Array.from({ length: steps + 1 }, (_, n) => (
              <Button key={n} size="sm" variant={previewStep === n ? 'default' : 'outline'} onClick={() => setPreviewStep(n)}>{n}</Button>
            ))}
            <span className="text-xs text-muted-foreground">← → to step</span>
          </>
        )}
      </div>
      <MermaidDialog api={api} open={mermaidOpen} onClose={() => setMermaidOpen(false)} />
    </div>
  )
}

function Preview({ scene, theme, step }: { scene: Scene; theme: ThemeId; step: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setScale(Math.min((e.contentRect.width - 32) / STAGE_W, (e.contentRect.height - 32) / STAGE_H)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex h-full items-center justify-center bg-muted/40">
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, boxShadow: '0 1px 8px #0003' }}>
        <CanvasSlideView scene={scene} theme={theme} step={step} style={{ transform: `scale(${scale})` }} />
      </div>
    </div>
  )
}
