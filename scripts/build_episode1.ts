import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../mcp/tools'
import { slidesPart1 } from './episode1_data_part1'
import { slidesPart2 } from './episode1_data_part2'
import { slidesPart3 } from './episode1_data_part3'
import { deleteDeck } from '../server/store'

async function main() {
  console.log('Connecting to MCP server in-memory...')
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createMcpServer().connect(a)
  const client = new Client({ name: 'episode1-builder', version: '1.0' })
  await client.connect(b)

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args })
    const text = r.content?.[0]?.text as string
    let json: any = null
    try { json = JSON.parse(text) } catch { /* plain text */ }
    if (r.isError) {
      console.error(`ERROR calling tool "${name}":`, text)
      throw new Error(`Tool ${name} failed: ${text}`)
    }
    return { text, json }
  }

  const deckId = 'episode-01'

  // Clean up existing deck if present
  try {
    await deleteDeck(deckId)
    console.log(`Deleted existing "${deckId}" deck.`)
  } catch { /* ignore */ }

  console.log(`Creating deck "${deckId}"...`)
  const created = await call('create_deck', {
    id: deckId,
    title: 'System Design Foundations + First Scalable API',
    theme: 'midnight',
    background: 'grid'
  })
  console.log('Deck created:', created.text)

  // Configure Slide 1 (Title + Simple Architecture)
  console.log('Setting up Slide 01 (Title + Architecture)...')
  await call('update_slide', {
    deck: deckId,
    slide: 1,
    title: 'System Design Foundations + First Scalable API',
    eyebrow: 'Episode 01 · System Design Learning Series',
    layout: 'content',
    elements: [
      {
        id: 'subtitle',
        type: 'text',
        x: 180,
        y: 200,
        w: 1240,
        h: 120,
        text: 'From a Basic Client–Server Application to a Scalable Backend\nCase Study: URL Shortener  |  Tech Stack: TypeScript, Node.js, Express, PostgreSQL',
        size: 32,
        style: 'sans',
        accent: 'muted',
        align: 'center',
        reveal: 0
      },
      {
        id: 'box_client',
        type: 'box',
        x: 180,
        y: 480,
        w: 320,
        h: 120,
        label: 'Client\n(Browser / Mobile)',
        icon: 'Globe',
        accent: 'blue',
        reveal: 1
      },
      {
        id: 'box_api',
        type: 'box',
        x: 640,
        y: 480,
        w: 320,
        h: 120,
        label: 'Backend API\n(Express / Node.js)',
        icon: 'Server',
        accent: 'amber',
        reveal: 2
      },
      {
        id: 'box_db',
        type: 'box',
        x: 1100,
        y: 480,
        w: 320,
        h: 120,
        label: 'Database\n(PostgreSQL)',
        icon: 'Database',
        accent: 'green',
        reveal: 3
      },
      {
        id: 'arrow_c_api',
        type: 'arrow',
        from: 'box_client',
        to: 'box_api',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        accent: 'blue',
        label: 'HTTP Request',
        reveal: 2
      },
      {
        id: 'arrow_api_db',
        type: 'arrow',
        from: 'box_api',
        to: 'box_db',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        accent: 'green',
        label: 'SQL Query (Pool)',
        reveal: 3
      }
    ]
  })

  await call('set_speaker_notes', {
    deck: deckId,
    slide: 1,
    notes: `Welcome to Episode 01 of the System Design Learning Series.
Episode Objective:
Understand how a client communicates with a backend, how HTTP and REST APIs work, how a backend interacts with a relational database, and how to make a basic API scalable, resilient, and reliable.
Throughout this entire episode, we will build and evolve a real, production-ready URL Shortener using TypeScript, Express, and PostgreSQL.`
  })

  const allSlides = [...slidesPart1, ...slidesPart2, ...slidesPart3]
  console.log(`Adding ${allSlides.length} remaining slides...`)

  for (let idx = 0; idx < allSlides.length; idx++) {
    const s = allSlides[idx]
    const slideNo = idx + 2 // 1-based slide index after slide 1
    process.stdout.write(`Building Slide ${String(slideNo).padStart(2, '0')}: "${s.args.title}"... `)

    await call(s.tool, {
      deck: deckId,
      ...s.args
    })

    if (s.notes) {
      await call('set_speaker_notes', {
        deck: deckId,
        slide: slideNo,
        notes: s.notes
      })
    }

    console.log('OK')
  }

  // Get final outline to verify
  const outlineRes = await call('get_deck', { deck: deckId })
  const outline = outlineRes.json
  console.log(`\n========================================`)
  console.log(`Successfully built deck "${outline.id}"!`)
  console.log(`Total slides created: ${outline.slides.length}`)
  console.log(`Theme: ${outline.theme}`)
  console.log(`Edit URL:    ${outline.edit}`)
  console.log(`Present URL: ${outline.present}`)
  console.log(`========================================\n`)
}

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
