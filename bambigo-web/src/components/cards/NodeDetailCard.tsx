'use client'
import { getLocalizedName } from '../../../lib/utils/i18n'
import TagChip from '../ui/TagChip'
import { Building2, Activity, Coffee, Sparkles, MapPin } from 'lucide-react'

type Name = { ja?: string; en?: string; zh?: string }
type Tag = { label: string; tone?: 'purple' | 'yellow' | 'gray' | 'blue' }

type Props = {
  name: Name
  l1Summary?: string
  l1Tags?: Tag[]
  l2Status?: Tag[]
  l3Context?: Tag[]
  l4Timeline?: Tag[]
}

export default function NodeDetailCard({ name, l1Summary = '', l1Tags = [], l2Status = [], l3Context = [], l4Timeline = [] }: Props) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW'

  return (
    <div className="ui-card p-5 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{getLocalizedName(name as Record<string, string>, locale)}</h2>
          <div className="flex items-center text-gray-500 text-sm mt-1">
            <MapPin size={14} className="mr-1" />
            <span>{name.en || name.ja}</span>
          </div>
        </div>
        {l1Summary && <TagChip label={l1Summary} layer="L1" icon={Building2} />}
      </div>

      <div className="mt-6 space-y-5">
        {/* L1 Structural Layer */}
        {l1Tags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">L1 Structure</span>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {l1Tags.map((t, i) => (
                <TagChip key={i} label={t.label} layer="L1" />
              ))}
            </div>
          </div>
        )}

        {/* L2 Aggregation Layer */}
        {l2Status.length > 0 && (
          <div>
             <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">L2 Atmosphere</span>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {l2Status.map((t, i) => (
                <TagChip key={i} label={t.label} layer="L2" icon={Activity} />
              ))}
            </div>
          </div>
        )}

        {/* L3 Functional Layer */}
        {l3Context.length > 0 && (
          <div>
             <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">L3 Utility</span>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {l3Context.map((t, i) => (
                <TagChip key={i} label={t.label} layer="L3" icon={Coffee} />
              ))}
            </div>
          </div>
        )}

        {/* L4 Action Layer */}
        {l4Timeline.length > 0 && (
          <div>
             <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">L4 Strategy</span>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {l4Timeline.map((t, i) => (
                <TagChip key={i} label={t.label} layer="L4" icon={Sparkles} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
