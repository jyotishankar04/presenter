import type { Accent } from '../model/types'

export type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'generic'
export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'sqlite', label: 'SQLite' }, { value: 'generic', label: 'Generic SQL' },
]

export interface Column {
  id: string
  name: string
  /** Free text as written in SQL, e.g. "varchar(255)", "timestamp with time zone". */
  type: string
  pk?: boolean
  /** NOT NULL. Primary keys are implicitly not null. */
  notNull?: boolean
  unique?: boolean
  autoIncrement?: boolean
  default?: string
  comment?: string
}

export interface TableIndex {
  id: string
  name: string
  /** Column ids, in order. */
  columns: string[]
  unique?: boolean
}

export type EdgeStyle = 'step' | 'curve' | 'straight'

export interface Table {
  id: string
  name: string
  x: number
  y: number
  color?: Accent
  comment?: string
  /** Schema slides: the click on which this table appears. */
  reveal?: number
  columns: Column[]
  indexes?: TableIndex[]
}

/** Read "N:1" as: many rows of `from` point at one row of `to` (a normal foreign key). */
export type RelKind = '1:1' | '1:N' | 'N:1'
export type RefAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT'

export interface Relationship {
  id: string
  from: { table: string; column: string }
  to: { table: string; column: string }
  kind: RelKind
  name?: string
  onDelete?: RefAction
  onUpdate?: RefAction
}

export interface Schema {
  id: string
  name: string
  dialect: Dialect
  tables: Table[]
  relationships: Relationship[]
  /** How relationship lines are drawn (default: elbow). */
  edgeStyle?: EdgeStyle
}

export const TABLE_W = 280
export const HEADER_H = 44
export const ROW_H = 30
export const tableHeight = (t: Table) => HEADER_H + Math.max(1, t.columns.length) * ROW_H + 8

let counter = 0
export const sid = () => Math.random().toString(36).slice(2, 8) + (counter++ % 36).toString(36)

export const emptySchema = (id: string, name = 'Untitled schema', dialect: Dialect = 'postgres'): Schema => ({ id, name, dialect, tables: [], relationships: [] })

export function newColumn(name = 'column', type = 'text'): Column { return { id: sid(), name, type } }
export function newTable(name = 'new_table', x = 0, y = 0): Table {
  return { id: sid(), name, x, y, columns: [{ id: sid(), name: 'id', type: 'uuid', pk: true, notNull: true }] }
}

export const findTable = (s: Schema, ref: string) => s.tables.find((t) => t.id === ref || t.name.toLowerCase() === ref.toLowerCase())
export const findColumn = (t: Table, ref: string) => t.columns.find((c) => c.id === ref || c.name.toLowerCase() === ref.toLowerCase())
