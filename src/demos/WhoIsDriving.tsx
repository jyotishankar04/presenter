import { useEffect, useRef, useState } from 'react'
import { Bot, User } from 'lucide-react'

const ROAD = 'M40,380 C200,200 360,180 520,300 S800,420 1000,300 S1300,150 1480,260'

export function WhoIsDriving() {
  const [driver, setDriver] = useState<'human' | 'llm' | null>(null)
  const [t, setT] = useState(0)
  const path = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (!driver) return
    setT(0)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / 6000, 1)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [driver])

  const len = path.current?.getTotalLength() ?? 0
  const pt = path.current && len ? path.current.getPointAtLength(t * len) : { x: 40, y: 380 }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width="100%" height="100%" viewBox="0 0 1520 520">
        <path d={ROAD} fill="none" stroke="#2a2622" strokeWidth={96} strokeLinecap="butt" />
        <path d={ROAD} fill="none" stroke="#eee9e0" strokeWidth={90} />
        <path ref={path} d={ROAD} fill="none" stroke="#b8b0a3" strokeWidth={3} strokeDasharray="18 18" />
        <text x={10} y={440} fontFamily="Caveat" fontSize={40} fill="#8a8072">A</text>
        <text x={1480} y={220} fontFamily="Caveat" fontSize={40} fill="#8a8072">B</text>
        {driver && <circle cx={pt.x} cy={pt.y} r={16} fill={driver === 'human' ? '#d9930d' : '#4a6cf7'} />}
      </svg>
      <div style={{ position: 'absolute', left: 20, bottom: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ font: '30px Caveat', color: '#8a8072' }}>choose your player</span>
        {(['human', 'llm'] as const).map((d) => (
          <button key={d} onClick={() => setDriver(d)}
            style={{ font: '700 28px Caveat', padding: '10px 22px', borderRadius: 16, border: '2px solid ' + (driver === d ? '#4a6cf7' : '#e6e1d6'), background: '#fff', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            {d === 'human' ? <User size={26} /> : <Bot size={26} />}{d === 'human' ? 'Human' : 'LLM'}
          </button>
        ))}
      </div>
    </div>
  )
}
