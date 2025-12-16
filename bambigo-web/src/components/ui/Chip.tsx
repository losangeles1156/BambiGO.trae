'use client'
import { Colors } from '../../lib/designTokens'
type Tone = 'red' | 'green' | 'blue' | 'yellow' | 'neutral'
type Props = { label: string; tone?: Tone; onClick?: () => void }
export default function Chip({ label, tone = 'neutral', onClick }: Props) {
  const bg = tone === 'red' ? Colors.status.red
    : tone === 'green' ? Colors.status.green
    : tone === 'blue' ? Colors.status.blue
    : tone === 'yellow' ? Colors.status.yellow
    : 'transparent'
  const cls = tone === 'neutral'
    ? 'rounded-full border border-gray-300 px-3 py-2 text-sm'
    : 'rounded px-2 py-1 text-xs text-white'
  return (
    <button className={cls} style={{ background: tone === 'neutral' ? undefined : bg }} onClick={onClick}>{label}</button>
  )
}
