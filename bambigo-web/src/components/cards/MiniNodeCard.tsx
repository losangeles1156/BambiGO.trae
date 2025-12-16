'use client'
import { getLocalizedName } from '../../../lib/utils/i18n'
type Name = { ja?: string; en?: string; zh?: string }
type Status = { label: string; color?: 'yellow' | 'blue' | 'gray' }
type Props = { name: Name; statuses?: Status[] }
export default function MiniNodeCard({ name, statuses = [] }: Props) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW'
  return (
    <div className="ui-card ui-card--compact p-3">
      <div className="text-sm font-semibold">{getLocalizedName(name as Record<string, string>, locale)}</div>
      <div className="mt-2 flex flex-wrap gap-6">
        {statuses.map((s, i) => (
          <span
            key={i}
            className={`ui-chip ${
              s.color === 'yellow' ? 'ui-chip--yellow' : s.color === 'blue' ? 'ui-chip--blue' : 'ui-chip--gray'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
