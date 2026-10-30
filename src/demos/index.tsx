import type { ComponentType } from 'react'
import { WhoIsDriving } from './WhoIsDriving'

/** Register interactive widgets here; slides reference them by key. */
export const demos: Record<string, ComponentType> = {
  'whos-driving': WhoIsDriving,
}
