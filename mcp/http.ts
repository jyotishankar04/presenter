import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Hono } from 'hono'
import { createMcpServer } from './tools'

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/** Streamable-HTTP MCP endpoint at /mcp. Stateless: every request gets a fresh server. */
export function mountMcp(app: Hono) {
  app.all('/mcp', async (c) => {
    // Refuse DNS-rebinding and cross-site browser requests; agents (non-browser) send no Origin.
    const host = c.req.header('host') ?? ''
    const origin = c.req.header('origin')
    if (!LOCAL_HOST.test(host) || (origin && !LOCAL_ORIGIN.test(origin))) return c.json({ error: 'forbidden' }, 403)
    const server = createMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    return transport.handleRequest(c.req.raw)
  })
}
