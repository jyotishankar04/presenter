import { createContext, useContext } from 'react'
import type { ThemeId } from '../model/types'

export interface SchemaCtx {
  theme: ThemeId
  editable: boolean
  /** Editor (slide mode): show "appears on click N" badges. */
  badges: boolean
  /** "tableId:columnId" of columns that are foreign keys. */
  fkCols: Set<string>
  selectedColumn: { table: string; column: string } | null
  onSelectColumn?: (table: string, column: string) => void
  onAddColumn?: (table: string) => void
}
export const SchemaContext = createContext<SchemaCtx>({ theme: 'dark', editable: false, badges: false, fkCols: new Set(), selectedColumn: null })
export const useSchemaCtx = () => useContext(SchemaContext)
