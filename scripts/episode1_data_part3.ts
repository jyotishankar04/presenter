import type { SlideDef } from './episode1_data_part1'

export const slidesPart3: SlideDef[] = [
  // Slide 49
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Putting Capacity Estimates Together: Reality Check',
      left: {
        header: 'Estimated Workload Dashboard',
        items: [
          'Daily URL Creations: 100,000 / day (~1.16 writes/sec)',
          'Daily URL Redirects: 2,000,000 / day (~23.15 reads/sec)',
          'Read : Write Traffic Ratio: 20 : 1 (Read-heavy)',
          'Estimated Peak Read Throughput: ~116 requests / second',
          'Annual Raw Storage Growth: ~36.5 GB / year'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Architectural Reality Check',
        items: [
          '116 peak RPS easily handled by 2-3 Express instances',
          'PostgreSQL handles this load on a 2 vCPU / 4 GB RAM machine',
          'DO NOT add Redis, Kafka, or microservices yet!',
          'Clean monolithic Node.js + PostgreSQL is 100% sufficient',
          'Simplicity is the highest form of engineering sophistication'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Base architecture on empirical workload sizing, never on industry buzzword fashion.'
    },
    notes: `Synthesis of Section 7:
A peak load of ~120 RPS and 36.5 GB/year of data means a simple, well-tuned monolith (Express + PostgreSQL + connection pool) will operate with sub-10ms response times at ~5% CPU utilization.
Over-engineering this workload with microservices or distributed queues would dramatically increase operational failure modes without providing any benefit.`
  },

  // Slide 50
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'What Happens When the Database Becomes Slow?',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'query', label: '1. Unindexed / Slow Query\nQuery takes 2,000ms instead of 2ms', shape: 'box', icon: 'Clock', accent: 'red' },
        { id: 'holding', label: '2. Connection Held Open\nNode.js holds pool connection waiting for DB', shape: 'box', icon: 'Layers', accent: 'red' },
        { id: 'exhaust', label: '3. Connection Pool Exhaustion\nAll 20 pool connections occupied in parallel', shape: 'box', icon: 'AlertTriangle', accent: 'red' },
        { id: 'queue', label: '4. API Request Queueing\nNew incoming HTTP requests queue in Node RAM', shape: 'box', icon: 'Inbox', accent: 'red' },
        { id: 'crash', label: '5. Cascading System Outage\nGateway 504 Timeouts, Memory exhaustion, Downtime', shape: 'pill', icon: 'XCircle', accent: 'red' }
      ],
      edges: [
        { from: 'query', to: 'holding' },
        { from: 'holding', to: 'exhaust' },
        { from: 'exhaust', to: 'queue' },
        { from: 'queue', to: 'crash' }
      ]
    },
    notes: `The Connection Exhaustion Domino Effect:
When database queries slow down, connections remain checked out longer.
Because the pool is finite (e.g. 20 connections), the pool quickly exhausts.
Once the pool is dry, all subsequent incoming HTTP requests stall waiting for a connection.
Eventually, API workers exhaust memory buffers or hit gateway timeouts, bringing down the entire website.`
  },

  // Slide 51
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Timeouts and Graceful Failure',
      left: {
        header: 'Without Timeouts (Hanging)',
        items: [
          'Slow query hangs indefinitely waiting on lock',
          'Express worker socket stays open consuming RAM',
          'Client waits 60 seconds before giving up',
          'Worker pool completely starved of capacity',
          'One slow query takes down entire API tier'
        ],
        accent: 'red'
      },
      right: {
        header: 'Layered Timeouts (Fail Fast)',
        items: [
          'statement_timeout = 250ms (PostgreSQL cancels query)',
          'connectionTimeoutMillis = 1000ms (Pool rejects wait)',
          'server.headersTimeout = 5000ms (Express socket limit)',
          'Returns immediate 503 Service Unavailable',
          'Workers freed immediately to serve other users'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Failing fast preserves capacity; indefinite waiting triggers system-wide collapse.'
    },
    notes: `Timeout configuration rules:
Configure timeouts at every layer:
1. DB statement_timeout: Aborts queries that exceed expected execution limits.
2. Pool checkout timeout: Rejects requests when all connections are busy rather than queueing indefinitely.
3. HTTP server timeout: Protects against slowloris attacks and dead sockets.`
  },

  // Slide 52
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Retries and Their Risks: The Retry Storm',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'fail', label: 'Initial Request Fails\n(Transient network blip or 503)', shape: 'pill', icon: 'AlertCircle', accent: 'amber' },
        { id: 'check', label: 'Is error transient & safe to retry?', shape: 'decision', icon: 'HelpCircle', accent: 'ink' },
        { id: 'jitter', label: 'Exponential Backoff + Jitter\nWait = base * 2^attempt + rand(0, 100ms)\n(Desynchronizes clients)', shape: 'box', icon: 'Clock', accent: 'green' },
        { id: 'storm', label: 'Immediate Blind Retry\n10,000 clients retry simultaneously\n-> Kills recovering database!', shape: 'box', icon: 'ZapOff', accent: 'red' }
      ],
      edges: [
        { from: 'fail', to: 'check' },
        { from: 'check', to: 'jitter', label: 'Transient (503)' },
        { from: 'check', to: 'storm', label: 'Blind Retry' }
      ]
    },
    notes: `Retry Storms (Thundering Herd):
When an overloaded database experiences a temporary hiccup, if 10,000 clients immediately retry at the same second, the incoming traffic doubles, ensuring the database can never recover.
Solutions:
1. Exponential backoff: Multiplies delay on each attempt (100ms, 200ms, 400ms).
2. Full Jitter: Adds random noise to stagger requests across time.`
  },

  // Slide 53
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Logging and Monitoring: The Three Pillars of Observability',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'logs', label: '1. Structured Logs (Pino)\nDetailed event records with correlation IDs\n(e.g. "URL created: code=aB91, ms=4")', shape: 'box', icon: 'FileText', accent: 'blue' },
        { id: 'metrics', label: '2. Metrics (Prometheus)\nNumerical time-series aggregations\n(RPS, P95 Latency, Error %, CPU, Memory)', shape: 'box', icon: 'Activity', accent: 'green' },
        { id: 'traces', label: '3. Distributed Tracing (O-Tel)\nFollows 1 request across Network -> API -> DB\n(Pinpoints exact millisecond bottleneck)', shape: 'box', icon: 'GitCommit', accent: 'amber' },
        { id: 'dash', label: 'Grafana Dashboards & Alerts\nReal-time operational alerts (Slack / PagerDuty)', shape: 'pill', icon: 'Sliders', accent: 'ink' }
      ],
      edges: [
        { from: 'logs', to: 'dash' },
        { from: 'metrics', to: 'dash' },
        { from: 'traces', to: 'dash' }
      ]
    },
    notes: `The Three Pillars of Observability:
1. Logs: Explain what happened to a specific request.
2. Metrics: Tell you when the system as a whole is degrading (high-level alarms).
3. Traces: Visualize where time was spent during the execution of a distributed request.`
  },

  // Slide 54
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'What Should We Monitor in Our URL Shortener?',
      left: {
        header: 'Application & Database Metrics',
        items: [
          'Throughput: Total HTTP requests per second (RPS)',
          'Error Rate: 4xx client errors vs 5xx server errors',
          'Latency: P50, P95, and P99 percentiles on redirect path',
          'DB Pool: Active connections, idle connections, queue depth',
          'Slow Queries: Any query exceeding 50ms threshold'
        ],
        accent: 'blue'
      },
      right: {
        header: 'System & Business Metrics',
        items: [
          'Node.js Event Loop Lag: Must remain < 20ms',
          'Memory RSS: Detect memory leaks before OOM crashes',
          'Business: Number of short URLs created today',
          'Business: Total redirect clicks served per minute',
          'Security: Rate-limit triggers and 404 scan attempts'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Set automated alerts on P95 latency (>100ms) and 5xx error rate (>1%).'
    },
    notes: `A comprehensive monitoring checklist:
Golden Signals of API monitoring:
- Latency (time to serve requests).
- Traffic (demand placed on the system).
- Errors (rate of requests failing).
- Saturation (resource fullness, e.g. connection pool depth).`
  },

  // Slide 55
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Our Initial Architecture (Stage 1 Review)',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'client', label: 'Client Devices\n(Web, Mobile, Extension)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'api', label: 'Single Express API Server (Node.js)\nDirect TCP Connection · In-process pooling', shape: 'box', icon: 'Server', accent: 'amber' },
        { id: 'db', label: 'PostgreSQL Database (Primary)\nDurable table storage & B-Tree indexes', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'client', to: 'api', label: 'HTTP / REST' },
        { from: 'api', to: 'db', label: 'SQL (Port 5432)' }
      ]
    },
    notes: `Reviewing where we began:
Stage 1: A single Express instance talking to a single PostgreSQL database.
Why start here?
- Simplest to build, test, and reason about.
- Zero distributed state synchronization bugs.
Why it must evolve:
- Single Point of Failure (SPOF): If the server hardware fails or process restarts, 100% of traffic is dropped.`
  },

  // Slide 56
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Our Scaled Architecture (Stage 3 Production Target)',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'clients', label: 'Clients (Web, Mobile, API Consumers)', shape: 'pill', icon: 'Globe', accent: 'blue' },
        { id: 'lb', label: 'Load Balancer (Nginx / Cloud ALB)\nTLS Termination · Health Checks · Rate Limiting', shape: 'box', icon: 'Network', accent: 'amber' },
        { id: 'api1', label: 'Express API Instance 1\n(Stateless Container)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'api2', label: 'Express API Instance 2\n(Stateless Container)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'api3', label: 'Express API Instance 3\n(Stateless Container)', shape: 'box', icon: 'Server', accent: 'blue' },
        { id: 'db', label: 'PostgreSQL Database (Connection Pool & B-Tree Indexes)', shape: 'database', icon: 'Database', accent: 'green' }
      ],
      edges: [
        { from: 'clients', to: 'lb', label: 'HTTPS (Port 443)' },
        { from: 'lb', to: 'api1' },
        { from: 'lb', to: 'api2' },
        { from: 'lb', to: 'api3' },
        { from: 'api1', to: 'db', label: 'Pool: 15' },
        { from: 'api2', to: 'db', label: 'Pool: 15' },
        { from: 'api3', to: 'db', label: 'Pool: 15' }
      ]
    },
    notes: `The Scaled Architecture:
Key improvements:
1. Redundancy: 3 stateless API instances behind a load balancer eliminate compute single points of failure.
2. Zero-downtime rolling deploys: Instances can be updated one by one.
3. Health check isolation: Failing instances are automatically removed from rotation.`
  },

  // Slide 57
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'What Changes as Our System Grows? (Evolution Timeline)',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'stg1', label: 'Stage 1: Basic API\n1x Express + PostgreSQL\n(Up to 100 RPS)', shape: 'box', accent: 'blue' },
        { id: 'stg2', label: 'Stage 2: Optimized DB\nIndexes + Connection Pool\n(Up to 1,000 RPS)', shape: 'box', accent: 'green' },
        { id: 'stg3', label: 'Stage 3: Scaled Compute\nLoad Balancer + N Instances\n(Up to 10,000 RPS)', shape: 'box', icon: 'Network', accent: 'amber' },
        { id: 'stg4', label: 'Stage 4: Read Replicas\nPostgres Replicas + Redis\n(Up to 50,000 RPS)', shape: 'box', icon: 'Zap', accent: 'ink' },
        { id: 'stg5', label: 'Stage 5: Edge Scale\nCDN Edge Redirects + Sharding\n(500,000+ RPS)', shape: 'pill', icon: 'Globe', accent: 'green' }
      ],
      edges: [
        { from: 'stg1', to: 'stg2' },
        { from: 'stg2', to: 'stg3' },
        { from: 'stg3', to: 'stg4' },
        { from: 'stg4', to: 'stg5' }
      ]
    },
    notes: `The golden rule of system design evolution:
Never implement Stage 4 when you are at Stage 1.
Optimize the current stage, measure the bottleneck, and advance only when workload demands it.`
  },

  // Slide 58
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Architectural Decisions and Trade-offs',
      left: {
        header: 'Architectural Choices Made',
        items: [
          'PostgreSQL for relational storage: Strong ACID guarantees',
          'B-Tree Index on code: O(log N) sub-millisecond lookups',
          'In-Process Connection Pooling: Prevents process fork exhaustion',
          'Horizontal Stateless API Tier: High availability & linear scaling',
          '302 Found Redirects: Preserves accurate click analytics'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Associated Costs & Trade-offs',
        items: [
          'PostgreSQL requires schema migrations & backup management',
          'Index on code adds slight write latency & RAM consumption',
          'Multiple instances multiply total database connection count',
          'Requires Load Balancer configuration and health checks',
          'Cannot leverage browser-level disk caching for redirects'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'Every design choice in system design is an explicit trade-off. There are no solutions, only trade-offs.'
    },
    notes: `Trade-off matrix defense:
In an interview or design review, always present both sides of every decision.
Choosing PostgreSQL gives durability, but requires connection management.
Choosing 302 Found gives analytics, but incurs network traffic for every click.`
  },

  // Slide 59
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Implementation Roadmap: Building the Backend',
      left: {
        header: 'Phase 1: Foundations & Schema',
        items: [
          '1. Initialize TypeScript, Express & Vitest project',
          '2. Setup PostgreSQL container with Docker Compose',
          '3. Define schema & run migrations (UUID, code UNIQUE)',
          '4. Implement Zod validation schemas for API inputs',
          '5. Implement Base62 short-code generation algorithm'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Phase 2: Endpoints & Hardening',
        items: [
          '6. Build POST /api/v1/urls creation endpoint',
          '7. Build GET /:code fast redirection route (302 Found)',
          '8. Integrate Pino structured logging & correlation IDs',
          '9. Configure connection pool limits and query timeouts',
          '10. Execute unit, integration, and k6 load tests'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Build incrementally: validate each layer before proceeding to the next.'
    },
    notes: `A structured implementation plan:
Break engineering execution into progressive milestones. Never write the database queries and the load tests at the same time. Verify schema constraints first, build the service layer next, and load test last.`
  },

  // Slide 60
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Testing Our URL Shortener: The Testing Pyramid',
      direction: 'TB',
      reveal: 'level',
      nodes: [
        { id: 'load', label: 'Load & Stress Tests (k6)\nVerify concurrency, throughput, P95 latency, pool stability', shape: 'box', icon: 'Activity', accent: 'amber' },
        { id: 'int', label: 'Integration Tests (Supertest + Real DB)\nVerify API endpoints, DB constraints, redirect Location headers', shape: 'box', icon: 'Layers', accent: 'blue' },
        { id: 'unit', label: 'Unit Tests (Vitest)\nFast, isolated tests for Base62 encoding, Zod schema validation', shape: 'box', icon: 'CheckCircle', accent: 'green' }
      ],
      edges: [
        { from: 'load', to: 'int' },
        { from: 'int', to: 'unit' }
      ]
    },
    notes: `Testing strategy:
- Unit tests: Test pure functions in milliseconds (Base62 encoding, validation schemas).
- Integration tests: Spin up a test database to verify foreign keys, unique constraint violations, and HTTP status codes.
- Load tests: Simulate hundreds of concurrent virtual users to prove the connection pool and event loop hold up under stress.`
  },

  // Slide 61
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Load Testing with k6: What Are We Trying to Find?',
      left: {
        header: 'Load Test Execution Profile',
        items: [
          'Warmup: 10 concurrent Virtual Users (VUs) for 1 minute',
          'Normal Load: 50 concurrent VUs for 3 minutes',
          'Stress Test: 100 concurrent VUs sustained for 2 minutes',
          'Traffic Mix: 95% GET /:code redirects, 5% POST creations'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Target Verification Criteria',
        items: [
          'P95 Redirect Latency remains strictly < 15ms',
          'HTTP Error Rate stays at 0.00% (zero 500s or 504s)',
          'Connection pool never exhausts (zero connection wait queue)',
          'Node.js event loop lag remains < 10ms',
          'PostgreSQL CPU utilization stays < 30%'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Load testing validates that architectural estimates match physical runtime performance.'
    },
    notes: `Load testing parameters:
Simulate realistic production conditions. A synthetic test sending only writes is unrealistic for a URL shortener. Test with a 95% read / 5% write traffic distribution to emulate real user behavior.`
  },

  // Slide 62
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Common Mistakes in System Design',
      left: {
        header: 'Classic Architectural Pitfalls',
        items: [
          '1. Premature Microservices: Splitting services before domain boundaries emerge',
          '2. Adding Redis without measuring: Caching before fixing unindexed SQL',
          '3. Missing Database Indexes on lookup columns and foreign keys',
          '4. Opening a new database connection per HTTP request',
          '5. Neglecting query and connection timeouts'
        ],
        accent: 'red'
      },
      right: {
        header: 'Subtle Operational Pitfalls',
        items: [
          '6. Relying on average latency instead of P95/P99 percentiles',
          '7. Client-only validation: Bypassed by direct HTTP callers',
          '8. Returning 301 Permanent Redirects: Destroys click analytics',
          '9. Storing sessions in server RAM: Breaks horizontal scaling',
          '10. Uncontrolled retries without jitter: Causes retry storms'
        ],
        accent: 'amber'
      },
      alternate: true,
      footer: 'Great system design is about avoiding unnecessary complexity as much as adding necessary components.'
    },
    notes: `Top 10 system design mistakes review:
1. Microservices too early.
2. Caching without metrics.
3. Missing indexes.
4. No connection pooling.
5. Missing timeouts.
6. Averages over percentiles.
7. Trusting client validation.
8. 301 instead of 302.
9. Stateful servers.
10. Blind retry storms.`
  },

  // Slide 63
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'What Have We Built and Learned in Episode 1?',
      left: {
        header: 'Core Concepts Mastered',
        items: [
          'Client-Server communication & HTTP request/response semantics',
          'REST API resource design & stateless computing principles',
          'Relational database foundations, B-Tree indexes & ACID transactions',
          'Connection pooling mechanics & resource exhaustion prevention',
          'Vertical vs Horizontal scaling trade-offs & Load Balancer algorithms'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Concrete URL Shortener Implementation',
        items: [
          'TypeScript + Express layered monolithic architecture',
          'PostgreSQL schema with UUIDs, unique codes, and timestamps',
          'Base62 encoding algorithm with collision handling',
          'Fast 302 Found redirect route with analytics tracking',
          'Production hardening: Pino logging, Zod validation, timeouts'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'From first principles to a working, scalable production backend.'
    },
    notes: `Summary of Episode 1 achievements:
We progressed from introductory client-server definitions to building a scalable, resilient, production-ready backend foundation.`
  },

  // Slide 64
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Interview Knowledge Check: 14 Core Questions',
      left: {
        header: 'Architecture & Protocol Questions',
        items: [
          '1. Complete journey: URL bar to browser pixel rendering',
          '2. Why HTTP is stateless & how tokens convey state',
          '3. Semantic difference between PUT and PATCH',
          '4. Why 302 Found is chosen over 301 for URL shorteners',
          '5. Why application-level uniqueness checks fail under concurrency',
          '6. Vertical vs Horizontal scaling trade-offs & /health vs /ready'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Database & Performance Questions',
        items: [
          '7. How B-tree indexes achieve O(log N) lookups',
          '8. Downsides, storage overhead, and write costs of indexes',
          '9. Why connection pooling is essential in PostgreSQL',
          '10. ACID properties with concrete rollback examples',
          '11. How a slow query causes a cascading system outage',
          '12. Read-heavy architecture (20:1) & retry jitter math'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Detailed model interview answers are provided in the speaker notes for each question.'
    },
    notes: `Model Interview Answers:
1. DNS resolves IP -> TCP handshake -> TLS session established -> HTTP GET sent -> Backend queries DB -> HTTP response returned -> Browser renders.
2. HTTP retains no memory across calls; tokens (JWTs) in Authorization headers provide state per request.
3. PUT replaces the entire entity; PATCH updates specific fields.
4. 301 is cached by browsers, bypassing backend click analytics; 302 forces browsers to contact the backend on every redirect.
5. Parallel requests can check simultaneously; only DB constraints enforce atomic uniqueness.
6. Vertical scaling has a hard hardware ceiling and SPOF; horizontal scaling requires stateless instances.
7. Liveness checks if process is running; readiness checks if DB connections are available.
8. B-trees keep keys balanced in sorted nodes, allowing binary search across disk pages in O(log N).
9. Indexes consume extra RAM/disk and slow down INSERT/UPDATE operations.
10. Postgres forks a process per connection (~10MB); pooling caps concurrency and reuses sockets.
11. Atomicity: all rollback on error; Consistency: rules kept; Isolation: concurrent writes separated; Durability: WAL flushed.
12. Slow queries keep connections occupied -> pool exhausts -> incoming HTTP requests queue -> workers OOM/timeout.
13. Links are created once but clicked dozens of times across social media.
14. Backoff spaces out retries; jitter desynchronizes clients to prevent thundering herds.`
  },

  // Slide 65
  {
    tool: 'add_diagram_slide',
    args: {
      title: 'Next Episode Preview: Database Internals & Indexing',
      direction: 'LR',
      reveal: 'level',
      nodes: [
        { id: 'engine', label: '1. PostgreSQL Storage Engine\nPages, Tuples, Heap, and WAL', shape: 'box', icon: 'Database', accent: 'green' },
        { id: 'btree', label: '2. Deep Dive: B-Tree Internals\nRoot, Internal Nodes, Leaf Pages, Pointers', shape: 'box', icon: 'GitMerge', accent: 'blue' },
        { id: 'planner', label: '3. Query Planner & EXPLAIN\nEXPLAIN ANALYZE, Cost Estimation, Scans', shape: 'box', icon: 'Search', accent: 'amber' },
        { id: 'concurrency', label: '4. Concurrency & Locking\nMVCC, Row-level Locks, Deadlocks, Isolation', shape: 'box', icon: 'Lock', accent: 'red' },
        { id: 'tuning', label: '5. Query Tuning in Practice\nOptimizing Real Production Queries', shape: 'pill', icon: 'Zap', accent: 'green' }
      ],
      edges: [
        { from: 'engine', to: 'btree' },
        { from: 'btree', to: 'planner' },
        { from: 'planner', to: 'concurrency' },
        { from: 'concurrency', to: 'tuning' }
      ]
    },
    notes: `Episode 2 Sneak Peek:
Now that we have established client-server communication and backend scalability foundations, Episode 2 will take a deep dive under the hood of database engines:
- How PostgreSQL stores pages on physical disk.
- How B-Trees balance themselves during inserts.
- How to read and interpret EXPLAIN ANALYZE plans like a senior engineer.
- Managing MVCC and row-level locks under heavy concurrent updates.`
  },

  // Slide 66
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Appendix: Glossary of System Design Terms',
      left: {
        header: 'Performance & Network Terms',
        items: [
          'Throughput: Number of operations/requests handled per second (RPS / QPS).',
          'Latency: Duration required to complete an operation (measured in ms).',
          'Concurrency: Number of active requests executing in-flight simultaneously.',
          'Statelessness: Architecture where compute servers retain no local client session memory.',
          'Reverse Proxy: Server fronting web backends to handle TLS, caching, and load balancing.'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Reliability & Database Terms',
        items: [
          'Availability: Percentage of time a service is operational (e.g. 99.9% uptime).',
          'Fault Tolerance: Ability of a system to continue operating despite node failures.',
          'Connection Pool: Cache of persistent database connections maintained for reuse.',
          'B-Tree: Self-balancing search tree providing O(log N) lookup and insertion.',
          'ACID: Atomicity, Consistency, Isolation, Durability guarantees of relational DBs.'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Keep this glossary handy for interviews and architectural design reviews.'
    },
    notes: `Glossary definitions review:
- Latency vs Throughput: Latency is a pipe's transit time; throughput is the pipe's width.
- Availability: 99.9% (three nines) permits ~8.7 hours of downtime per year; 99.99% (four nines) permits ~52 minutes.`
  },

  // Slide 67
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Appendix: Important Formulas and Calculations',
      left: {
        header: 'Traffic & Storage Formulas',
        items: [
          'Average RPS = Total Requests / 86,400 seconds (e.g. 100k / 86,400 = 1.16 RPS)',
          'Daily Storage = Daily Records x Average Record Size (e.g. 100k x 1 KB = 100 MB)',
          'Annual Storage = Daily Storage x 365 (e.g. 100 MB x 365 = 36.5 GB)',
          'Read/Write Ratio = Read Requests / Write Requests (e.g. 2M / 100k = 20:1)'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Capacity & Availability Formulas',
        items: [
          'Peak RPS = Average RPS x Peak Multiplier (e.g. 23.15 x 5 = ~116 Peak RPS)',
          'Little\'s Law: Concurrency = Throughput x Average Latency',
          'Pool Sizing: Connections = ((Core Count x 2) + Spindle Count)',
          'Availability % = (Total Time - Downtime) / Total Time x 100'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Quick-reference formulas for back-of-the-envelope capacity estimations.'
    },
    notes: `Formula reference guide:
Memorize Little's Law and standard peak multipliers (3x to 10x) for system design interviews.`
  },

  // Slide 68
  {
    tool: 'add_comparison_slide',
    args: {
      title: 'Appendix: References and Authoritative Resources',
      left: {
        header: 'Official Specifications & Docs',
        items: [
          'RFC 9110: HTTP Semantics (The official IETF specification for HTTP)',
          'RFC 7231: HTTP/1.1 Semantics and Content',
          'MDN Web Docs: HTTP Overview & Status Codes',
          'PostgreSQL Official Documentation (Chapters 11: Indexes, 13: Concurrency Control)'
        ],
        accent: 'blue'
      },
      right: {
        header: 'Core Engineering Libraries',
        items: [
          'Node.js Official Documentation: Event Loop, Timers, and Process NextTick',
          'Express.js Guide: Writing Middleware & Error Handling',
          'Zod Documentation: TypeScript-first schema declaration and validation',
          'k6 Documentation: Modern load testing for engineering teams'
        ],
        accent: 'green'
      },
      alternate: true,
      footer: 'Episode 1 Complete · System Design Foundations + First Scalable API.'
    },
    notes: `Recommended reading list for deeper study:
- RFC 9110 for mastering exact HTTP protocol semantics.
- PostgreSQL Chapter 11 on Indexes to prepare for Episode 2.`
  }
]
