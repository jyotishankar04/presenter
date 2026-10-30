import { create } from 'zustand'
import type { FlowData } from '../flow/types'
import type { Schema } from '../schema/types'
import type { Deck, El, ElType, Scene, Slide } from '../model/types'
import { defaultElement } from '../model/defaults'
import { totalSteps } from '../model/reveal'

const uid = () => Math.random().toString(36).slice(2, 9)

interface State {
  deck: Deck | null
  slideIdx: number
  selected: string | null
  /** All selected element ids (selected = the most recent one). */
  selectedIds: string[]
  /** Selected slide indices in the slide list (slideIdx is the one being edited). */
  slideSel: number[]
  step: number
  past: Deck[]
  future: Deck[]
  dirty: boolean
  load: (d: Deck) => void
  /** Apply a change as one undoable step. */
  commit: (fn: (d: Deck) => void) => void
  /** Apply a change without pushing history (used while dragging). */
  live: (fn: (d: Deck) => void) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  setSlide: (i: number) => void
  select: (id: string | null) => void
  selectMany: (ids: string[]) => void
  toggleSelect: (id: string) => void
  setSlideSel: (idx: number[]) => void
  setStep: (n: number) => void
  markSaved: () => void
  /** Swap in a deck that changed outside the editor, keeping the current slide where possible. */
  replaceDeck: (deck: Deck) => void
  /** Replace one slide's Excalidraw scene without cloning the deck or touching undo history. */
  setScene: (slideIdx: number, scene: Scene) => void
  /** Same for a flow slide's nodes and edges. */
  setFlow: (slideIdx: number, flow: FlowData) => void
  /** Same for a schema slide's tables and relationships. */
  setSlideSchema: (slideIdx: number, schema: Schema) => void
}

const clone = <T,>(v: T): T => structuredClone(v)

export const useStore = create<State>((set, get) => ({
  deck: null, slideIdx: 0, selected: null, selectedIds: [], slideSel: [0], step: 0, past: [], future: [], dirty: false,
  load: (deck) => set({ deck, slideIdx: 0, selected: null, selectedIds: [], slideSel: [0], step: 0, past: [], future: [], dirty: false }),
  checkpoint: () => { const d = get().deck; if (d) set((s) => ({ past: [...s.past.slice(-99), clone(d)], future: [] })) },
  commit: (fn) => {
    const d = get().deck; if (!d) return
    const next = clone(d); fn(next)
    set((s) => ({ deck: next, past: [...s.past.slice(-99), clone(d)], future: [], dirty: true }))
  },
  live: (fn) => {
    const d = get().deck; if (!d) return
    const next = clone(d); fn(next); set({ deck: next, dirty: true })
  },
  undo: () => set((s) => {
    if (!s.past.length || !s.deck) return s
    const prev = s.past[s.past.length - 1]
    return { deck: prev, past: s.past.slice(0, -1), future: [clone(s.deck), ...s.future], dirty: true, slideIdx: Math.min(s.slideIdx, prev.slides.length - 1) }
  }),
  redo: () => set((s) => {
    if (!s.future.length || !s.deck) return s
    const nx = s.future[0]
    return { deck: nx, future: s.future.slice(1), past: [...s.past, clone(s.deck)], dirty: true, slideIdx: Math.min(s.slideIdx, nx.slides.length - 1) }
  }),
  setSlide: (i) => set({ slideIdx: i, selected: null, selectedIds: [], slideSel: [i], step: 0 }),
  select: (id) => set({ selected: id, selectedIds: id ? [id] : [] }),
  selectMany: (ids) => set({ selected: ids.length ? ids[ids.length - 1] : null, selectedIds: ids }),
  toggleSelect: (id) => set((s) => {
    const ids = s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]
    return { selectedIds: ids, selected: ids.length ? ids[ids.length - 1] : null }
  }),
  setSlideSel: (idx) => set({ slideSel: idx }),
  setStep: (n) => set({ step: n }),
  markSaved: () => set({ dirty: false }),
  replaceDeck: (deck) => set((s) => {
    const slideIdx = Math.min(s.slideIdx, deck.slides.length - 1)
    const ids = new Set(deck.slides[slideIdx].elements.map((e) => e.id))
    const selectedIds = s.selectedIds.filter((id) => ids.has(id))
    return { deck, slideIdx, slideSel: [slideIdx], selectedIds, selected: selectedIds.at(-1) ?? null, past: [], future: [], dirty: false }
  }),
  setSlideSchema: (slideIdx, schema) => set((s) => {
    if (!s.deck) return s
    const slides = s.deck.slides.map((sl, i) => (i === slideIdx ? { ...sl, schema } : sl))
    return { deck: { ...s.deck, slides }, dirty: true }
  }),
  setFlow: (slideIdx, flow) => set((s) => {
    if (!s.deck) return s
    const slides = s.deck.slides.map((sl, i) => (i === slideIdx ? { ...sl, flow } : sl))
    return { deck: { ...s.deck, slides }, dirty: true }
  }),
  setScene: (slideIdx, scene) => set((s) => {
    if (!s.deck) return s
    const slides = s.deck.slides.map((sl, i) => (i === slideIdx ? { ...sl, scene } : sl))
    return { deck: { ...s.deck, slides }, dirty: true }
  }),
}))

export const currentSlide = (s: Pick<State, 'deck' | 'slideIdx'>): Slide | undefined => s.deck?.slides[s.slideIdx]
export const maxStep = (slide?: Slide) => (slide ? totalSteps(slide) : 0)

/** Factory for newly-added elements from the palette: appears on the next click after everything else. */
export function makeElement(type: ElType, slide: Slide): El {
  return defaultElement(type, uid(), Math.min(totalSteps(slide) + 1, 99))
}
export { uid }
