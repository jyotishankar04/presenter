import type { ThemeId as RegistryThemeId } from './themes'
export type ThemeId = RegistryThemeId
export type Accent = 'amber' | 'blue' | 'green' | 'red' | 'ink' | 'muted'

export const STAGE_W = 1600
export const STAGE_H = 900

interface Base {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Click number at which this element appears. 0 = visible immediately. */
  reveal: number
}

export interface TextEl extends Base {
  type: 'text'
  text: string
  size: number
  style: 'serif' | 'sans' | 'mono' | 'hand'
  accent: Accent
  align: 'left' | 'center'
}

export interface BoxEl extends Base {
  type: 'box'
  label: string
  icon?: string
  accent: Accent
  /** Draw as a faint "detail" box (e.g. the grey tool boxes). */
  muted?: boolean
}

export interface ArrowEl extends Base {
  type: 'arrow'
  from: string
  to: string
  accent: Accent
  /** Optional label rendered mid-arrow. */
  label?: string
}

export interface Card {
  text: string
  reveal: number
}
export interface CardListEl extends Base {
  type: 'cardList'
  header: string
  accent: Accent
  cards: Card[]
}

export interface SeqMessage {
  from: number
  to: number
  text: string
  reveal: number
  /** return/response arrows are drawn green, requests blue */
  kind: 'request' | 'response'
}
export interface SequenceEl extends Base {
  type: 'sequence'
  actors: string[]
  messages: SeqMessage[]
}

export interface ImageEl extends Base {
  type: 'image'
  src: string
}

export interface DemoEl extends Base {
  type: 'demo'
  demo: string
}

export interface StrikeEl extends Base {
  type: 'strike'
  wrong: string
  right: string
}

export interface MermaidEl extends Base {
  type: 'mermaid'
  code: string
}

export interface CodeFocus {
  /** e.g. "2-4,7" (1-based). From this click on, other lines are dimmed. */
  lines: string
  reveal: number
}
export interface CodeEl extends Base {
  type: 'code'
  code: string
  lang: string
  size: number
  focus: CodeFocus[]
}

export type El = TextEl | BoxEl | ArrowEl | CardListEl | SequenceEl | ImageEl | DemoEl | StrikeEl | MermaidEl | CodeEl
export type ElType = El['type']

/** An Excalidraw scene. Each element's customData.reveal is the click it appears on. */
export interface Scene {
  elements: any[]
  files: Record<string, any>
}

export interface Slide {
  id: string
  title?: string
  /** A sub-slide: shown indented under (and presented right after) the slide above it. */
  sub?: boolean
  /** Speaker notes: private reminders shown in the presenter (press S), never on the recorded slide. */
  notes?: string
  /** 'canvas' = freehand Excalidraw scene, 'flow' = React Flow diagram; content/section are fixed layouts. */
  layout: 'canvas' | 'flow' | 'schema' | 'content' | 'section'
  scene?: Scene
  /** Nodes and edges of a 'flow' slide. */
  flow?: import('../flow/types').FlowData
  /** Tables and relationships of a 'schema' slide (a snapshot; each table has its own reveal step). */
  schema?: import('../schema/types').Schema
  eyebrow?: string
  elements: El[]
}

export interface Deck {
  id: string
  title: string
  theme: ThemeId
  /** Subtle slide background pattern; omitted or "theme" = the theme's own default. */
  background?: import('./themes').BackgroundId
  slides: Slide[]
}
