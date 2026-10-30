import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './tools'

// stdout carries the protocol; anything human-readable must go to stderr.
const server = createMcpServer()
await server.connect(new StdioServerTransport())
console.error('presenter MCP server running on stdio')
