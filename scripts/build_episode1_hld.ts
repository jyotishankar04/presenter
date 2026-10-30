import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../mcp/tools'
import { deleteDeck } from '../server/store'

type Accent = 'amber' | 'blue' | 'green' | 'red' | 'ink' | 'muted'
type Args = Record<string, any>
interface Def { tool: string; args: Args; notes?: string }

const deckId = 'episode-01-problem-to-design'
const defs: Def[] = []

let n = 0
const id = (p: string) => `${p}${++n}`

const card = (items: string[], start = 1) => items.map((text, i) => ({ text, reveal: start + i }))
const list = (header: string, items: string[], x: number, w: number, accent: Accent, start = 1) =>
  ({ id: id('list'), type: 'cardList', x, y: 190, w, h: 640, reveal: 0, header, accent, cards: card(items, start) })
const text = (t: string, x: number, y: number, w: number, h: number, reveal: number, o: Partial<{ size: number; style: string; accent: Accent; align: string }> = {}) =>
  ({ id: id('t'), type: 'text', x, y, w, h, reveal, text: t, size: o.size ?? 30, style: o.style ?? 'sans', accent: o.accent ?? 'ink', align: o.align ?? 'left' })
const code = (src: string, x: number, y: number, w: number, h: number, reveal: number, lang = 'json', size = 26) =>
  ({ id: id('c'), type: 'code', x, y, w, h, reveal, code: src, lang, size, focus: [] })
const box = (label: string, x: number, y: number, w: number, h: number, reveal: number, accent: Accent, icon?: string) =>
  ({ id: id('b'), type: 'box', x, y, w, h, reveal, label, accent, ...(icon ? { icon } : {}) })
const arrow = (from: string, to: string, reveal: number, accent: Accent = 'ink', label?: string) =>
  ({ id: id('a'), type: 'arrow', from, to, x: 0, y: 0, w: 0, h: 0, reveal, accent, ...(label ? { label } : {}) })

const content = (title: string, elements: Args[], notes?: string, eyebrow?: string) =>
  defs.push({ tool: 'add_slide', args: { layout: 'content', title, eyebrow, elements }, notes })
const section = (title: string, eyebrow: string) => defs.push({ tool: 'add_slide', args: { layout: 'section', title, eyebrow } })

/** Bullet slide: one card list (or two columns when long) and an optional side element. */
function bullets(title: string, header: string, items: string[], accent: Accent, side?: (start: number) => Args[], notes?: string) {
  const els: Args[] = []
  if (side) {
    els.push(list(header, items, 100, 640, accent))
    els.push(...side(items.length + 1))
  } else if (items.length > 5) {
    const h = Math.ceil(items.length / 2)
    els.push(list(header, items.slice(0, h), 100, 640, accent, 1))
    els.push(list('​', items.slice(h), 790, 640, accent, h + 1))
  } else {
    els.push(list(header, items, 100, 1100, accent))
  }
  content(title, els, notes)
}

/** Table slide: each row becomes a card "Left — Right", revealed one per click. */
const table = (title: string, header: string, rows: [string, string][], accent: Accent, footer?: string) => {
  const els: Args[] = [list(header, rows.map(([a, b]) => `${a}  —  ${b}`), 100, 1300, accent)]
  if (footer) els.push(text(footer, 100, 790, 1300, 60, rows.length + 1, { size: 28, accent: 'muted' }))
  content(title, els)
}

const diagram = (title: string, nodes: Args[], edges: Args[], direction: 'LR' | 'TB' = 'LR', reveal = 'node', notes?: string) =>
  defs.push({ tool: 'add_diagram_slide', args: { title, nodes, edges, direction, reveal }, notes })

// ── Section 1 ────────────────────────────────────────────────────────────────
// 1
content('From Problem Statement to System Design', [
  text('System Design Fundamentals  ·  Episode 01', 100, 230, 1400, 60, 0, { size: 38, accent: 'amber' }),
  text('Understanding the problem before designing the solution.', 100, 320, 1400, 80, 0, { size: 44, style: 'serif' }),
  text('Case Study: URL Shortener', 100, 460, 1400, 60, 1, { size: 38, accent: 'blue' }),
], undefined, 'Episode 01')

// 2
bullets('Why Should We Design Before Coding?', 'Questions to ask first', [
  "Why shouldn't we start coding immediately?",
  'What happens when we build without understanding the requirements?',
  'How do we identify what needs to be built?',
  'Why is choosing technologies not the first step?',
  'How does system design reduce unnecessary complexity?',
], 'amber', (s) => [text('Example', 800, 240, 600, 50, s, { size: 30, accent: 'muted' }), text('Build a URL Shortener like Bitly.', 800, 310, 640, 160, s, { size: 44, style: 'serif' })])

// 3
content('Understanding the Problem Statement', [
  text('"Build a URL Shortener that allows users to convert long URLs into short URLs and redirect visitors to the original destination."', 100, 190, 1400, 150, 0, { size: 32, style: 'serif', accent: 'amber' }),
  list('Break the problem into questions', [
    'What is the input?', 'What is the expected output?', 'Who will use the system?',
    'What actions should the system support?', 'What responsibilities belong to our application?',
  ], 100, 700, 'blue', 1).valueOf() as Args,
  text('Input', 860, 380, 600, 40, 6, { size: 26, accent: 'muted' }),
  code('https://example.com/articles/system-design', 860, 420, 640, 90, 6, 'bash', 22),
  text('Output', 860, 560, 600, 40, 7, { size: 26, accent: 'muted' }),
  code('https://short.ly/aB92x', 860, 600, 640, 90, 7, 'bash', 24),
])

// 4
diagram('Defining the System Boundary', [
  { id: 'client', label: 'Client\n(outside)', shape: 'box', icon: 'Globe', accent: 'muted', muted: true },
  { id: 'api', label: 'Backend API\n(inside)', shape: 'box', icon: 'Server', accent: 'amber' },
  { id: 'db', label: 'Database\n(inside)', shape: 'database', accent: 'green' },
  { id: 'dest', label: 'Destination Website\n(outside)', shape: 'box', icon: 'ExternalLink', accent: 'muted', muted: true },
], [
  { from: 'client', to: 'api', label: 'request' },
  { from: 'api', to: 'db', label: 'store / fetch' },
  { from: 'client', to: 'dest', label: 'redirected', dashed: true },
], 'LR', 'node',
`A system boundary defines what belongs to our application and what remains outside its responsibility.
Inside: accept URL creation requests, validate URLs, generate unique short codes, store mappings, retrieve original URLs, redirect users.
Outside: the user's browser, internet infrastructure, the destination website, external DNS infrastructure.`)

// 5
diagram('Identifying the Main Components', [
  { id: 'client', label: 'Client\nSends requests, displays results', shape: 'box', icon: 'Globe', accent: 'blue' },
  { id: 'api', label: 'Backend API\nValidates, runs business logic', shape: 'box', icon: 'Server', accent: 'amber' },
  { id: 'db', label: 'PostgreSQL\nStores URLs and short codes', shape: 'database', accent: 'green' },
], [{ from: 'client', to: 'api' }, { from: 'api', to: 'db' }], 'LR', 'node')

// 6
content('Understanding Component Responsibilities', [
  list('Every component needs a clear responsibility', [
    'Client  —  User interaction',
    'Backend API  —  Request handling and business logic',
    'Database  —  Persistent data storage',
  ], 100, 760, 'blue', 1),
  list('Think about', [
    'Why separate responsibilities?',
    'What if responsibilities overlap?',
    'Why communicate through defined interfaces?',
  ], 900, 600, 'amber', 4),
])
defs.push({ tool: 'add_comparison_slide', args: {
  title: 'Responsibilities: Wrong vs Right',
  left: { header: 'Incorrectly distributed', accent: 'red', items: ['Client talks directly to the database', 'Validation scattered across client and DB', 'Business logic duplicated everywhere'] },
  right: { header: 'Properly separated', accent: 'green', items: ['Client only handles interaction', 'Backend API owns validation and logic', 'Database only persists data'] },
  footer: 'Defined interfaces keep each part replaceable.',
} })

// ── Section 2 ────────────────────────────────────────────────────────────────
section('System Design Fundamentals', 'Section 2')

// 7
content('What Is System Design?', [
  text('System design is the process of defining the structure, components, interfaces, and interactions required to build a system that satisfies its requirements.', 100, 190, 1400, 180, 0, { size: 34, style: 'serif' }),
  list('Important concepts', ['Structure', 'Components', 'Interfaces', 'Interactions', 'Requirements'], 100, 640, 'blue', 1),
  text('Goal', 790, 420, 600, 40, 6, { size: 28, accent: 'muted' }),
  text('Correct · Scalable · Reliable · Maintainable · Cost-effective', 790, 470, 700, 160, 6, { size: 38, style: 'serif', accent: 'green' }),
])

// 8
content('What Is Software Architecture?', [
  text('The high-level organization of a software system.', 100, 190, 1400, 70, 0, { size: 36, style: 'serif' }),
  list('It defines', [
    'Major system components', 'Responsibilities of each component', 'Communication between components',
    'Relationships between components', 'Overall system structure',
  ], 100, 640, 'blue', 1),
  list('Key questions', [
    'What are the main components?', 'How do they communicate?',
    'What responsibilities does each have?', 'How does data flow through the system?',
  ], 790, 640, 'amber', 6),
])

// 9
content('Understanding Components', [
  text('A component is an identifiable part of a system that performs a specific responsibility.', 100, 190, 1400, 110, 0, { size: 32, style: 'serif' }),
  list('URL Shortener components', [
    'Client  —  User interface', 'URL Controller  —  Handles API requests',
    'URL Service  —  Contains business logic', 'Database  —  Stores URL mappings',
  ], 100, 760, 'blue', 1),
  list('Concepts', ['Component responsibilities', 'Separation of concerns', 'Component relationships'], 900, 600, 'green', 5),
])

// 10
content('Understanding Interfaces', [
  text('An interface defines how two components communicate and interact.', 100, 190, 1400, 70, 0, { size: 32, style: 'serif' }),
  list('Important concepts', ['API endpoints', 'HTTP methods', 'Request / response payloads', 'Communication protocols', 'Data formats'], 100, 560, 'blue', 1),
  text('Request', 720, 290, 400, 40, 6, { size: 26, accent: 'muted' }),
  code('POST /api/urls\nContent-Type: application/json\n\n{\n  "url": "https://example.com/article"\n}', 720, 330, 780, 260, 6, 'bash', 24),
  text('Response', 720, 620, 400, 40, 7, { size: 26, accent: 'muted' }),
  code('{\n  "shortUrl": "https://short.ly/aB92x"\n}', 720, 660, 780, 160, 7, 'json', 24),
])

// 11
content('Understanding Implementation', [
  text('Implementation is the process of translating a system design into working software.', 100, 190, 1400, 100, 0, { size: 32, style: 'serif' }),
  list('Includes', ['Writing application code', 'Creating components', 'Implementing interfaces', 'Configuring infrastructure', 'Integrating databases', 'Deploying the application'].slice(0, 5), 100, 640, 'blue', 1),
  list('Example technology stack', [
    'Backend  —  Node.js + Express + TypeScript', 'Database  —  PostgreSQL', 'ORM  —  Prisma', 'Communication  —  HTTP / REST',
  ], 790, 710, 'green', 6),
])

// ── Section 3 ────────────────────────────────────────────────────────────────
section('High-Level Design vs Low-Level Design', 'Section 3')

// 12
bullets('What Is High-Level Design (HLD)?', 'HLD focuses on', [
  'Overall architecture', 'Major components', 'Component relationships',
  'Communication patterns', 'Data flow', 'Architectural technology choices',
], 'blue', (s) => [
  text('HLD describes the overall architecture of a system, its major components, responsibilities, and interactions.', 100, 0, 0, 0, 0),
].slice(0, 0))
defs[defs.length - 1].args.elements.push(
  text('Describes the overall architecture, major components, responsibilities, and interactions.', 100, 190, 1400, 80, 0, { size: 28, style: 'serif', accent: 'muted' }),
)
// shift the HLD lists below the definition
defs[defs.length - 1].args.elements.forEach((e: Args) => { if (e.type === 'cardList') { e.y = 290; e.h = 540 } })

diagram('HLD Example: URL Shortener', [
  { id: 'client', label: 'Client', shape: 'box', icon: 'Globe', accent: 'blue' },
  { id: 'api', label: 'Backend API', shape: 'box', icon: 'Server', accent: 'amber' },
  { id: 'db', label: 'PostgreSQL', shape: 'database', accent: 'green' },
], [{ from: 'client', to: 'api' }, { from: 'api', to: 'db' }], 'TB', 'node')

// 13
content('What Is Low-Level Design (LLD)?', [
  text('Describes the internal design and implementation details of individual components.', 100, 190, 1400, 80, 0, { size: 28, style: 'serif', accent: 'muted' }),
  { ...list('LLD focuses on', [
    'Classes and modules', 'Functions and methods', 'Internal business logic', 'Database schema',
    'API validation', 'Error handling', 'Detailed request/response behavior',
  ], 100, 1300, 'green', 1), y: 290, h: 540 },
])
// fix: 7 cards in one column is too tall; split in two columns
{
  const els = defs[defs.length - 1].args.elements
  const items = ['Classes and modules', 'Functions and methods', 'Internal business logic', 'Database schema', 'API validation', 'Error handling', 'Detailed request/response behavior']
  els.splice(1, 1,
    { ...list('LLD focuses on', items.slice(0, 4), 100, 640, 'green', 1), y: 290, h: 540 },
    { ...list('​', items.slice(4), 790, 640, 'green', 5), y: 290, h: 540 })
}

diagram('LLD Example: POST /api/urls', [
  { id: 'req', label: 'POST /api/urls', shape: 'pill', accent: 'blue' },
  { id: 'ctl', label: 'URL Controller', shape: 'box', icon: 'Route', accent: 'amber' },
  { id: 'svc', label: 'URL Service', shape: 'box', icon: 'Cog', accent: 'ink' },
  { id: 'prisma', label: 'Prisma Client', shape: 'box', icon: 'Layers', accent: 'blue' },
  { id: 'db', label: 'PostgreSQL', shape: 'database', accent: 'green' },
], [{ from: 'req', to: 'ctl' }, { from: 'ctl', to: 'svc' }, { from: 'svc', to: 'prisma' }, { from: 'prisma', to: 'db' }], 'TB', 'node')

// 14
table('HLD vs LLD: Comparison', 'Aspect  —  HLD  |  LLD', [
  ['Focus', 'Overall system  |  Individual components'],
  ['Level', 'High-level  |  Detailed'],
  ['Describes', 'Architecture  |  Implementation details'],
  ['Includes', 'Components and interactions  |  Classes, methods, schemas'],
  ['Main purpose', 'Define system structure  |  Define internal behavior'],
  ['Example', 'Client → API → DB  |  Controller → Service → Repository'],
], 'amber')

// 15
diagram('How HLD and LLD Work Together', [
  { id: 'p', label: 'Problem Statement', shape: 'pill', accent: 'muted' },
  { id: 'r', label: 'Requirements', shape: 'box', accent: 'blue' },
  { id: 'h', label: 'HLD', shape: 'box', accent: 'amber' },
  { id: 'l', label: 'LLD', shape: 'box', accent: 'green' },
  { id: 'i', label: 'Implementation', shape: 'pill', accent: 'ink' },
], [{ from: 'p', to: 'r' }, { from: 'r', to: 'h' }, { from: 'h', to: 'l' }, { from: 'l', to: 'i' }], 'LR', 'node',
`1. Understand the problem. 2. Identify requirements. 3. Define the system boundary. 4. Identify major components. 5. Create the HLD. 6. Break components into smaller responsibilities. 7. Create the LLD. 8. Implement the solution.`)

// ── Section 4 ────────────────────────────────────────────────────────────────
section('Understanding a Request End to End', 'Section 4')

// 16
content('Our First Request', [
  text('A user submits a long URL and expects a short URL in return.', 100, 190, 1400, 70, 0, { size: 32, style: 'serif' }),
  text('API', 100, 290, 400, 40, 1, { size: 26, accent: 'muted' }),
  code('POST /api/urls', 100, 330, 600, 90, 1, 'bash', 28),
  text('Request', 100, 450, 400, 40, 2, { size: 26, accent: 'muted' }),
  code('{\n  "url": "https://example.com/article"\n}', 100, 490, 700, 180, 2, 'json', 26),
  text('Expected response', 860, 450, 500, 40, 3, { size: 26, accent: 'muted' }),
  code('{\n  "shortUrl": "https://short.ly/aB92x"\n}', 860, 490, 640, 180, 3, 'json', 26),
])

// 17
content('Step 1: Client Submits the Request', [
  list('What happens', ['Client collects the original URL', 'Client sends an HTTP POST request', 'Request goes to the Backend API', 'Request carries the URL as JSON'], 100, 640, 'blue', 1),
  list('Request details', ['Method  —  POST', 'Endpoint  —  /api/urls', 'Content-Type  —  application/json', 'Body  —  Original URL'], 790, 640, 'amber', 5),
])

// 18
diagram('Step 2: Backend Validates the URL', [
  { id: 'req', label: 'Request', shape: 'pill', accent: 'blue' },
  { id: 'val', label: 'URL provided, valid format, valid body?', shape: 'decision', accent: 'amber' },
  { id: 'ok', label: 'Continue processing', shape: 'box', accent: 'green' },
  { id: 'bad', label: 'Return error response', shape: 'box', accent: 'red' },
], [{ from: 'req', to: 'val' }, { from: 'val', to: 'ok', label: 'valid' }, { from: 'val', to: 'bad', label: 'invalid' }], 'LR', 'node',
'Validation checks whether the submitted input satisfies the expected requirements: is the URL provided, is it a valid format, is the request body valid, does it satisfy the API contract.')

// 19
content('Step 3: Backend Generates a Unique Code', [
  text('A short code is a unique identifier associated with an original URL.', 100, 190, 1400, 70, 0, { size: 32, style: 'serif' }),
  text('Original URL', 100, 300, 500, 40, 1, { size: 26, accent: 'muted' }),
  code('https://example.com/article', 100, 340, 1000, 90, 1, 'bash', 28),
  text('Generated code', 100, 460, 500, 40, 2, { size: 26, accent: 'muted' }),
  code('aB92x', 100, 500, 1000, 90, 2, 'bash', 28),
  text('Short URL', 100, 620, 500, 40, 3, { size: 26, accent: 'muted' }),
  code('https://short.ly/aB92x', 100, 660, 1000, 90, 3, 'bash', 28),
  text('The generated code must uniquely identify its URL mapping.', 100, 780, 1400, 60, 4, { size: 30, accent: 'amber' }),
])

// 20
content('Step 4: Backend Stores the URL Mapping', [
  text('Why a database? The system must remember which original URL belongs to a short code.', 100, 190, 1400, 90, 0, { size: 30, style: 'serif' }),
  code('id | short_code | original_url\n---+------------+------------------------------\n 1 | aB92x      | https://example.com/article', 100, 310, 1400, 170, 1, 'bash', 26),
  box('Backend API', 100, 560, 300, 100, 2, 'amber', 'Server'),
  box('PostgreSQL', 560, 560, 300, 100, 2, 'green', 'Database'),
  box('Stored URL Mapping', 1020, 560, 380, 100, 3, 'blue', 'Link'),
])
{
  const els = defs[defs.length - 1].args.elements
  const [a, b, c] = els.slice(-3)
  els.push(arrow(a.id, b.id, 2, 'green', 'INSERT'), arrow(b.id, c.id, 3, 'blue'))
  els.push(text('Data persistence · URL mapping · Insertion · Retrieval', 100, 740, 1400, 60, 4, { size: 28, accent: 'muted' }))
}

// 21
content('Step 5: Backend Returns the Short URL', [
  list('After successful storage', [
    'Database confirms successful storage', 'Backend prepares the response', 'Backend returns the generated short URL',
    'Client receives the response', 'Client displays the short URL',
  ], 100, 700, 'green', 1),
  code('HTTP/1.1 201 Created\n\n{\n  "shortUrl": "https://short.ly/aB92x"\n}', 860, 260, 640, 280, 6, 'bash', 26),
])

// 22
defs.push({ tool: 'add_sequence_slide', args: {
  title: 'Complete Request Lifecycle: From Client to Database and Back',
  actors: ['Client', 'Backend API', 'PostgreSQL'],
  messages: [
    { from: 'Client', to: 'Backend API', text: '1-2. POST /api/urls { url }' },
    { from: 'Backend API', to: 'Backend API', text: '3. Validate the URL' },
    { from: 'Backend API', to: 'Backend API', text: '4. Generate unique short code' },
    { from: 'Backend API', to: 'PostgreSQL', text: '5. Store URL mapping' },
    { from: 'PostgreSQL', to: 'Backend API', text: '6. Confirm successful storage' },
    { from: 'Backend API', to: 'Client', text: '7. 201 Created { shortUrl }' },
  ],
  caption: '8. Client displays the result.',
} })

// 23
table('What Can Go Wrong During a Request?', 'Stage  —  Possible failure', [
  ['Client request', 'Network failure'], ['Validation', 'Invalid URL'], ['Code generation', 'Code collision'],
  ['Database operation', 'Database unavailable'], ['Response', 'Client disconnects'],
], 'red', 'A system must account for both successful operations and failure scenarios.')

// ── Section 5 ────────────────────────────────────────────────────────────────
section('Five Questions Before Designing Any System', 'Section 5')

// 24
diagram('The Five Fundamental Questions', [
  { id: 'q1', label: '1. What must it do?', shape: 'box', icon: 'ListChecks', accent: 'blue' },
  { id: 'q2', label: '2. How much load?', shape: 'box', icon: 'Gauge', accent: 'amber' },
  { id: 'q3', label: '3. What can fail?', shape: 'box', icon: 'TriangleAlert', accent: 'red' },
  { id: 'q4', label: '4. What data must persist?', shape: 'box', icon: 'Database', accent: 'green' },
  { id: 'q5', label: '5. What constraints matter?', shape: 'box', icon: 'Lock', accent: 'ink' },
  { id: 'sd', label: 'System Design', shape: 'pill', accent: 'amber' },
], [1, 2, 3, 4, 5].map((k) => ({ from: `q${k}`, to: 'sd' })), 'LR', 'node')

// 25–29
bullets('Question 1: What Must It Do?', 'Functional requirements: what the system must do', [
  'Users can submit long URLs', 'The system generates short URLs', 'Users can access short URLs',
  'The system redirects users to original URLs', 'Users can manage their created links',
], 'blue', (s) => [text('What features and behaviors must the system provide?', 800, 300, 640, 160, s, { size: 38, style: 'serif', accent: 'amber' })])

bullets('Question 2: How Much Load Will It Handle?', 'Expected workload', [
  'Number of users', 'Number of requests', 'Concurrent users', 'Requests per second', 'Read/write workload',
], 'amber', (s) => [
  text('Illustrative assumptions', 800, 230, 640, 40, s, { size: 26, accent: 'muted' }),
  list('', ['10,000 URL creations per day', 'Up to 500 concurrent users', 'More redirects than creations'], 800, 280, 'green', s).valueOf() as Args,
].map((e) => (e.type === 'cardList' ? { ...e, x: 800, w: 700, y: 280, h: 400 } : e)))

bullets('Question 3: What Can Fail?', 'Failure scenarios', [
  'Client cannot connect to the backend', 'Backend application crashes', 'Database becomes unavailable',
  'Network connection is interrupted', 'Invalid input reaches the API',
], 'red', (s) => [text('What happens when an individual component or connection fails?', 800, 300, 640, 200, s, { size: 38, style: 'serif', accent: 'amber' })])

bullets('Question 4: What Data Must Persist?', 'URL Shortener data', [
  'Original URL', 'Short code', 'Creation timestamp', 'User ID, if authentication is supported',
], 'green', (s) => [
  text('Persistent data outlives a single request or process.', 800, 230, 640, 120, s, { size: 32, style: 'serif' }),
  text('Mappings must survive a backend restart.', 800, 400, 640, 120, s + 1, { size: 32, accent: 'amber' }),
  text('What information must the system remember?', 800, 560, 640, 120, s + 2, { size: 32, accent: 'muted' }),
])

bullets('Question 5: What Constraints Matter?', 'Design constraints: examples', [
  'Must use PostgreSQL', 'Must run on existing company servers', 'Infrastructure budget is limited',
  'Project must be delivered in four weeks', 'Initially, only one application server is available',
], 'ink', (s) => [text('What limitations must our design satisfy?', 800, 300, 640, 160, s, { size: 38, style: 'serif', accent: 'amber' })])

// 30
table('Applying All Five Questions to the URL Shortener', 'Question  —  Our answer', [
  ['What must it do?', 'Create and redirect short URLs'], ['How much load?', 'Assume 10,000 creations/day'],
  ['What can fail?', 'API, database and network'], ['What data persists?', 'Short code and original URL'],
  ['What constraints?', 'PostgreSQL, limited budget and one server'],
], 'amber')

// ── Section 6 ────────────────────────────────────────────────────────────────
section('Putting Everything Together', 'Section 6')

// 31
diagram('Our First System Architecture: Initial HLD', [
  { id: 'client', label: 'Client\nSends requests, displays responses', shape: 'box', icon: 'Globe', accent: 'blue' },
  { id: 'api', label: 'Backend API\nValidation and business logic', shape: 'box', icon: 'Server', accent: 'amber' },
  { id: 'db', label: 'PostgreSQL\nPersistent URL mappings', shape: 'database', accent: 'green' },
], [{ from: 'client', to: 'api', label: 'HTTP request' }, { from: 'api', to: 'db', label: 'database query' }], 'LR', 'node',
'System boundary: the Backend API and PostgreSQL are inside; the client sits outside.')

// 32
bullets('From Problem Statement to System Design', 'Our complete design process', [
  'Understand the product request', 'Identify the system boundary', 'Identify major components', 'Define component responsibilities',
  'Create the HLD', 'Understand the LLD', 'Trace a request end to end', 'Evaluate the five fundamental design questions',
], 'blue')

// 33
bullets('Key Takeaways', 'Remember', [
  'Understand the problem before choosing technologies', 'Define the system boundary', 'Identify components and their responsibilities',
  'Understand the difference between HLD and LLD', 'Follow a request from beginning to end', 'Identify possible failure points',
  'Consider load, persistence and constraints', 'Justify design decisions based on requirements',
], 'green')

// ── Section 7 ────────────────────────────────────────────────────────────────
section('Assignment and Completion', 'Section 7')

// 34
content('Practical Assignment: Design a URL Shortener', [
  list('Task 1: Draw the architecture from memory', ['Client, Backend API, Database', 'Communication arrows', 'System boundary', 'Component responsibilities'], 100, 440, 'blue', 1),
  list('Task 2: Five functional requirements', ['Create short URLs', 'Access short URLs', 'Redirect to original URLs', 'View created links', 'Delete links'], 580, 440, 'green', 5),
  list('Task 3: Five non-functional requirements', ['Low redirect latency', 'High availability', 'No lost URL mappings', 'Handle concurrent requests', 'Secure API access'], 1060, 440, 'amber', 10),
])

// 35
bullets('Episode Completion Check', 'Can you do these without notes?', [
  'Explain what system design is', 'Draw the URL Shortener architecture from memory', 'Define the system boundary',
  "Explain each component's responsibility", 'Differentiate HLD and LLD', 'Explain one request end to end',
  'Identify possible failure modes', 'Compare design alternatives', 'Answer the five fundamental design questions',
  'Write five functional and five non-functional requirements',
], 'amber')

// ── Build ────────────────────────────────────────────────────────────────────
async function main() {
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createMcpServer().connect(a)
  const client = new Client({ name: 'episode1-hld-builder', version: '1.0' })
  await client.connect(b)

  const call = async (name: string, args: Args = {}) => {
    const r: any = await client.callTool({ name, arguments: args })
    const t = r.content?.[0]?.text as string
    if (r.isError) throw new Error(`Tool ${name} failed: ${t}`)
    try { return JSON.parse(t) } catch { return t }
  }

  try { await deleteDeck(deckId) } catch { /* not present */ }
  await call('create_deck', { id: deckId, title: 'Episode 01 — From Problem Statement to System Design', theme: 'midnight', background: 'grid' })

  // create_deck leaves one placeholder section slide; remove it after the first real slide exists.
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i]
    const args = { deck: deckId, ...d.args }
    if (args.eyebrow === undefined) delete args.eyebrow
    // lists that start under an intro text move below it; lists above a footer text stop short of it
    const els: Args[] = args.elements ?? []
    const intro = els.find((e) => e.type === 'text' && e.y === 190 && e.reveal === 0)
    const footer = els.find((e) => e.type === 'text' && e.y >= 740 && e.type === 'text' && els.some((l) => l.type === 'cardList' && l.w === 1300))
    for (const el of els) {
      if (el.type !== 'cardList' || el.y !== 190) continue
      if (intro && intro.h > 0) { el.y = intro.y + intro.h + 10; el.h = 850 - el.y }
      if (footer && el.w === 1300) el.h = footer.y - el.y - 10
    }
    // drop empty-header placeholders
    for (const el of args.elements ?? []) if (el.type === 'cardList' && el.header === '​') el.header = ''
    try {
      await call(d.tool, args)
    } catch (e) {
      throw new Error(`Slide ${i + 1} ("${d.args.title ?? d.args.layout}"): ${(e as Error).message}`)
    }
    if (d.notes) await call('set_speaker_notes', { deck: deckId, slide: i + 2, notes: d.notes })
  }
  await call('delete_slide', { deck: deckId, slide: 1 })

  const outline = await call('get_deck', { deck: deckId })
  console.log(`Built "${outline.id}" with ${outline.slides.length} slides (${outline.theme})`)
  console.log('Edit:   ', outline.edit)
  console.log('Present:', outline.present)

  for (let i = 1; i <= outline.slides.length; i++) {
    const s = outline.slides[i - 1]
    if (s.layout !== 'content' && s.layout !== 'section') continue
    const r = await call('check_slide_layout', { deck: deckId, slide: i })
    const txt = typeof r === 'string' ? r : JSON.stringify(r)
    if (!/no (problems|issues)|ok/i.test(txt)) console.log(`Layout #${i} ${s.title ?? ''}: ${txt}`)
  }
}

main().catch((e) => { console.error('Build failed:', e); process.exit(1) })
