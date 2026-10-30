import { autoReveal, layoutFlow } from './flow/layout'
import { defaultSize, type FlowNode } from './flow/types'
import { defaultElement } from './model/defaults'
import type { El, Slide } from './model/types'
import { layoutSchema } from './schema/layout'
import { parseSql } from './schema/sqlParse'

const uid = () => Math.random().toString(36).slice(2, 8)
const text = (t: string, y: number, reveal: number, size = 44, accent: 'ink' | 'blue' | 'green' | 'amber' = 'ink'): El =>
  ({ ...defaultElement('text', uid(), reveal), x: 140, y, w: 1320, h: 90, text: t, size, style: 'sans', accent, align: 'left' }) as El

const node = (id: string, label: string, shape: FlowNode['type'], icon: string | undefined, accent: FlowNode['data']['accent']): FlowNode =>
  ({ id, type: shape, position: { x: 0, y: 0 }, style: defaultSize(shape, label, !!icon), data: { label, ...(icon ? { icon } : {}), accent, reveal: 0 } })

export interface Template { id: string; label: string; description: string; build: () => Slide[] }

export const TEMPLATES: Template[] = [
  { id: 'architecture', label: 'Architecture diagram', description: 'Client → load balancer → servers → cache → database, revealed left to right',
    build: () => {
      const nodes = [node('client', 'Client', 'pill', 'Monitor', 'amber'), node('lb', 'Load balancer', 'box', 'Split', 'blue'), node('a1', 'App server 1', 'box', 'Server', 'blue'), node('a2', 'App server 2', 'box', 'Server', 'blue'), node('cache', 'Cache', 'box', 'Zap', 'amber'), node('db', 'Database', 'database', undefined, 'green')]
      const edges = [['client', 'lb'], ['lb', 'a1'], ['lb', 'a2'], ['a1', 'cache'], ['a2', 'cache'], ['cache', 'db']].map(([s, t], i) => ({ id: `e${i}`, source: s, target: t, data: { accent: 'ink' as const, reveal: 0 } }))
      return [{ id: uid(), layout: 'flow', title: 'How the pieces fit together', elements: [], flow: autoReveal(layoutFlow({ nodes, edges }, 'LR'), 'level', 'LR') }]
    } },
  { id: 'decision', label: 'Decision flowchart', description: 'A yes/no question with two outcomes',
    build: () => {
      const nodes = [node('s', 'Start', 'pill', undefined, 'amber'), node('q', 'Is it cached?', 'decision', undefined, 'amber'), node('y', 'Return it', 'box', undefined, 'green'), node('n', 'Ask the database', 'database', undefined, 'green'), node('e', 'Done', 'pill', undefined, 'amber')]
      const edges = [{ id: 'e0', source: 's', target: 'q' }, { id: 'e1', source: 'q', target: 'y', label: 'yes' }, { id: 'e2', source: 'q', target: 'n', label: 'no' }, { id: 'e3', source: 'y', target: 'e' }, { id: 'e4', source: 'n', target: 'e' }].map((e) => ({ ...e, data: { accent: 'ink' as const, reveal: 0 } }))
      return [{ id: uid(), layout: 'flow', title: 'A decision', elements: [], flow: autoReveal(layoutFlow({ nodes, edges }, 'LR'), 'level', 'LR') }]
    } },
  { id: 'compare', label: 'A vs B', description: 'Two columns of cards, appearing alternately',
    build: () => {
      const left = { ...defaultElement('cardList', uid(), 0), x: 100, y: 190, w: 640, h: 500, header: 'Option A', accent: 'muted', cards: [1, 3, 5].map((r, i) => ({ text: ['Simple', 'Cheap', 'Limited'][i], reveal: r })) } as El
      const right = { ...defaultElement('cardList', uid(), 0), x: 790, y: 190, w: 640, h: 500, header: 'Option B', accent: 'green', cards: [2, 4, 6].map((r, i) => ({ text: ['Flexible', 'Scales', 'More moving parts'][i], reveal: r })) } as El
      return [{ id: uid(), layout: 'content', title: 'A or B?', elements: [left, right, text('Pick based on what you need today.', 740, 7, 36)] }]
    } },
  { id: 'code', label: 'Code walkthrough', description: 'Code with a spotlight that moves line by line',
    build: () => [{ id: uid(), layout: 'content', title: 'Walking through the code', elements: [{ ...defaultElement('code', uid(), 0), x: 100, y: 190, w: 1400, h: 640, lang: 'typescript', size: 30, code: 'async function getUser(id: string) {\n  const cached = await cache.get(id)\n  if (cached) return cached\n\n  const user = await db.users.find(id)\n  await cache.set(id, user)\n  return user\n}', focus: [{ lines: '2-3', reveal: 1 }, { lines: '5', reveal: 2 }, { lines: '6-7', reveal: 3 }] } as El] }] },
  { id: 'request', label: 'Request flow', description: 'Who talks to whom, one message per click',
    build: () => [{ id: uid(), layout: 'content', title: 'What happens on a request', elements: [{ ...defaultElement('sequence', uid(), 0), x: 150, y: 200, w: 1300, h: 600, actors: ['Browser', 'Server', 'Database'], messages: [
      { from: 0, to: 1, text: 'GET /item/42', kind: 'request', reveal: 1 }, { from: 1, to: 2, text: 'SELECT item 42', kind: 'request', reveal: 2 }, { from: 2, to: 1, text: 'row', kind: 'response', reveal: 3 }, { from: 1, to: 0, text: '200 JSON', kind: 'response', reveal: 4 }] } as El] }] },
  { id: 'points', label: 'Three key points', description: 'Three statements, one per click',
    build: () => [{ id: uid(), layout: 'content', title: 'Three things to remember', elements: [text('1.  First idea', 260, 1), text('2.  Second idea', 400, 2, 44, 'blue'), text('3.  Third idea', 540, 3, 44, 'green')] }] },
  { id: 'intro', label: 'Section intro', description: 'Big title with a small label above it',
    build: () => [{ id: uid(), layout: 'section', title: 'New section', eyebrow: 'Part 1', elements: [] }] },
  { id: 'schema', label: 'Database schema', description: 'Users and orders tables that appear one by one',
    build: () => {
      const s = layoutSchema({ id: 'slide', name: 'Schema', dialect: 'postgres', ...parseSql('CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL); CREATE TABLE orders (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), total numeric(10,2)); CREATE TABLE order_items (order_id uuid REFERENCES orders(id), sku text, qty int, PRIMARY KEY (order_id, sku));').schema })
      return [{ id: uid(), layout: 'schema', title: 'The data model', elements: [], schema: { ...s, tables: s.tables.map((t, i) => ({ ...t, reveal: i + 1 })) } }]
    } },
]
