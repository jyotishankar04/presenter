import { useEffect, useRef } from 'react'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

/** True while the user is typing into a field, so single-key shortcuts must stay out of the way. */
export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest?.('[role="dialog"], [role="menu"], [role="listbox"][data-typing]')
}

export const hasMod = (e: { ctrlKey: boolean; metaKey: boolean }) => e.ctrlKey || e.metaKey

/**
 * Stops the browser's own shortcuts / gestures from fighting the app:
 * Ctrl+S (save page), Ctrl+P (print), Ctrl+D (bookmark), Ctrl+A (select page), Ctrl+G/H/U,
 * Backspace / Alt+←→ (history navigation) and dropping a file onto the page (which would open it).
 * Browser-reserved ones (Ctrl+W/T/N, Ctrl+Tab) cannot be blocked by any web page.
 */
export function useBrowserGuard(opts: { onSave?: () => void } = {}) {
  const save = useRef(opts.onSave)
  save.current = opts.onSave
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const typing = isTyping(e.target)
      if (hasMod(e) && !e.shiftKey && !e.altKey) {
        if (k === 's') { e.preventDefault(); save.current?.(); return }
        if (['p', 'd', 'g', 'h', 'u'].includes(k)) { e.preventDefault(); return }
        if (k === 'a' && !typing) { e.preventDefault(); return }
      }
      if (hasMod(e) && e.shiftKey && k === 's') { e.preventDefault(); return }
      if (!typing && (k === 'backspace' || (e.altKey && (k === 'arrowleft' || k === 'arrowright')))) e.preventDefault()
      if (!typing && k === ' ' && !(e.target as HTMLElement | null)?.closest?.('button, a, [role="option"], [role="button"], .excalidraw')) e.preventDefault()
    }
    const stop = (e: DragEvent) => { if (!(e.target as HTMLElement | null)?.closest?.('[data-dropzone]')) e.preventDefault() }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop) }
  }, [])
}

export interface ShortcutGroup { title: string; items: [keys: string, what: string][] }

export const SHORTCUTS: ShortcutGroup[] = [
  { title: 'Anywhere in the editor', items: [
    [`${MOD}+S`, 'Save now'], ['?', 'Show this list'], [`${MOD}+Enter`, 'Present from this slide'],
    ['Alt+PageUp / Alt+PageDown', 'Previous / next slide (plain PageUp/PageDown too on normal slides)'], [`${MOD}+M`, 'New slide'], ['Esc', 'Cancel / clear selection'],
  ] },
  { title: 'Selecting (normal slides)', items: [
    ['Click', 'Select one item'], ['Shift / Ctrl + click', 'Add or remove from selection'], ['Drag on empty space', 'Rubber-band select'],
    [`${MOD}+A`, 'Select everything'], ['Tab / Shift+Tab', 'Move selection to next / previous item'], ['Esc', 'Deselect'],
  ] },
  { title: 'Editing (normal slides)', items: [
    ['Enter / double-click', 'Edit the selected item’s text'], ['Arrows', 'Nudge 2px (Shift = 10px)'], ['Drag', 'Move selection'],
    ['Delete', 'Delete selection'], [`${MOD}+C / X / V`, 'Copy / cut / paste (images paste too)'], [`${MOD}+D`, 'Duplicate'],
    [`${MOD}+Z / ${MOD}+Shift+Z`, 'Undo / redo'], [`${MOD}+] / ${MOD}+[`, 'Bring forward / send backward'], ['Alt+0…9', 'Reveal on click 0…9'],
    ['Drop an image file', 'Add it to the slide'],
  ] },
  { title: 'Canvas slides', items: [
    ['Alt+0…9', 'Reveal selection on click N'], ['Alt+O', 'Click-order mode'], ['Alt+P', 'Edit / preview'], ['Drop or paste an image', 'Add it'],
    ['V, R, A, T …', 'Excalidraw tools (press ? inside the canvas menu for all)'],
  ] },
  { title: 'Flow diagram slides', items: [
    ['Drag from a node\'s dot', 'Connect it to another node'], ['Drag on empty space', 'Rubber-band select'], ['Middle / right mouse drag', 'Pan the view'], ['Scroll or pinch', 'Zoom'],
    ['Double-click a node', 'Edit its text'], ['Delete', 'Delete selection'], [`${MOD}+A / C / V / D`, 'Select all / copy / paste / duplicate'], [`${MOD}+Z / ${MOD}+Shift+Z`, 'Undo / redo'],
    ['Alt+0…9', 'Reveal selection on click N'], ['Alt+O', 'Click-order mode'], ['Alt+P', 'Edit / preview'], ['Right-click', 'Node, connection and canvas menus'],
  ] },
  { title: 'Database schema designer (page and slides)', items: [
    ['Drag from a column\'s dot', 'Create a foreign key to another column'], ['Drag on empty space', 'Rubber-band select tables'], ['Middle / right mouse drag', 'Pan'],
    ['Delete', 'Delete selected table / relationship'], [`${MOD}+A / D`, 'Select all / duplicate table'], [`${MOD}+Z / ${MOD}+Shift+Z`, 'Undo / redo'],
    ['Right-click', 'Table, relationship and canvas menus'], ['Alt+0…9, Alt+O, Alt+P', 'Slides only: reveal step, click-order, preview'],
  ] },
  { title: 'Slide list', items: [
    ['↑ / ↓', 'Previous / next slide'], ['Shift+↑/↓ or Shift+click', 'Select a range'], [`${MOD}+click`, 'Add one slide to selection'],
    ['Alt+↑ / ↓', 'Move selected slides'], ['Drag', 'Reorder slides'], ['Delete', 'Delete selected slides'], [`${MOD}+D`, 'Duplicate selected slides'],
  ] },
  { title: 'Presenting', items: [
    ['→ Space Enter PageDown', 'Next click'], ['← Backspace PageUp', 'Previous click'], ['Right-click', 'Previous click'],
    ['Home / End', 'First / last slide'], ['Number + Enter', 'Jump to slide'], ['B or .', 'Black screen'], ['F', 'Fullscreen'], ['G', 'Slide grid'], ['S', 'Speaker notes'], ['V', 'Open presenter view (second window)'], ['Esc', 'Back to editor'],
  ] },
]
