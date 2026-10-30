import type { Scene } from '../model/types'

export const getReveal = (el: any): number => (typeof el?.customData?.reveal === 'number' ? el.customData.reveal : 0)

export const live = (elements: any[]) => elements.filter((e) => !e.isDeleted)

export function sceneSteps(scene?: Scene): number {
  let max = 0
  for (const e of live(scene?.elements ?? [])) max = Math.max(max, getReveal(e))
  return max
}

/** Arrows wait for both of the shapes they connect, so you only have to order the shapes. */
export function effectiveReveal(el: any, byId: Map<string, any>): number {
  let r = getReveal(el)
  if (el.type === 'arrow') {
    for (const b of [el.startBinding, el.endBinding]) {
      const target = b && byId.get(b.elementId)
      if (target) r = Math.max(r, getReveal(target))
    }
  }
  return r
}

export function elementsAtStep(elements: any[], step: number) {
  const alive = live(elements)
  const byId = new Map(alive.map((e) => [e.id, e]))
  return alive.filter((e) => effectiveReveal(e, byId) <= step)
}

/** Ids to change when the given elements are assigned a step: containers drag their bound labels along. */
export function withBoundText(elements: any[], ids: Iterable<string>): Set<string> {
  const out = new Set(ids)
  for (const e of elements) {
    if (out.has(e.id)) for (const b of e.boundElements ?? []) if (b.type === 'text') out.add(b.id)
    if (e.containerId && out.has(e.containerId)) out.add(e.id)
  }
  return out
}

export function setReveal(elements: any[], ids: Set<string>, n: number): any[] {
  const targets = withBoundText(elements, ids)
  return elements.map((e) =>
    targets.has(e.id)
      ? { ...e, version: e.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31), updated: Date.now(), customData: { ...e.customData, reveal: n } }
      : e,
  )
}

/** Cheap change signature so we only persist when something really changed. */
export function sceneSignature(elements: any[]): string {
  let h = 0
  for (const e of elements) h = (h * 31 + e.version + e.versionNonce) | 0
  return elements.length + ':' + h
}
