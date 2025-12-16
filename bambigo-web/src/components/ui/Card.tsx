'use client'
import { Colors } from '../../lib/designTokens'
type Props = { children: React.ReactNode; className?: string }
export default function Card({ children, className }: Props) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${className || ''}`} style={{ background: Colors.map.lightBg }}>
      {children}
    </div>
  )
}
