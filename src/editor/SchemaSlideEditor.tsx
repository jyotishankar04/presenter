import { useEffect, useState } from 'react'
import { Database } from 'lucide-react'
import { schemaApi, type SchemaInfo } from '../api'
import type { Slide, ThemeId } from '../model/types'
import { emptySchema, type Schema } from '../schema/types'
import { SchemaEditor } from '../schema/SchemaEditor'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { announce } from '@/lib/announce'
import { useStore } from './store'

/** Slide editor for a 'schema' slide: the same designer as the Schemas page, plus per-table reveal steps. */
export function SchemaSlideEditor({ slideIdx, slide, theme }: { slideIdx: number; slide: Slide; theme: ThemeId }) {
  const setSchema = useStore((s) => s.setSlideSchema)
  const commit = useStore((s) => s.commit)
  const [saved, setSaved] = useState<SchemaInfo[]>([])
  useEffect(() => { schemaApi.list().then(setSaved).catch(() => setSaved([])) }, [])
  const schema = slide.schema ?? emptySchema('slide', 'Schema')

  const useSaved = async (id: string) => {
    const s = await schemaApi.get(id)
    const copy: Schema = { ...structuredClone(s), id: 'slide', tables: s.tables.map((t, i) => ({ ...structuredClone(t), reveal: i + 1 })) }
    setSchema(slideIdx, copy); announce(`Copied “${s.name}” into this slide`)
  }

  return (
    <SchemaEditor
      schema={schema} onChange={(s) => setSchema(slideIdx, s)} theme={theme} mode="slide"
      title={slide.title} onTitle={(t) => commit((d) => { d.slides[slideIdx].title = t })}
      toolbarExtra={(
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}><Database /> From saved schema</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuGroup><DropdownMenuLabel>Copy a saved schema into this slide</DropdownMenuLabel></DropdownMenuGroup>
            {saved.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved schemas yet. Create one on the Schemas page.</div>}
            {saved.map((s) => <DropdownMenuItem key={s.id} onClick={() => void useSaved(s.id)}><div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.tables} tables · {s.dialect}</div></div></DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  )
}
