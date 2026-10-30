import { useEffect, useState } from 'react'

type Listener = (msg: string) => void
const listeners = new Set<Listener>()

/** Say something to screen-reader users (polite live region). */
export function announce(msg: string) { listeners.forEach((l) => l(msg)) }

export function LiveRegion() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const l: Listener = (m) => { setMsg(''); setTimeout(() => setMsg(m), 30) }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{msg}</div>
}
