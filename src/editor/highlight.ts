export type TokenKind = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'plain'
export interface Token { text: string; kind: TokenKind; start: number }

const RE = /("(?:\\.|[^"\\\n])*"?)(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g

/** Splits JSON-ish text into coloured pieces. Never throws and always reproduces the input exactly. */
export function tokenizeJson(src: string): Token[] {
  const out: Token[] = []
  let last = 0
  for (const m of src.matchAll(RE)) {
    const start = m.index!
    if (start > last) out.push({ text: src.slice(last, start), kind: 'plain', start: last })
    if (m[1] !== undefined) {
      out.push({ text: m[1], kind: m[2] !== undefined ? 'key' : 'string', start })
      if (m[2] !== undefined) out.push({ text: m[2], kind: 'punct', start: start + m[1].length })
    } else {
      const t = m[0]
      out.push({ text: t, kind: /^[{}[\],:]$/.test(t) ? 'punct' : /^(true|false|null)$/.test(t) ? 'literal' : 'number', start })
    }
    last = start + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last), kind: 'plain', start: last })
  return out
}

/** Character offset mentioned in a JSON.parse error message, if any. */
export function errorPosition(message: string | null): number | null {
  const m = message?.match(/position (\d+)/)
  return m ? Number(m[1]) : null
}
