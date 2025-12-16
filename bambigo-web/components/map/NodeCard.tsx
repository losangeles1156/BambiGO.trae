'use client'
import { getLocalizedName } from '../../lib/utils/i18n'
type Name = { ja?: string; en?: string; zh?: string }
type Props = {
  name: Name
  supply_tags?: string[]
  suitability_tags?: string[]
  onSuggest?: () => void
}
export default function NodeCard({ name, supply_tags = [], suitability_tags = [], onSuggest }: Props) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW'
  const title = getLocalizedName(name as Record<string, string>, locale)
  const tags = [...(supply_tags || []), ...(suitability_tags || [])]
  return (
    <div className="min-w-64 max-w-80 p-3 bg-white/95 rounded shadow border border-gray-200">
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-2 text-xs text-gray-600">Tags: {tags.length ? tags.join(', ') : '—'}</div>
      <button
        className="mt-3 w-full rounded bg-blue-600 text-white text-sm py-2"
        onClick={() => {
          console.log('查看轉乘建議', { name, supply_tags, suitability_tags })
          onSuggest?.()
        }}
      >
        查看轉乘建議
      </button>
    </div>
  )
}
