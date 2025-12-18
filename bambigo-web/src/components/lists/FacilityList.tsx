'use client'
import { L3ServiceFacility } from '../../types/tagging'
import { LucideIcon, Wifi, Zap, Accessibility, Bath, Armchair, Box, HelpCircle } from 'lucide-react'

type Props = { items: L3ServiceFacility[] }

const ICON_MAP: Record<string, LucideIcon> = {
  'wifi': Wifi,
  'charging': Zap,
  'accessibility': Accessibility,
  'toilet': Bath,
  'rest_area': Armchair,
  'locker': Box,
  'other': HelpCircle
}

export default function FacilityList({ items }: Props) {
  if (!items || items.length === 0) {
    return <div className="p-4 text-center text-gray-500 text-sm">暫無設施資訊</div>
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
      <ul className="space-y-3">
        {items.map((it) => {
          const Icon = ICON_MAP[it.category] || HelpCircle
          const name = (it.attributes as any)?.name?.zh || (it.attributes as any)?.name?.en || it.subCategory
          const desc = [
             it.location.floor ? `${it.location.floor}F` : null,
             it.location.direction,
             (it.attributes as any)?.is_free ? '免費' : null
          ].filter(Boolean).join(' • ')

          return (
            <li key={it.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate capitalize">
                  {name.replace(/_/g, ' ')}
                </div>
                {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
              </div>
              {it.openingHours === '24 Hours' && (
                 <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">24H</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

