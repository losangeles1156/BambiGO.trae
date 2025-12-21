'use client'
import { L3ServiceFacility } from '../../types/tagging'
import { LucideIcon, Wifi, Zap, Accessibility, Bath, Armchair, Box, HelpCircle, Edit2, Trash2 } from 'lucide-react'

type Props = { 
  items: L3ServiceFacility[]
  onEdit?: (item: L3ServiceFacility) => void
  onDelete?: (id: string) => void
}

const ICON_MAP: Record<string, LucideIcon> = {
  'wifi': Wifi,
  'charging': Zap,
  'accessibility': Accessibility,
  'toilet': Bath,
  'rest_area': Armchair,
  'locker': Box,
  'other': HelpCircle
}

export default function FacilityList({ items, onEdit, onDelete }: Props) {
  if (!items || items.length === 0) {
    return <div className="p-4 text-center text-gray-500 text-sm">暫無設施資訊</div>
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
      <ul className="space-y-3">
        {items.map((it) => {
          const Icon = ICON_MAP[it.category] || HelpCircle
          const iconId = `l3_${it.category}`
          const attrs = (it.attributes || {}) as Record<string, unknown>
          const nameObj = attrs.name as { zh?: string; en?: string } | undefined
          const name = (nameObj?.zh || nameObj?.en || it.subCategory)
          
          // Generate rich description based on category
          const details = []
          if (it.location?.floor) details.push(`${it.location.floor}`)
          if (it.location?.direction) details.push(it.location.direction)
          
          if (it.category === 'wifi' && typeof attrs.ssid === 'string') details.push(`SSID: ${attrs.ssid}`)
          if (it.category === 'toilet') {
             const wheelchair = attrs.has_wheelchair_access === true || attrs.accessible === true || attrs.has_accessible === true
             const baby = attrs.has_baby_care === true || attrs.baby_care === true
             if (wheelchair) details.push('♿')
             if (baby) details.push('👶')
             if (typeof attrs.door_width === 'number') details.push(`🚪${attrs.door_width}cm`)
          }
          if (it.category === 'charging') {
             if (typeof attrs.socket_type === 'string') details.push(attrs.socket_type)
             if (attrs.fast_charge === true) details.push('⚡Fast')
          }
          if (it.category === 'accessibility' && typeof attrs.elevator_width === 'number') details.push(`↔️${attrs.elevator_width}cm`)
          if (it.category === 'locker') {
            if (typeof attrs.locker_bank_count === 'number') details.push(`Banks: ${attrs.locker_bank_count}`)
            const payment = attrs.payment
            if (Array.isArray(payment) && payment.length) details.push(`Pay: ${payment.map(String).join('/')}`)
            if (typeof payment === 'string' && payment.trim()) details.push(`Pay: ${payment}`)
            const size = attrs.size
            if (Array.isArray(size) && size.length) details.push(`Size: ${size.map(String).join('/')}`)
            if (typeof size === 'string' && size.trim()) details.push(`Size: ${size}`)
          }

          const desc = details.join(' • ')

          return (
            <li key={it.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors group">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <span className={`node-icon__sprite node-icon__sprite--l3 node-icon__sprite--${iconId}`} aria-hidden="true" />
                <Icon size={16} className="node-icon__fallback" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate capitalize">
                  {name.replace(/_/g, ' ')}
                </div>
                {desc && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{desc}</div>}
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <button 
                    onClick={() => onEdit(it)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {onDelete && (
                  <button 
                    onClick={() => onDelete(it.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
