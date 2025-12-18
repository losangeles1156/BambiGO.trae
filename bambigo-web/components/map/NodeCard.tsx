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
    <div className="w-full p-4 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 ring-1 ring-black/5">
      <div className="flex justify-between items-start">
        <div className="text-lg font-bold text-gray-900 line-clamp-1">{title}</div>
      </div>
      
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.length > 0 ? (
          tags.slice(0, 3).map((t, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {t}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400 italic">無標籤</span>
        )}
        {tags.length > 3 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-500">
            +{tags.length - 3}
          </span>
        )}
      </div>

      <button
        className="mt-4 w-full rounded-xl bg-blue-600 text-white text-sm font-medium py-2.5 shadow-sm active:scale-[0.98] transition-all hover:bg-blue-700"
        onClick={() => {
          console.log('查看轉乘建議', { name, supply_tags, suitability_tags })
          onSuggest?.()
        }}
      >
        查看詳細資訊
      </button>
    </div>
  )
}
