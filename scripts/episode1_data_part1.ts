export interface SlideDef {
  tool: 'add_diagram_slide' | 'add_code_slide' | 'add_sequence_slide' | 'add_comparison_slide' | 'add_slide'
  args: Record<string, any>
  notes: string
}

export const slidesPart1: SlideDef[] = [
  // Slide 02
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'What Are We Going to Learn?',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 's1', label: 'Stage 1: Communication\nClient-Server · HTTP · REST · Stateless', shape: 'box', icon: 'Network', accent: 'blue' },
        { id: 's2', label: 'Stage 2: Data Tier\nPostgreSQL · SQL · Indexes · Pools · ACID', shape: 'box', icon: 'Database', accent: 'green' },
        { id: 's3', label: 'Stage 3: Scalability\nBottlenecks · Scaling · Balancers · Health', shape: 'box', icon: 'Cpu', accent: 'amber' },
        { id: 's4', label: 'Stage 4: Practical Build\nURL Shortener · Validate · Test · Optimize', shape: 'box', icon: 'Layers', accent: 'ink' }
      ],
      edges: [
        { from: 's1', to: 's2' },
        { from: 's2', to: 's3' },
        { from: 's3', to: 's4' }
      ]
    },
    notes: `We organize this episode into four clear progression milestones:
1. Communication: Mastering the wire protocol, HTTP semantics, and stateless interaction.
2. Data Tier: Moving past basic queries into indexes, connection pools, and ACID transactions.
3. Scalability: Identifying system bottlenecks, understanding horizontal scaling, and deploying load balancers.
4. Application: Applying all concepts to engineer a production-ready URL Shortener with TypeScript and PostgreSQL.`
  },

  // Slide 03
  {
    tool: 'add_sequence_slide',
    args: {
      title: 'What Does a Backend Actually Do?',
      actors: ['User', 'Frontend', 'Backend API', 'PostgreSQL'],
      messages: [
        { from: 'User', to: 'Frontend', text: 'Clicks "Create Short URL"', kind: 'request' },
        { from: 'Frontend', to: 'Backend API', text: 'POST /api/v1/urls { url }', kind: 'request' },
        { from: 'Backend API', to: 'Backend API', text: 'Validate URL & compute Base62 code', kind: 'request' },
        { from: 'Backend API', to: 'PostgreSQL', text: 'INSERT INTO urls (code, url)', kind: 'request' },
        { from: 'PostgreSQL', to: 'Backend API', text: 'Row persisted (UUID confirmed)', kind: 'response' },
        { from: 'Backend API', to: 'Frontend', text: '201 Created { shortUrl }', kind: 'response' },
        { from: 'Frontend', to: 'User', text: 'Display short URL & copy button', kind: 'response' }
      ],
      caption: 'The 7 responsibilities: Receive, Validate, Authenticate, Execute Logic, Query Data, Integrate, and Respond.'
    },
    notes: `A backend is not just an API forwarder. It acts as the guardian of domain rules and data integrity:
1. Ingress: Receives structured network requests.
2. Validation: Sanitizes and rejects malformed inputs before touching databases.
3. Security: Authenticates identities and verifies authorization rules.
4. Business Logic: Executes domain rules (e.g., Base62 code generation and expiration calculation).
5. Persistence: Interacts with relational databases using ACID guarantees.
6. Egress: Returns standardized HTTP status codes and serializable representations.`
  },

  // Slide 04
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Understanding the Three Main Components',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'client', label: '1. Client Tier (Browser / Mobile)\nDispatches requests & presents UI', shape: 'box', icon: 'Monitor', accent: 'blue' },
        { id: 'api', label: '2. Backend API Tier (Node / Express)\nEnforces business logic & validation', shape: 'box', icon: 'Server', accent: 'amber' },
        { id: 'db', label: '3. Data Tier (PostgreSQL)\nDurable, consistent, indexed storage', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'client', to: 'api', label: 'HTTP / JSON' },
        { from: 'api', to: 'db', label: 'SQL (Pool)' }
      ]
    },
    notes: `The fundamental three-tier architecture separates concerns:
- Client Tier: Operates in an untrusted environment (browser, smartphone). Focuses on user interaction and rendering.
- Backend API Tier: The trusted computing environment where business rules, access control, and orchestration reside.
- Data Tier: The stateful persistent layer responsible for durability, consistency, and efficient indexed retrieval.
In our URL Shortener: The user visits the client, the API validates the URL and assigns a short code, and PostgreSQL stores the mapping permanently.`
  },

  // Slide 05
  {
    tool: 'add_sequence_slide',
    args: {
      title: 'What Happens When You Open a Website?',
      actors: ['Browser', 'DNS Resolver', 'TLS Server', 'Express Backend'],
      messages: [
        { from: 'Browser', to: 'DNS Resolver', text: 'Resolve domain "sho.rt" to IP', kind: 'request' },
        { from: 'DNS Resolver', to: 'Browser', text: 'A Record: 76.76.21.21', kind: 'response' },
        { from: 'Browser', to: 'TLS Server', text: 'TCP 3-Way Handshake + TLS Client Hello', kind: 'request' },
        { from: 'TLS Server', to: 'Browser', text: 'Certificate Exchange & Session Key Established', kind: 'response' },
        { from: 'Browser', to: 'Express Backend', text: 'GET /aB91xY HTTP/1.1', kind: 'request' },
        { from: 'Express Backend', to: 'Browser', text: '302 Found (Location: https://target.com)', kind: 'response' }
      ],
      caption: 'Complete high-level traversal: DNS resolution -> TCP socket -> TLS encryption -> HTTP request/response.'
    },
    notes: `Before any application code executes, the network stack performs essential handshakes:
1. DNS: Resolves the human-readable domain to an IP address.
2. TCP: Establishes a reliable full-duplex stream via SYN, SYN-ACK, ACK.
3. TLS: Verifies server identity via public certificates and negotiates symmetric encryption keys.
4. HTTP: Transmits plain or multiplexed frames conveying the application request.`
  },

  // Slide 06
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'What Is Client–Server Architecture?',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'web', label: 'Web Application (React)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'mobile', label: 'Mobile Application (iOS/Android)', shape: 'pill', icon: 'Smartphone', accent: 'blue' },
        { id: 'ext', label: 'Browser Extension', shape: 'pill', icon: 'Chrome', accent: 'blue' },
        { id: 'api', label: 'Single Centralized API Server\nUnified Business Logic & Validation', shape: 'box', icon: 'Server', accent: 'amber' },
        { id: 'db', label: 'PostgreSQL Database\nSingle Source of Truth', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'web', to: 'api' },
        { from: 'mobile', to: 'api' },
        { from: 'ext', to: 'api' },
        { from: 'api', to: 'db' }
      ]
    },
    notes: `Client-Server Architecture decouples presentation from data rules.
A single URL Shortener backend serves diverse consumers:
- Desktop Web Apps
- Native Mobile Apps
- Browser Extensions
- Third-party API consumers
Key benefits:
- Centralized validation: Business invariants are enforced once, not duplicated across 4 client codebases.
- Security: Secrets (DB credentials, private keys) remain hidden from untrusted client devices.`
  },

  // Slide 07
  {
    tool: 'add_code_slide',
    args: {
      title: 'Understanding Request and Response',
      code: `// ================= CLIENT HTTP REQUEST =================
POST /api/v1/urls HTTP/1.1
Host: api.sho.rt
Content-Type: application/json
Authorization: Bearer sec_tok_9912

{
  "url": "https://example.com/products/123"
}

// ================= SERVER HTTP RESPONSE =================
HTTP/1.1 201 Created
Content-Type: application/json
X-Request-ID: req_88bf12

{
  "code": "aB91xY",
  "shortUrl": "https://sho.rt/aB91xY"
}`,
      lang: 'typescript',
      size: 24,
      focus: [
        { lines: '1-6', click: 1 },
        { lines: '7-10', click: 2 },
        { lines: '12-16', click: 3 },
        { lines: '17-21', click: 4 }
      ]
    },
    notes: `HTTP is a text-based/binary-framed request-response protocol.
Request Anatomy:
- Method & Path: What action to take on which resource.
- Headers: Metadata (content encoding, authorization token, host).
- Body: Payload conveying the long URL.

Response Anatomy:
- Status Code: Standardized outcome code (201 Created).
- Response Headers: Metadata (Content-Type, correlation Request-ID).
- Response Body: The newly minted short URL entity.`
  },

  // Slide 08
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'HTTP: The Communication Protocol',
      left: {
        header: 'Protocol Evolution',
        items: [
          'HTTP/1.1: Persistent TCP connections & pipelining',
          'HTTP/2: Binary framing, multiplexing over 1 TCP stream',
          'HTTP/3: QUIC over UDP, removes Head-of-Line blocking',
          'Standardized request methods & status codes'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Engineering Reality',
        items: [
          'Protocols improve network transport efficiency',
          'They do NOT fix unindexed database queries',
          'They do NOT prevent connection pool exhaustion',
          'Application scalability depends on backend architecture'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'Transport efficiency != Application scalability. Modern protocols speed up the wire, but architecture scales the system.'
    },
    notes: `HTTP has evolved from 1.1 to 2 and 3 to minimize network latency:
- HTTP/2 multiplexes multiple requests concurrently over a single TCP socket, ending browser connection limits.
- HTTP/3 moves to QUIC/UDP, eliminating TCP head-of-line blocking on packet loss.
CRITICAL LESSON:
Never confuse network transport optimizations with backend application scalability. If your database query takes 4 seconds due to a missing index, HTTP/3 will simply deliver the 4-second delay more efficiently.`
  },

  // Slide 09
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'HTTP Methods and When to Use Them',
      left: {
        header: 'Safe & Idempotent Methods',
        items: [
          'GET: Read resource. Safe & Idempotent. Must not mutate state.',
          'Example: GET /api/v1/urls/aB91xY retrieves link metadata.',
          'PUT: Full replace. Idempotent. Replaces entire link record.',
          'DELETE: Remove resource. Idempotent. Repeating produces same outcome.'
        ],
        accent: 'green'
      },
      right: {
        header: 'Mutating & Partial Methods',
        items: [
          'POST: Create resource. Neither safe nor idempotent.',
          'Example: POST /api/v1/urls generates a new short code.',
          'PATCH: Partial update. May or may not be idempotent.',
          'Example: PATCH /api/v1/urls/:id modifies expiration date.'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'Safe = Does not alter state. Idempotent = Multiple identical requests produce the same server state.'
    },
    notes: `Why method semantics matter:
- GET must never mutate data. If GET created short links, web scrapers and prefetching bots would spam link creations.
- Idempotency ensures clients can safely retry network timeouts without creating duplicate resources.
- PUT replaces the resource representation entirely, whereas PATCH modifies specific attributes.`
  },

  // Slide 10
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'HTTP Status Codes: 301 vs 302 in URL Shorteners',
      left: {
        header: '301 Moved Permanently',
        items: [
          'Browser caches redirect locally in disk cache',
          'Subsequent clicks NEVER hit our backend API',
          'Zero backend visibility after initial redirect',
          'Destroys real-time click tracking & analytics',
          'Very difficult to revoke or update expired links'
        ],
        accent: 'red'
      },
      right: {
        header: '302 Found (Temporary)',
        items: [
          'Browser queries backend on EVERY single click',
          'Enables accurate click counting and analytics',
          'Allows inspecting HTTP referer and user-agent',
          'Lets backend enforce expiration & link deactivation',
          'The correct choice for tracked URL shorteners'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Use 302 Found whenever you need click analytics or dynamic link invalidation.'
    },
    notes: `Interview classic: Why choose 302 over 301 for a URL Shortener?
If you return 301 (Moved Permanently), modern browsers cache the destination URL. Future visits to the short link will skip your servers completely.
With 302 (Found), the browser contacts your server every time, allowing you to log click metrics, increment counters, and verify if the link has expired.`
  },

  // Slide 11
  {
    tool: 'add_code_slide',
    args: {
      title: 'HTTP Headers and Content Types',
      code: `// --- Request Headers ---
POST /api/v1/urls HTTP/1.1
Content-Type: application/json     // Format of request payload
Accept: application/json           // Format client expects back
Authorization: Bearer eyJhbGci...  // Identity credential / token
X-Request-ID: b104-4c91-9a22       // Distributed tracing identifier

// --- Response Headers ---
HTTP/1.1 201 Created
Content-Type: application/json
Cache-Control: no-cache, no-store  // Prevents stale local caching
Location: https://sho.rt/aB91xY    // URI of newly created resource
Retry-After: 60                    // Rate-limiting backoff hint`,
      lang: 'typescript',
      size: 24,
      focus: [
        { lines: '2-5', click: 1 },
        { lines: '8-12', click: 2 }
      ]
    },
    notes: `Headers provide essential contract negotiation:
- Content-Type tells the body parser how to deserialize data (JSON, form-urlencoded).
- Authorization conveys bearer tokens or API keys securely.
- X-Request-ID (correlation ID) travels through all microservices and database queries for end-to-end log tracing.
- Cache-Control instructs CDNs and browsers whether responses can be reused.`
  },

  // Slide 12
  {
    tool: 'add_sequence_slide',
    args: {
      title: 'HTTP Is Stateless: What Does That Mean?',
      actors: ['Client', 'API Instance 1', 'API Instance 2'],
      messages: [
        { from: 'Client', to: 'API Instance 1', text: 'GET /api/v1/profile (Auth: Bearer tok_ABC)', kind: 'request' },
        { from: 'API Instance 1', to: 'Client', text: '200 OK { user: "Alice" }', kind: 'response' },
        { from: 'Client', to: 'API Instance 2', text: 'POST /api/v1/urls (Auth: Bearer tok_ABC)', kind: 'request' },
        { from: 'API Instance 2', to: 'Client', text: '201 Created { shortUrl }', kind: 'response' }
      ],
      caption: 'Every request is self-contained. Instance 2 processes request 2 without knowing Instance 1 handled request 1.'
    },
    notes: `Statelessness means the server retains no session state about the client between requests.
Every single HTTP request must carry all the contextual information needed:
- Authentication credentials (tokens, signatures).
- Payload data.
Because servers don't store client conversational context in local memory, requests can be routed to ANY server instance seamlessly.`
  },

  // Slide 13
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Stateful vs Stateless Applications',
      left: {
        header: 'Stateful Application',
        items: [
          'Session stored in server memory (Node RAM)',
          'Load balancer must use "Sticky Sessions"',
          'If Server A crashes, active users are logged out',
          'Horizontal scaling requires inter-node sync',
          'Deployments disrupt active user sessions'
        ],
        accent: 'muted'
      },
      right: {
        header: 'Stateless Application',
        items: [
          'Session token verified cryptographically or via DB',
          'Load balancer routes freely to any healthy server',
          'Servers can be killed or autoscaled dynamically',
          'Horizontal scaling is trivial: just add instances',
          'Zero-downtime rolling deployments'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Stateless compute + external persistent storage = the prerequisite for horizontal scalability.'
    },
    notes: `Stateless application design does not mean the system has no state!
It means the application compute processes (Express servers) hold zero state in their local heap memory.
Persistent state lives in PostgreSQL. Temporary shared state (rate limits, sessions) lives in Redis.`
  },

  // Slide 14
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'REST API Fundamentals: Nouns vs Verbs',
      left: {
        header: 'RPC Style (Action-Heavy)',
        items: [
          'POST /createShortUrl',
          'POST /getLinkDetails',
          'POST /updateExpirationDate',
          'POST /deleteLinkRecord',
          'Unpredictable custom endpoint naming'
        ],
        accent: 'red'
      },
      right: {
        header: 'RESTful Style (Resource-Oriented)',
        items: [
          'POST /api/v1/urls (Create)',
          'GET /api/v1/urls/:id (Retrieve)',
          'PATCH /api/v1/urls/:id (Update)',
          'DELETE /api/v1/urls/:id (Delete)',
          'Standardized HTTP verbs applied to noun resources'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Resource-oriented URIs combined with standard HTTP verbs create predictable, self-documenting APIs.'
    },
    notes: `REST organizes systems around resources (nouns) rather than procedure calls (verbs).
Key REST principles:
- Predictable URI schemes: collection endpoints (/urls) and member endpoints (/urls/:id).
- Uniform interface: standard HTTP verbs express actions.
- Versioning: prefixing /api/v1 isolates breaking changes from legacy consumers.`
  },

  // Slide 15
  {
    tool: 'add_code_slide',
    args: {
      title: 'Designing a REST API for a URL Shortener',
      code: `// ================= URL SHORTENER REST API SPEC =================
// 1. Create a short link
POST   /api/v1/urls               Body: { url: string, customCode?: string }
                                 201 Created -> { data: { code, shortUrl } }

// 2. Retrieve link metadata & settings
GET    /api/v1/urls/:code         200 OK -> { data: { id, code, originalUrl, ... } }

// 3. Public high-speed redirection (The hot path)
GET    /:code                     302 Found -> Location: https://target.com

// 4. Update link expiration or status
PATCH  /api/v1/urls/:id           Body: { expiresAt?: string, isActive?: boolean }
                                 200 OK -> { data: UrlRecord }

// 5. Deactivate / Delete short link
DELETE /api/v1/urls/:id           204 No Content

// 6. Inspect click analytics
GET    /api/v1/urls/:id/analytics 200 OK -> { data: { clicks, referers: [] } }`,
      lang: 'typescript',
      size: 20,
      focus: [
        { lines: '2-4', click: 1 },
        { lines: '6-7', click: 2 },
        { lines: '9-10', click: 3 },
        { lines: '12-18', click: 4 }
      ]
    },
    notes: `Notice the deliberate separation between:
1. Management APIs (/api/v1/urls): Versioned, authenticated, JSON-based REST endpoints for administration.
2. Public Redirection Route (/:code): Unversioned, lightweight, edge-friendly path optimized purely for minimum latency.`
  },

  // Slide 16
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Anatomy of a Backend Request',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'client', label: 'Client HTTP Request', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'mw', label: '1. Middleware Pipeline\nCORS, JSON Parser, Pino Logger, Rate Limiter', shape: 'box', icon: 'Shield', accent: 'ink' },
        { id: 'router', label: '2. Express Router\nMatches METHOD + URI path (/api/v1/urls)', shape: 'box', icon: 'Workflow', accent: 'ink' },
        { id: 'ctrl', label: '3. Controller Layer\nParses HTTP payload & validates Zod DTO', shape: 'box', icon: 'Layers', accent: 'amber' },
        { id: 'svc', label: '4. Service Layer (Domain Logic)\nBase62 code generation & business invariants', shape: 'box', icon: 'Cpu', accent: 'amber' },
        { id: 'repo', label: '5. Repository Layer\nConstructs SQL queries & talks to connection pool', shape: 'box', icon: 'Database', accent: 'green' },
        { id: 'db', label: '6. PostgreSQL Database\nExecutes query, updates B-tree index, commits row', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'client', to: 'mw' },
        { from: 'mw', to: 'router' },
        { from: 'router', to: 'ctrl' },
        { from: 'ctrl', to: 'svc' },
        { from: 'svc', to: 'repo' },
        { from: 'repo', to: 'db' }
      ]
    },
    notes: `Inside a production Express application, separation of concerns is vital:
- Controller: Knows about HTTP (status codes, headers, req/res objects). Does NOT contain SQL.
- Service: Pure business logic (e.g. hashing, code generation, validation). Agnostic of HTTP.
- Repository: Knows about persistence (SQL queries, transaction blocks, pool connections).`
  },

  // Slide 17
  {
    tool: 'add_code_slide',
    args: {
      title: 'Middleware in Express.js',
      code: `import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { urlRouter } from './routes/urlRouter';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// 1. Global Pre-Processing Pipeline (Execution order is strictly linear)
app.use(pinoHttp());        // Injects correlation ID & logs incoming request
app.use(cors());            // Handles CORS preflight headers
app.use(express.json());    // Parses JSON request body (400 if malformed)

// 2. Route Dispatching
app.use('/api/v1/urls', urlRouter);

// 3. Centralized Error Handler (Must have 4 arguments: err, req, res, next)
app.use(errorHandler);`,
      lang: 'typescript',
      size: 24,
      focus: [
        { lines: '8-12', click: 1 },
        { lines: '14-15', click: 2 },
        { lines: '17-18', click: 3 }
      ]
    },
    notes: `Middleware functions have access to (req, res, next).
Execution order is critical:
- JSON parser must run before routers, or req.body will be undefined.
- Error handling middleware must be placed LAST. Express identifies error handlers by their 4-parameter arity: (err, req, res, next).`
  },

  // Slide 18
  {
    tool: 'add_code_slide',
    args: {
      title: 'Input Validation and Error Handling with Zod',
      code: `import { z } from 'zod';

export const CreateUrlSchema = z.object({
  url: z.string()
    .url('Invalid URL format. Must include http:// or https://')
    .max(2048, 'URL exceeds 2048 maximum characters'),
  customCode: z.string()
    .regex(/^[a-zA-Z0-9_-]{4,12}$/, 'Code must be 4-12 alphanumeric characters')
    .optional(),
  expiresInDays: z.number().int().min(1).max(365).optional()
});

export type CreateUrlDTO = z.infer<typeof CreateUrlSchema>;

// If validation fails, controller returns immediately:
// 422 Unprocessable Content: { error: { code: "VALIDATION_FAILED", message: ... } }`,
      lang: 'typescript',
      size: 24,
      focus: [
        { lines: '3-11', click: 1 },
        { lines: '13-16', click: 2 }
      ]
    },
    notes: `Never trust client-side validation!
Frontend validation is purely for user experience (immediate feedback). Attackers can bypass the frontend using curl or Postman in 2 seconds.
Backend validation is mandatory for application stability, buffer overflow prevention, and SQL injection prevention.`
  },

  // Slide 19
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'API Response Design: Predictable Envelopes',
      left: {
        header: 'Predictable Success (201 Created)',
        items: [
          '201 Created with standard { data } envelope',
          'id: "c9f8-4b2a" (internal UUID identifier)',
          'code: "aB91xY" (short identifier representation)',
          'shortUrl: "https://sho.rt/aB91xY"',
          'meta.requestId: "req_01j" (trace correlation)',
          'Consistent shape across all collection and item endpoints'
        ],
        accent: 'green'
      },
      right: {
        header: 'Structured Error (404 / 422)',
        items: [
          '404 / 422 with standard { error } envelope',
          'error.code: "URL_NOT_FOUND" (machine-readable constant)',
          'error.message: Human-friendly explanation string',
          'error.details: Specific field-level validation errors',
          'meta.requestId: Included for debugging & customer support',
          'Never leak internal stack traces or raw SQL errors'
        ],
        accent: 'red'
      },
      alternate: true,
      footer: 'Standard JSON envelopes make client consumption predictable and prevent leaking internal implementation details.'
    },
    notes: `Clean API response design principles:
1. Envelope pattern: Wrapping responses in { data } and { error } makes client parsing unambiguous.
2. Machine-readable error codes: Use string constants like 'URL_NOT_FOUND' rather than expecting frontend apps to regex English error strings.
3. Observability: Include correlation requestId in meta headers for instant log lookup.`
  },

  // Slide 20
  {
    tool: 'add_sequence_slide',
    args: {
      title: 'Complete URL Creation Request Flow',
      actors: ['User', 'Frontend', 'Express API', 'URL Service', 'PostgreSQL'],
      messages: [
        { from: 'User', to: 'Frontend', text: 'Submits long URL into input box', kind: 'request' },
        { from: 'Frontend', to: 'Express API', text: 'POST /api/v1/urls { url }', kind: 'request' },
        { from: 'Express API', to: 'Express API', text: 'Middleware validates Zod schema', kind: 'request' },
        { from: 'Express API', to: 'URL Service', text: 'createShortUrl({ url })', kind: 'request' },
        { from: 'URL Service', to: 'URL Service', text: 'Compute Base62 short code', kind: 'request' },
        { from: 'URL Service', to: 'PostgreSQL', text: 'INSERT INTO urls (code, url)...', kind: 'request' },
        { from: 'PostgreSQL', to: 'URL Service', text: 'Row inserted (UUID generated)', kind: 'response' },
        { from: 'URL Service', to: 'Express API', text: 'Return UrlRecord entity DTO', kind: 'response' },
        { from: 'Express API', to: 'Frontend', text: '201 Created { shortUrl }', kind: 'response' },
        { from: 'Frontend', to: 'User', text: 'Display short link & QR code', kind: 'response' }
      ],
      caption: 'End-to-end URL creation flow connecting client interaction, layered compute, and relational persistence.'
    },
    notes: `This sequence diagram integrates everything from Section 3:
1. Client initiates HTTP transaction.
2. Middleware parses JSON and logs requestId.
3. Controller validates input types.
4. Service creates Base62 hash.
5. Repository executes transactional insert.
6. DB ensures uniqueness constraint.
7. 201 Created returns short URL.`
  },

  // Slide 21
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Why Does a Backend Need a Database?',
      left: {
        header: 'In-Memory Storage (RAM / Map)',
        items: [
          'const urlMap = new Map<string, string>()',
          'Server restart or crash wipes 100% of links',
          'Multiple server instances cannot share memory',
          'RAM capacity is limited and expensive',
          'Zero durability or ACID recovery guarantees'
        ],
        accent: 'red'
      },
      right: {
        header: 'Persistent Relational DB (PostgreSQL)',
        items: [
          'Data written to non-volatile disk & WAL logs',
          'Survives process crashes, OS reboots, power cuts',
          'Multiple API instances query single shared store',
          'B-Tree indexes enable sub-millisecond lookups',
          'ACID transaction safety guarantees'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Compute processes are transient and disposable; databases provide durability and shared state.'
    },
    notes: `Why in-memory maps fail in production:
1. Volatility: Node.js process restarts (for deployments, memory leaks, uncaught exceptions) destroy in-memory objects.
2. Concurrency: Two Node instances cannot read each other's heap memory without complex distributed cache synchronization.
3. Capacity: Server RAM is expensive; disk storage is cheap and durable.`
  },

  // Slide 22
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Understanding Relational Databases',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'db', label: 'Database\nLogical namespace & catalog', shape: 'database', icon: 'Database', accent: 'green' },
        { id: 'table', label: 'Table (Entity)\ne.g. "urls" collection', shape: 'box', icon: 'Table', accent: 'blue' },
        { id: 'cols', label: 'Columns (Attributes)\nid, code, original_url, created_at', shape: 'box', icon: 'Columns', accent: 'amber' },
        { id: 'rows', label: 'Rows (Records)\nIndividual short link instances', shape: 'box', icon: 'List', accent: 'ink' },
        { id: 'constraints', label: 'Integrity Constraints\nPRIMARY KEY, UNIQUE, NOT NULL', shape: 'pill', icon: 'Shield', accent: 'green' }
      ],
      edges: [
        { from: 'db', to: 'table' },
        { from: 'table', to: 'cols' },
        { from: 'table', to: 'rows' },
        { from: 'cols', to: 'constraints' }
      ]
    },
    notes: `Relational databases structure data in typed tables with formal schemas:
- Tables correspond to business entities.
- Columns represent strongly typed attributes.
- Rows represent individual records.
- Constraints guarantee invariants directly at the storage engine level, preventing corrupt data.`
  },

  // Slide 23
  {
    tool: 'add_code_slide',
    args: {
      title: 'Introduction to SQL: CRUD Operations',
      code: `-- 1. CREATE / INSERT (Write Path)
INSERT INTO urls (id, code, original_url, created_at)
VALUES (gen_random_uuid(), 'aB91xY', 'https://example.com/item', NOW());

-- 2. READ / SELECT (Critical Hot Path - 95% of traffic)
SELECT original_url FROM urls
WHERE code = 'aB91xY' AND is_active = true;

-- 3. UPDATE (Modify expiration or destination)
UPDATE urls SET expires_at = NOW() + INTERVAL '30 days'
WHERE code = 'aB91xY';

-- 4. DELETE (Soft delete preferred in production)
UPDATE urls SET is_active = false WHERE code = 'aB91xY';
-- Hard delete: DELETE FROM urls WHERE id = 'c9f8-4b2a';`,
      lang: 'sql',
      size: 24,
      focus: [
        { lines: '1-3', click: 1 },
        { lines: '5-7', click: 2 },
        { lines: '9-11', click: 3 },
        { lines: '13-16', click: 4 }
      ]
    },
    notes: `The fundamental database manipulation language:
- INSERT creates records.
- SELECT handles retrieval. In URL Shorteners, SELECT represents >95% of database workload.
- UPDATE modifies attributes.
- Tip: In production, favor soft deletes (setting is_active = false) over hard DELETEs to preserve referential integrity and audit trails.`
  },

  // Slide 24
  {
    tool: 'add_code_slide',
    args: {
      title: 'Database Schema Design for URL Shortener',
      code: `CREATE TABLE urls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(12) NOT NULL UNIQUE,       -- Short identifier (e.g. 'aB91xY')
  original_url TEXT NOT NULL,                     -- Target destination URL
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- Creation timestamp
  expires_at   TIMESTAMPTZ,                       -- Nullable: null = never expires
  is_active    BOOLEAN NOT NULL DEFAULT TRUE      -- Soft-delete flag
);

CREATE TABLE url_analytics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id       UUID NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  clicked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address   VARCHAR(45),                       -- IPv4 (15 chars) or IPv6 (45 chars)
  user_agent   TEXT
);`,
      lang: 'sql',
      size: 22,
      focus: [
        { lines: '1-8', click: 1 },
        { lines: '10-16', click: 2 }
      ]
    },
    notes: `Schema rationale:
- UUID vs Serial: UUIDs avoid predictable enumeration attacks and scale across distributed nodes.
- VARCHAR(12) UNIQUE: Guarantees no two URLs share a short code.
- TEXT for original_url: URLs can be thousands of characters long; arbitrary VARCHAR(255) limits cause errors.
- TIMESTAMPTZ: Always store timezone-aware timestamps.`
  }
]
