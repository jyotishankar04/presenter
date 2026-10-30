import type { Accent } from '../model/types'
import type { FlowShape } from './types'

/** Ready-made system-design building blocks for flow diagrams. */
export interface ComponentPreset { id: string; label: string; group: string; shape: FlowShape; icon?: string; accent: Accent }

export const COMPONENTS: ComponentPreset[] = [
  { id: 'client', label: 'Client', group: 'Clients', shape: 'pill', icon: 'Monitor', accent: 'amber' },
  { id: 'mobile', label: 'Mobile app', group: 'Clients', shape: 'pill', icon: 'Smartphone', accent: 'amber' },
  { id: 'browser', label: 'Browser', group: 'Clients', shape: 'pill', icon: 'Globe', accent: 'amber' },
  { id: 'dns', label: 'DNS', group: 'Network', shape: 'box', icon: 'Network', accent: 'muted' },
  { id: 'cdn', label: 'CDN', group: 'Network', shape: 'box', icon: 'Cloud', accent: 'blue' },
  { id: 'lb', label: 'Load balancer', group: 'Network', shape: 'box', icon: 'Split', accent: 'blue' },
  { id: 'gateway', label: 'API gateway', group: 'Network', shape: 'box', icon: 'Webhook', accent: 'blue' },
  { id: 'server', label: 'App server', group: 'Compute', shape: 'box', icon: 'Server', accent: 'blue' },
  { id: 'service', label: 'Service', group: 'Compute', shape: 'box', icon: 'Box', accent: 'blue' },
  { id: 'worker', label: 'Worker', group: 'Compute', shape: 'box', icon: 'Cog', accent: 'blue' },
  { id: 'cache', label: 'Cache', group: 'Data', shape: 'box', icon: 'Zap', accent: 'amber' },
  { id: 'db', label: 'Database', group: 'Data', shape: 'database', accent: 'green' },
  { id: 'replica', label: 'Read replica', group: 'Data', shape: 'database', accent: 'muted' },
  { id: 'storage', label: 'Object storage', group: 'Data', shape: 'box', icon: 'HardDrive', accent: 'green' },
  { id: 'search', label: 'Search index', group: 'Data', shape: 'box', icon: 'Search', accent: 'green' },
  { id: 'queue', label: 'Message queue', group: 'Messaging', shape: 'box', icon: 'ListOrdered', accent: 'amber' },
  { id: 'stream', label: 'Event stream', group: 'Messaging', shape: 'box', icon: 'Radio', accent: 'amber' },
  { id: 'email', label: 'Email / push', group: 'Messaging', shape: 'box', icon: 'Mail', accent: 'muted' },
  { id: 'auth', label: 'Auth service', group: 'Platform', shape: 'box', icon: 'ShieldCheck', accent: 'red' },
  { id: 'monitor', label: 'Monitoring', group: 'Platform', shape: 'box', icon: 'Activity', accent: 'muted' },
  { id: 'third', label: 'Third-party API', group: 'Platform', shape: 'box', icon: 'Plug', accent: 'muted' },
]
export const COMPONENT_GROUPS = [...new Set(COMPONENTS.map((c) => c.group))]
