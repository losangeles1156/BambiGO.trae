'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'collapsed' | 'half' | 'full'
type Props = {
  mode?: Mode
  onModeChange?: (m: Mode) => void
  collapsedContent?: React.ReactNode
  halfContent?: React.ReactNode
  fullContent?: React.ReactNode
}

export default function BottomSheet({ mode = 'collapsed', onModeChange, collapsedContent, halfContent, fullContent }: Props) {
  const [current, setCurrent] = useState<Mode>(mode)
  const [prevMode, setPrevMode] = useState<Mode>(mode)

  if (mode !== prevMode) {
    setPrevMode(mode)
    setCurrent(mode)
  }

  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPercentRef = useRef<number | null>(null)
  const draggingRef = useRef<boolean>(false)
  const dragRef = useRef<{ startY: number; startPercent: number } | null>(null)
  const heights = useMemo(() => ({ collapsed: 0.15, half: 0.6, full: 0.9 }), [])

  const applyTransform = (percent: number) => {
    const el = containerRef.current
    if (!el) return
    el.style.transform = `translateY(${Math.round(percent)}%)`
  }

  useEffect(() => {
    const percent = Math.round((1 - heights[mode]) * 100)
    const el = containerRef.current
    if (el && !draggingRef.current) el.style.transition = 'transform 180ms ease-out'
    applyTransform(percent)
  }, [mode, heights])
  const setMode = (m: Mode) => {
    setCurrent(m)
    onModeChange?.(m)
    const percent = Math.round((1 - heights[m]) * 100)
    // Enable transition for snap animation when not dragging
    const el = containerRef.current
    if (el && !draggingRef.current) el.style.transition = 'transform 180ms ease-out'
    applyTransform(percent)
  }

  const schedule = () => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const p = pendingPercentRef.current
      if (p != null) applyTransform(p)
    })
  }

  const getCurrentPercent = (): number => {
    const el = containerRef.current
    if (!el) return Math.round((1 - heights[current]) * 100)
    const m = getComputedStyle(el).transform
    if (m && m.includes('matrix')) {
      const parts = m.replace('matrix(', '').replace(')', '').split(',').map((x) => parseFloat(x.trim()))
      const ty = parts[5] || 0
      const vh = window.innerHeight || 1
      return Math.max(0, Math.min(100, (ty / vh) * 100))
    }
    return Math.round((1 - heights[current]) * 100)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    draggingRef.current = true
    // Disable transition during drag
    el.style.transition = 'none'
    dragRef.current = { startY: e.clientY, startPercent: getCurrentPercent() }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current
    const d = dragRef.current
    if (!el || !d || !draggingRef.current) return
    const dy = e.clientY - d.startY
    const vh = window.innerHeight || 1
    const deltaPercent = (dy / vh) * 100
    let nextPercent = d.startPercent + deltaPercent
    nextPercent = Math.max(15, Math.min(85, nextPercent))
    pendingPercentRef.current = nextPercent
    schedule()
  }
  const finishDragAndSnap = (pointerId?: number) => {
    const el = containerRef.current
    if (!el) return
    draggingRef.current = false
    dragRef.current = null
    // Read current translate percent and snap to nearest state
    const percent = getCurrentPercent()
    let target: Mode = 'collapsed'
    if (percent <= 50) target = 'full'
    else if (percent <= 75) target = 'half'
    else target = 'collapsed'
    // Re-enable transition for snap
    el.style.transition = 'transform 180ms ease-out'
    setMode(target)
    if (pointerId != null) el.releasePointerCapture?.(pointerId)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    finishDragAndSnap(e.pointerId)
  }
  const onPointerCancel = (e: React.PointerEvent) => {
    finishDragAndSnap(e.pointerId)
  }
  return (
    <div aria-label="Bottom Sheet" role="region" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900 }}>
      <div
        ref={containerRef}
        className="bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-[2rem]"
        style={{ willChange: 'transform', transform: 'translateY(85%)', transition: 'transform 180ms ease-out' }}
      >
        <div
          aria-label="Drag Handle"
          role="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="pt-3 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-12 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="px-4 pb-4">
          {current === 'collapsed' && collapsedContent}
          {current === 'half' && halfContent}
          {current === 'full' && fullContent}
        </div>
        <div className="pb-6 flex items-center justify-center gap-2">
          <button aria-label="State collapsed" onClick={() => setMode('collapsed')} className={`w-2 h-2 rounded-full transition-colors ${current === 'collapsed' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          <button aria-label="State half" onClick={() => setMode('half')} className={`w-2 h-2 rounded-full transition-colors ${current === 'half' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          <button aria-label="State full" onClick={() => setMode('full')} className={`w-2 h-2 rounded-full transition-colors ${current === 'full' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        </div>
      </div>
    </div>
  )
}
