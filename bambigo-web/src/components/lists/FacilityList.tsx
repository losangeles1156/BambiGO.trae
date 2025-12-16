'use client'
type Item = { name: string; desc?: string; icon?: string }
type Props = { items: Item[] }
export default function FacilityList({ items }: Props) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded bg-blue-100" />
            <div>
              <div className="text-sm font-medium">{it.name}</div>
              {it.desc && <div className="text-xs text-gray-600">{it.desc}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

