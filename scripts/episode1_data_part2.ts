import type { SlideDef } from './episode1_data_part1'

export const slidesPart2: SlideDef[] = [
  // Slide 25
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Primary Keys, Unique Constraints and Foreign Keys',
      left: {
        header: 'Application-Level Check (Flawed)',
        items: [
          'const exists = await db.find({ code })',
          'if (exists) throw new Error("Duplicate!")',
          'await db.insert({ code, url })',
          'CRITICAL RACE CONDITION under concurrency:',
          'Two requests check at same millisecond',
          'Both see "no duplicate" and both insert!'
        ],
        accent: 'red'
      },
      right: {
        header: 'Database Constraints (Robust)',
        items: [
          'CONSTRAINT uq_code UNIQUE (code)',
          'Enforced atomically via unique B-tree index',
          'DB rejects concurrent duplicates with error 23505',
          'FOREIGN KEY ensures analytics point to real URLs',
          'Referential integrity maintained at hardware tier'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Application-level uniqueness checks fail under high concurrency. Database constraints are non-negotiable.'
    },
    notes: `Why application-level checks fail:
In concurrent web servers, two requests can execute SELECT at the exact same millisecond. Both see that code 'aB91' is free, and both proceed to INSERT.
Only the database engine—using page-level latches and unique B-tree constraints—can guarantee atomicity under parallel writes.`
  },

  // Slide 26
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Database Indexes: Sequential Scan vs B-Tree',
      left: {
        header: 'Sequential Scan (No Index)',
        items: [
          'Database reads every disk page row-by-row',
          'Time Complexity: O(N) linear scan',
          'With 1,000,000 rows: ~1,000,000 checks',
          'Massive disk I/O, CPU saturation, query latency',
          'Query time grows with every link created'
        ],
        accent: 'red'
      },
      right: {
        header: 'B-Tree Index Scan (Index on code)',
        items: [
          'Balanced search tree ordered by short code',
          'Time Complexity: O(log N) logarithmic lookup',
          'With 1,000,000 rows: ~3-4 page reads only!',
          'Sub-millisecond query execution (0.2ms vs 350ms)',
          'Enables hundreds of redirect lookups per second'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Without an index on "code", a URL shortener degrades rapidly as data accumulates.'
    },
    notes: `B-tree index fundamentals:
Without an index on the 'code' column, PostgreSQL must read every table block from disk into memory (Sequential Scan).
With a B-tree index, PostgreSQL traverses a shallow tree hierarchy in O(log N) steps.
For 10 million rows, a B-tree of depth 3 requires only 3-4 page lookups to locate the exact disk pointer.`
  },

  // Slide 27
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Types of Database Indexes in PostgreSQL',
      left: {
        header: 'Common Index Types',
        items: [
          'B-Tree (Default): Equality & range (=, <, >, BETWEEN). Ideal for short code lookups.',
          'Hash: Equality lookups only (=). Slightly faster, no range or sorting.',
          'GIN (Generalized Inverted): Arrays, JSONB documents, full-text search.',
          'BRIN: Block Range Index for massive append-only timeseries.'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Index Trade-offs & Rules',
        items: [
          'Indexes are NOT free: every write must update index',
          'Consumes extra RAM (working set) and disk storage',
          'Do NOT index low-cardinality flags (e.g. is_active alone)',
          'Composite index: (code, is_active) allows index-only scan',
          'Measure query plans with EXPLAIN ANALYZE before adding'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'Indexes trade write latency and disk space for dramatic read performance gains.'
    },
    notes: `PostgreSQL index types overview:
- B-tree: The workhorse. Always use for primary keys and unique identifiers.
- Composite indexes: If you always query WHERE code = ? AND is_active = true, an index on (code, is_active) allows PostgreSQL to satisfy the query entirely from index memory without touching table heap pages (Index-Only Scan).`
  },

  // Slide 28
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Database Transactions and ACID Properties',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'begin', label: 'BEGIN Transaction', shape: 'pill', icon: 'Play', accent: 'blue' },
        { id: 'q1', label: '1. INSERT INTO urls (id, code, url)', shape: 'box', accent: 'ink' },
        { id: 'q2', label: '2. INSERT INTO url_metadata (url_id, campaign)', shape: 'box', accent: 'ink' },
        { id: 'check', label: 'Did both queries succeed without errors?', shape: 'decision', accent: 'amber' },
        { id: 'commit', label: 'COMMIT\nAll changes written durably to WAL', shape: 'pill', icon: 'CheckCircle', accent: 'green' },
        { id: 'rollback', label: 'ROLLBACK\nZero partial changes saved to disk', shape: 'pill', icon: 'AlertCircle', accent: 'red' }
      ],
      edges: [
        { from: 'begin', to: 'q1' },
        { from: 'q1', to: 'q2' },
        { from: 'q2', to: 'check' },
        { from: 'check', to: 'commit', label: 'Success' },
        { from: 'check', to: 'rollback', label: 'Error' }
      ]
    },
    notes: `ACID guarantees:
- Atomicity: All or nothing. If step 2 fails, step 1 is rolled back completely.
- Consistency: Constraints (FK, UNIQUE) remain valid before and after transaction.
- Isolation: Concurrent transactions do not observe partial intermediate states.
- Durability: Committed writes are flushed to the Write-Ahead Log (WAL) and survive power loss.`
  },

  // Slide 29
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Database Connection Pooling',
      left: {
        header: 'Without Connection Pool',
        items: [
          'New TCP handshake + TLS negotiation on every query',
          'PostgreSQL forks a backend process per connection (~10MB RAM)',
          '500 concurrent HTTP requests = 500 DB processes',
          'Database memory exhausts and crashes under load',
          'Connection setup latency adds 20-50ms to every request'
        ],
        accent: 'red'
      },
      right: {
        header: 'With Connection Pool (pg.Pool / PgBouncer)',
        items: [
          'Pool maintains e.g. 20 warm persistent connections',
          'Requests checkout connection, run query, return immediately',
          'Postgres runs at optimal concurrency without thrashing',
          'Excess requests queue cleanly in memory during spikes',
          'Sub-millisecond query dispatch without handshake overhead'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Connection pooling prevents process explosion and allows a modest database to serve massive traffic.'
    },
    notes: `PostgreSQL connection architecture:
Postgres uses a process-per-connection model. Creating a new connection requires forking a Unix process, allocating memory buffers, and establishing credentials.
Connection pooling formula:
Pool size = ((Core Count * 2) + Disk Spindle Count).
A pool of 20-30 connections can easily saturate a 16-core database server with optimal query throughput.`
  },

  // Slide 30
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Our Technology Stack and Architectural Layers',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'lang', label: 'Application Language: TypeScript\nStatic typing, compile-time safety, auto-complete', shape: 'box', icon: 'Code', accent: 'blue' },
        { id: 'runtime', label: 'Runtime: Node.js (V8 Engine)\nAsynchronous, non-blocking event-driven I/O', shape: 'box', icon: 'Cpu', accent: 'green' },
        { id: 'web', label: 'HTTP Framework: Express.js\nBattle-tested routing and middleware pipeline', shape: 'box', icon: 'Server', accent: 'amber' },
        { id: 'db', label: 'Database: PostgreSQL\nACID-compliant relational engine with B-tree indexing', shape: 'database', icon: 'Database', accent: 'green' },
        { id: 'tools', label: 'Ecosystem: Prisma / pg + Zod + Pino + Vitest\nType-safe SQL queries, schema validation, structured logs', shape: 'box', icon: 'Layers', accent: 'ink' }
      ],
      edges: [
        { from: 'lang', to: 'runtime' },
        { from: 'runtime', to: 'web' },
        { from: 'web', to: 'db' },
        { from: 'db', to: 'tools' }
      ]
    },
    notes: `Technology choices justified:
- TypeScript: Prevents runtime type errors and ensures clear interface boundaries between controllers, services, and repositories.
- Node.js: Event loop handles high-concurrency I/O (database queries, network requests) with low memory overhead.
- PostgreSQL: The gold standard for ACID relational integrity and rich indexing.
- Zod: Type-safe runtime parsing at the API boundary.`
  },

  // Slide 31
  {
    tool: 'add_code_slide',
    args: {
      title: 'Project Architecture and Folder Structure',
      code: `src/
├── config/        # Environment variables, database connection strings
├── routes/        # Express router declarations (URL mapping)
├── controllers/   # HTTP controllers (req/res parsing, status codes)
├── services/      # Core business logic (Base62 hashing, expiration rules)
├── repositories/  # Database access layer (SQL queries, pool interactions)
├── middleware/    # Auth, logging (Pino), error handling, rate limiting
├── schemas/       # Zod validation schemas and DTO types
├── lib/           # Utility helpers (Base62 encoder, time functions)
├── types/         # Domain entity interfaces and TypeScript models
└── server.ts      # Express application bootstrap & port listener`,
      lang: 'typescript',
      size: 24,
      focus: [
        { lines: '2-5', click: 1 },
        { lines: '6-9', click: 2 },
        { lines: '10-12', click: 3 }
      ]
    },
    notes: `Clean monolithic layering:
- Routes: Purely map HTTP paths to controllers.
- Controllers: Handle status codes, cookies, and HTTP headers.
- Services: Domain logic independent of Express. Can be unit tested without spinning up an HTTP server.
- Repositories: Encapsulate all raw SQL and ORM queries.`
  },

  // Slide 32
  {
    tool: 'add_code_slide',
    args: {
      title: 'Designing the First API: Create Short URL',
      code: `// --- Controller Layer ---
export async function createUrlController(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = CreateUrlSchema.parse(req.body); // 1. Validate payload
    const result = await urlService.createShortUrl(dto); // 2. Call service
    return res.status(201).json({ data: result }); // 3. 201 Created
  } catch (err) {
    next(err); // 4. Forward to global error handler
  }
}

// --- Service Layer ---
export class UrlService {
  async createShortUrl({ url, customCode }: CreateUrlDTO) {
    const code = customCode ?? generateBase62Code();
    const record = await this.urlRepo.insert({ code, originalUrl: url });
    return { id: record.id, code: record.code, shortUrl: \`\${BASE_URL}/\${record.code}\` };
  }
}`,
      lang: 'typescript',
      size: 22,
      focus: [
        { lines: '2-9', click: 1 },
        { lines: '12-19', click: 2 }
      ]
    },
    notes: `Walkthrough of the creation API:
1. Controller parses and validates input using Zod. Any syntax or URL errors throw immediately.
2. Service generates unique code and coordinates with the repository.
3. Controller wraps result in standard { data } envelope and returns 201 Created.`
  },

  // Slide 33
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'How Do We Generate a Unique Short Code?',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'counter', label: '1. Integer ID / Counter\ne.g. 125,307,184', shape: 'pill', icon: 'Hash', accent: 'blue' },
        { id: 'base62', label: '2. Base62 Algorithm\nAlphabet: [0-9, a-z, A-Z]\n(62 distinct chars)', shape: 'box', icon: 'Code', accent: 'amber' },
        { id: 'code', label: '3. Short Code Output\ne.g. "aB91xY" (6 chars)\n62^6 = 56.8 Billion links', shape: 'box', icon: 'CheckCircle', accent: 'green' },
        { id: 'retry', label: '4. Collision Handler\nIf code exists in DB, retry\nor increment offset', shape: 'decision', icon: 'RefreshCw', accent: 'ink' }
      ],
      edges: [
        { from: 'counter', to: 'base62' },
        { from: 'base62', to: 'code' },
        { from: 'code', to: 'retry' }
      ]
    },
    notes: `Why Base62?
Base62 uses [0-9, a-z, A-Z]. Unlike Base64, it contains no symbols ('+', '/', '=') that require URL encoding.
Math capacity:
- 6 characters: 62^6 = ~56.8 Billion unique URLs.
- 7 characters: 62^7 = ~3.5 Trillion unique URLs.
Sequential IDs vs Random:
Sequential IDs produce predictable links (vulnerable to link scraping). We hash or randomize the seed ID to avoid enumeration attacks.`
  },

  // Slide 34
  {
    tool: 'add_sequence_slide',
    args: {
      title: 'URL Redirection: The Most Important Read Path',
      actors: ['User Browser', 'Express Backend', 'PostgreSQL DB'],
      messages: [
        { from: 'User Browser', to: 'Express Backend', text: 'GET /aB91xY HTTP/1.1', kind: 'request' },
        { from: 'Express Backend', to: 'PostgreSQL DB', text: 'SELECT original_url FROM urls WHERE code=\'aB91xY\' AND is_active=true', kind: 'request' },
        { from: 'PostgreSQL DB', to: 'Express Backend', text: 'Row found: "https://example.com/products/123"', kind: 'response' },
        { from: 'Express Backend', to: 'User Browser', text: 'HTTP/1.1 302 Found (Location: https://example.com/products/123)', kind: 'response' },
        { from: 'User Browser', to: 'User Browser', text: 'Browser navigates to destination URL', kind: 'response' }
      ],
      caption: 'The critical read path: B-Tree index lookup -> 302 Found -> Location header redirect.'
    },
    notes: `The redirection read path handles >95% of total system traffic.
Steps:
1. Browser requests short code.
2. Backend queries PostgreSQL using indexed 'code' column.
3. Backend checks if link is active and unexpired.
4. Returns 302 Found with Location header pointing to destination.`
  },

  // Slide 35
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'What Does Our First Working Backend Look Like? (V1)',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'clients', label: 'Client Applications (Web & Mobile)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'api', label: 'Express API Server (1 Node Instance)\nRouting, Zod Validation, Base62 Generation', shape: 'box', icon: 'Server', accent: 'amber' },
        { id: 'pool', label: 'In-Process Connection Pool (pg.Pool)\nReuses 10-20 active connections', shape: 'box', icon: 'Layers', accent: 'ink' },
        { id: 'db', label: 'PostgreSQL Database (Primary)\nDurable table storage & B-Tree indexes', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'clients', to: 'api', label: 'HTTP / JSON' },
        { from: 'api', to: 'pool' },
        { from: 'pool', to: 'db', label: 'SQL' }
      ]
    },
    notes: `Stage 1 Architecture Summary:
We now have a fully working, robust MVP:
- Structured Express backend with clean layered code.
- Input validation via Zod.
- Persistent PostgreSQL storage with B-Tree indexes and connection pooling.
Limitations of V1:
- Single Point of Failure (SPOF): If the Node process crashes, all traffic drops.
- Hardware Ceiling: Bounded by 1 CPU core for the Node.js event loop.`
  },

  // Slide 36
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'What Does Scalability Actually Mean?',
      left: {
        header: 'The Core Scalability Metrics',
        items: [
          'Throughput: Number of requests processed per second (RPS / QPS).',
          'Latency: Time taken to fulfill a single request (measured in ms).',
          'Concurrency: Number of requests handled simultaneously in-flight.',
          'Scalability: The ability to increase throughput proportionally by adding resources.'
        ],
        accent: 'blue'
      },
      right: {
        header: 'The Engineering Relationship',
        items: [
          'High throughput without low latency is a broken system',
          'Averages lie! Always track P50, P95, and P99 percentiles',
          'P99 of 200ms means 1 in 100 users experiences 200ms delay',
          'Little\'s Law: Concurrency = Throughput x Latency'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'True scalability means latency remains bounded as throughput multiplies.'
    },
    notes: `Definitions matter:
- Throughput: Volume of work completed over time.
- Latency: Duration of a single operation.
- Little's Law: L = λ x W (Concurrent requests = Arrival rate x Average latency).
If your API handles 1,000 RPS and each query takes 100ms (0.1s), you have 100 requests concurrent in-flight at any given millisecond.`
  },

  // Slide 37
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Understanding System Bottlenecks',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'net', label: '1. Network I/O\nBandwidth saturation & TCP connection limits', shape: 'box', icon: 'Network', accent: 'muted' },
        { id: 'cpu', label: '2. CPU Saturation\nJSON parsing, cryptographic hashing, SSL', shape: 'box', icon: 'Cpu', accent: 'amber' },
        { id: 'mem', label: '3. Memory Leaks\nUnbounded heap buffers, event listener leaks', shape: 'box', icon: 'HardDrive', accent: 'amber' },
        { id: 'pool', label: '4. Pool Exhaustion\nAll DB connections occupied by slow queries', shape: 'box', icon: 'Layers', accent: 'red' },
        { id: 'db', label: '5. Disk I/O & Locks\nTable locks, unindexed queries, disk queue', shape: 'database', icon: 'Database', accent: 'red' }
      ],
      edges: [
        { from: 'net', to: 'cpu' },
        { from: 'cpu', to: 'mem' },
        { from: 'mem', to: 'pool' },
        { from: 'pool', to: 'db' }
      ]
    },
    notes: `Goldratt's Theory of Constraints:
A system is only as fast as its primary bottleneck.
If your database is bottlenecked on disk I/O, upgrading your Node.js CPU or adding 10 Express instances will not speed up the system; it will simply queue more requests at the database and trigger an outage.`
  },

  // Slide 38
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Vertical Scaling (Scale Up)',
      left: {
        header: 'How It Works & Advantages',
        items: [
          'Upgrade the existing server machine to larger specs',
          'Example: 2 vCPU / 4 GB RAM -> 32 vCPU / 128 GB RAM',
          'Zero architectural refactoring required',
          'No distributed systems complexity (no split-brain)',
          'Often the fastest and most cost-effective first step'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Hard Limitations & Risks',
        items: [
          'Hardware Ceiling: You cannot purchase infinite CPU or RAM',
          'Exponential cost curves for top-tier cloud instances',
          'Single Point of Failure: The server is still 1 machine',
          'Downtime often required for hardware resizing',
          'Diminishing returns on multi-core scaling'
        ],
        accent: 'red'
      },
      alternate: true,
      footer: 'Vertical scaling buys time and simplicity, but cannot provide high availability or infinite growth.'
    },
    notes: `Vertical scaling (scaling up) means replacing your server with a bigger machine.
Pros:
- Monolithic code continues running unchanged.
- No network serialization overhead between distributed nodes.
Cons:
- Single Point of Failure (SPOF) remains unresolved.
- There is an absolute physical hardware ceiling.`
  },

  // Slide 39
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Horizontal Scaling (Scale Out)',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'clients', label: 'Incoming User Traffic (Web & Mobile)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'lb', label: 'Load Balancer (Reverse Proxy)\nDistributes incoming connections', shape: 'box', icon: 'Network', accent: 'amber' },
        { id: 'api1', label: 'API Instance 1\n(Stateless)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'api2', label: 'API Instance 2\n(Stateless)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'api3', label: 'API Instance 3\n(Stateless)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'db', label: 'Shared PostgreSQL Database (Stateful Data Tier)', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'clients', to: 'lb' },
        { from: 'lb', to: 'api1' },
        { from: 'lb', to: 'api2' },
        { from: 'lb', to: 'api3' },
        { from: 'api1', to: 'db' },
        { from: 'api2', to: 'db' },
        { from: 'api3', to: 'db' }
      ]
    },
    notes: `Horizontal scaling (scaling out) adds more commodity server instances in parallel behind a load balancer.
Requirements:
- Stateless compute: Any server can handle any request.
- Centralized data tier: All instances connect to the same PostgreSQL database.`
  },

  // Slide 40
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Vertical vs Horizontal Scaling: Architectural Comparison',
      left: {
        header: 'Vertical Scaling (Scale Up)',
        items: [
          'Mechanism: Upgrade machine hardware specs',
          'Complexity: Minimal initial complexity',
          'Upper Bound: Hard hardware limits (e.g. 128 cores)',
          'Fault Tolerance: Single Point of Failure',
          'Cost: Becomes exponentially expensive at high tiers',
          'State: Simple (local in-memory state works)'
        ],
        accent: 'muted'
      },
      right: {
        header: 'Horizontal Scaling (Scale Out)',
        items: [
          'Mechanism: Add multiple parallel instances',
          'Complexity: Higher (Load Balancer, monitoring)',
          'Upper Bound: Practically unbounded for compute tier',
          'Fault Tolerance: High (N-1 redundancy & autoscaling)',
          'Cost: Scales linearly with commodity instances',
          'State: Requires strictly stateless application design'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Real-world architecture combines both: scale stateless compute horizontally; size database hardware vertically.'
    },
    notes: `Comparative summary:
- In production, modern architectures scale stateless application tiers horizontally (running 5, 10, 50 containers behind an ALB) while scaling the relational database vertically (upgrading RDS/Aurora instance classes) until read replicas or sharding become mandatory.`
  },

  // Slide 41
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Why Do We Need a Load Balancer?',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'traffic', label: 'Public Internet Traffic\n(Tens of thousands of concurrent users)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'lb', label: 'Load Balancer (ALB / Nginx / HAProxy)\n1. Traffic Distribution\n2. Health Check Eviction\n3. TLS Termination\n4. DDOS Shielding', shape: 'box', icon: 'Shield', accent: 'amber' },
        { id: 'backends', label: 'Private Backend Cluster (VPC)\nAPI Instance 1 · API Instance 2 · API Instance 3', shape: 'box', icon: 'Server', accent: 'green' }
      ],
      edges: [
        { from: 'traffic', to: 'lb', label: 'HTTPS (Port 443)' },
        { from: 'lb', to: 'backends', label: 'HTTP (Private VPC)' }
      ]
    },
    notes: `Functions of a Load Balancer:
1. Routing: Distributes incoming requests across the pool of backends.
2. Health-aware routing: Removes crashed or dead instances from rotation automatically.
3. TLS Termination: Handles expensive cryptographic SSL handshakes, freeing backend CPU for business logic.
4. Security: Shields backend instances inside private subnets without public IP exposure.`
  },

  // Slide 42
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Load Balancing Algorithms',
      left: {
        header: 'Sequential & Connection-Based',
        items: [
          'Round Robin: Distributes requests sequentially 1 -> 2 -> 3 -> 1. Best for uniform workloads.',
          'Weighted Round Robin: Assigns more traffic to instances with larger CPU/RAM capacities.',
          'Least Connections: Directs new requests to the instance with fewest active connections. Best for long requests.'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Hashing & Hash Rings',
        items: [
          'IP Hash: Hashes client IP to assign client to consistent server. Beware of corporate proxy hot-spots.',
          'Consistent Hashing: Minimizes cache invalidation when servers are added or removed.',
          'URL Hash: Routes requests based on short code path to optimize local cache hits.'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'For stateless REST APIs, Round Robin or Least Connections are the industry standards.'
    },
    notes: `Choosing an algorithm:
- Least Connections is optimal when requests have variable processing times (e.g. quick redirects vs heavy analytics queries).
- Round Robin is simple and effective when requests are uniform and fast.`
  },

  // Slide 43
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Health Checks and High Availability',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'probe', label: 'Load Balancer Periodic Health Probe\n(Every 5 seconds)', shape: 'pill', icon: 'Activity', accent: 'blue' },
        { id: 'live', label: 'GET /health (Liveness Probe)\nIs Node.js process alive & event loop unblocked?', shape: 'box', icon: 'CheckCircle', accent: 'green' },
        { id: 'ready', label: 'GET /ready (Readiness Probe)\nCan server checkout connection from DB pool?', shape: 'decision', icon: 'Database', accent: 'amber' },
        { id: 'pass', label: 'Healthy: Keep in active rotation', shape: 'pill', icon: 'CheckCircle', accent: 'green' },
        { id: 'fail', label: 'Unhealthy: Evict from traffic immediately\n(No 502 Bad Gateways to users!)', shape: 'pill', icon: 'AlertCircle', accent: 'red' }
      ],
      edges: [
        { from: 'probe', to: 'live' },
        { from: 'live', to: 'ready' },
        { from: 'ready', to: 'pass', label: '200 OK' },
        { from: 'ready', to: 'fail', label: '500 / Timeout' }
      ]
    },
    notes: `Liveness vs Readiness:
- Liveness (/health): Verifies process vitality. If this fails, the container orchestrator (Kubernetes / ECS) restarts the container.
- Readiness (/ready): Verifies ability to serve traffic (checks DB connection pool). If this fails, the Load Balancer stops routing user requests to this instance until it recovers, preventing user-facing 500 errors.`
  },

  // Slide 44
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Why Do We Need Capacity Estimation?',
      left: {
        header: 'Engineering Purpose',
        items: [
          'Identify the primary system bottleneck before writing code',
          'Determine storage sizing for 1-5 year projections',
          'Calculate expected network egress bandwidth and costs',
          'Size the database connection pool appropriately',
          'Establish latency SLAs and availability SLOs'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Avoiding Architecture Traps',
        items: [
          'Prevents Overengineering: Don\'t build Kafka + Cassandra for 2 requests/sec!',
          'Prevents Underengineering: Don\'t run 100M rows on unindexed SQLite',
          'Back-of-the-envelope calculations ground design in empirical physics',
          'Every architectural component must justify its existence with numbers'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Capacity estimation is not fortune-telling; it is bounding the problem to select the simplest working architecture.'
    },
    notes: `Why do interviewers ask for back-of-the-envelope math?
Because engineers who skip estimation build microservice monsters for workloads that a single $10/month VPS could handle with ease.`
  },

  // Slide 45
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Estimating Daily URL Creation (Write Traffic)',
      left: {
        header: 'Write Workload Calculation',
        items: [
          'Assume: 100,000 new short URLs created per day',
          'Seconds in 24 hours: 24 x 60 x 60 = 86,400 seconds',
          'Formula: 100,000 URLs / 86,400 seconds',
          'Average Write RPS: ~1.16 requests / second'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Engineering Reality Check',
        items: [
          '1.16 writes/sec is extremely lightweight traffic',
          'A single Node.js Express instance handles ~1,500 req/sec',
          'PostgreSQL easily commits 500+ ACID writes/sec on SSDs',
          'Conclusion: NO distributed queues or Kafka needed for writes!'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Always compute average writes/sec before designing complex asynchronous write queues.'
    },
    notes: `100,000 URLs created per day equals just 1.16 writes per second!
Many junior engineers immediately propose Kafka, RabbitMQ, and distributed write buffers for this load.
In reality, a basic single-node PostgreSQL instance handles 1.16 writes per second in its sleep.`
  },

  // Slide 46
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Read and Write Traffic Estimation',
      left: {
        header: 'Read Workload Calculation',
        items: [
          'Assume 20 redirects per short link on average',
          'Daily Reads: 100,000 x 20 = 2,000,000 redirects / day',
          'Formula: 2,000,000 reads / 86,400 seconds',
          'Average Read RPS: ~23.15 requests / second',
          'Read:Write Ratio = 20 : 1'
        ],
        accent: 'blue'
      },
      right: {
        header: 'System Design Implications',
        items: [
          'URL Shorteners are overwhelmingly READ-HEAVY (95% reads)',
          'Read path must be optimized for sub-millisecond latency',
          'Reads need B-tree indexing and fast 302 redirects',
          'Future bottleneck will be database read I/O, not writes'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Understanding the 20:1 read-to-write ratio dictates where engineering optimization effort belongs.'
    },
    notes: `The 20:1 Read:Write ratio is a defining characteristic of URL shorteners.
Because reads dominate writes by a factor of 20, our indexing, caching, and connection pooling strategies must all prioritize the read redirect path.`
  },

  // Slide 47
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Estimating Storage Requirements',
      left: {
        header: 'Per-Record Size Breakdown',
        items: [
          'id (UUID): 16 bytes',
          'code (VARCHAR 12): 12 bytes',
          'original_url (TEXT): ~500 bytes average',
          'created_at / expires_at: 16 bytes',
          'is_active + DB row header overhead: ~32 bytes',
          'Estimated Total per Record: ~1 KB (conservative)'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Multi-Year Storage Growth',
        items: [
          '1 Day: 100,000 x 1 KB = 100 MB / day',
          '1 Year: 100 MB x 365 = 36.5 GB / year',
          '5 Years: 36.5 GB x 5 = ~182.5 GB total raw data',
          'With B-tree index + WAL overhead (2x): ~73 GB / year',
          'Easily fits on a single commodity SSD disk!'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: '36.5 GB of annual data means database sharding or partitioning is completely unnecessary for years.'
    },
    notes: `Storage calculations prove that we do not need NoSQL or distributed sharding on Day 1.
36.5 GB per year of raw data fits comfortably on modern cloud SSD storage volumes (which routinely support up to 64 TB on a single instance).`
  },

  // Slide 48
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Estimating Peak Traffic and Multipliers',
      left: {
        header: 'Traffic Distribution & Peaks',
        items: [
          'Traffic is never uniformly distributed across 24 hours',
          'Peak hours (business daytime) concentrate traffic',
          'Viral links and social media campaigns trigger sudden bursts',
          'Standard industry peak multiplier: 5x to 10x average RPS'
        ],
        accent: 'amber'
      },
      right: {
        header: 'Peak Capacity Requirements',
        items: [
          'Average Read RPS: 23.15 requests / sec',
          'Peak Multiplier: 5x',
          'Estimated Peak Read RPS: 23.15 x 5 ≈ 115.75 RPS',
          'Estimated Peak Write RPS: 1.16 x 5 ≈ 5.8 RPS',
          'Total Peak Traffic: ~122 requests / second'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Never provision systems for average traffic; systems fail during peak load.'
    },
    notes: `Why average traffic sizing causes outages:
If a system handles 23 RPS on average, but a marketing email triggers 120 RPS at 9:00 AM, an infrastructure provisioned only for averages will exhaust connections and crash.
Always design for peak multipliers.`
  }
]
