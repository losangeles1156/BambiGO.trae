'use client'
import { useRef } from 'react'

type Card = { title: string; desc?: string; primary?: string }
type Props = { cards: Card[] }

export default function ActionCarousel({ cards }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<{ x: number; scroll: number } | null>(null)
  const draggingRef = useRef<boolean>(false)
  const lastRef = useRef<{ x: number; t: number } | null>(null)
  const velocityRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    draggingRef.current = true
    startRef.current = { x: e.clientX, scroll: el.scrollLeft }
    lastRef.current = { x: e.clientX, t: performance.now() }
    velocityRef.current = 0
    // Prevent text selection while dragging
    e.preventDefault()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current
    const st = startRef.current
    if (!el || !st || !draggingRef.current) return
    const dx = e.clientX - st.x
    el.scrollLeft = st.scroll - dx
    const now = performance.now()
    const last = lastRef.current
    if (last) {
      const dt = Math.max(1, now - last.t)
      const dv = e.clientX - last.x
      // px per ms
      velocityRef.current = dv / dt
      lastRef.current = { x: e.clientX, t: now }
    }
  }
  const startMomentum = () => {
    const el = ref.current
    if (!el) return
    const step = () => {
      rafRef.current = null
      const v = velocityRef.current
      // Stop if velocity is negligible
      if (Math.abs(v) < 0.01) return
      // Apply velocity
      el.scrollLeft -= v * 16 // approximate 16ms per frame
      // Apply friction
      velocityRef.current *= 0.95
      // Stop at edges
      const max = el.scrollWidth - el.clientWidth
      if (el.scrollLeft <= 0 || el.scrollLeft >= max) {
        velocityRef.current = 0
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    draggingRef.current = false
    el.releasePointerCapture?.(e.pointerId)
    startMomentum()
  }
  const onPointerCancel = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    draggingRef.current = false
    el.releasePointerCapture?.(e.pointerId)
  }
  return (
    <div ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} style={{ overflowX: 'auto', display: 'flex', gap: 12, padding: 6, willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}>
      {cards.map((c, i) => (
        <div
          key={i}
          className={`${i === 0 ? 'min-w-80 border-blue-500 bg-blue-50' : 'min-w-64'} rounded-xl border ${i === 0 ? 'shadow-md' : 'shadow-sm'} p-3`}
        >
          <div className={`font-semibold ${i === 0 ? 'text-sm text-blue-900' : 'text-sm'}`}>{c.title}</div>
          {c.desc && <div className={`${i === 0 ? 'mt-2 text-xs text-blue-800' : 'mt-2 text-xs text-gray-600'}`}>{c.desc}</div>}
          {c.primary && (
            <button className={`${i === 0 ? 'mt-3 w-full rounded bg-blue-600 px-3 py-2 text-sm text-white' : 'mt-3 w-full rounded bg-gray-800 px-3 py-2 text-sm text-white'}`}>{c.primary}</button>
          )}
        </div>
      ))}
    </div>
  )
}
