import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Top-level switch between the two halves of the app. */
export function AppNav() {
  const { pathname } = useLocation()
  const on = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p))
  return (
    <nav aria-label="Main" className="mb-6 flex gap-1.5">
      <Button size="sm" variant={on('/') && !on('/schemas') ? 'default' : 'outline'} nativeButton={false} render={<Link to="/" />}>Decks</Button>
      <Button size="sm" variant={on('/schemas') ? 'default' : 'outline'} nativeButton={false} render={<Link to="/schemas" />}>Database schemas</Button>
    </nav>
  )
}
