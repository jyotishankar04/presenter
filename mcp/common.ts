import { StoreError } from '../server/store'

export const WEB = process.env.PRESENTER_WEB_URL ?? 'http://localhost:5173'
export const rid = () => Math.random().toString(36).slice(2, 8)
export const slugify = (s: string, fallback = 'item') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback

/** A problem the agent can fix by changing its input; shown to it as a tool error. */
export class ToolError extends Error {}
export const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })
export const fail = (message: string) => ({ isError: true, content: [{ type: 'text' as const, text: message }] })

/** Wraps a handler so thrown validation / storage problems become tool errors the agent can read and fix. */
export function guarded<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try { return ok(await fn(args)) } catch (e) {
      if (e instanceof ToolError || e instanceof StoreError) return fail(e.message)
      throw e
    }
  }
}

export const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
export const WR = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
