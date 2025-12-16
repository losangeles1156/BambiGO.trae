'use client'
import { useState } from 'react'
type RouteCard = { title: string; steps: string[] }
type Props = { destination: string | null }
export default function TaskMode({ destination }: Props) {
  const [guard, setGuard] = useState(true)
  const route: RouteCard = { title: destination ? `前往 ${destination}` : '前往目的地', steps: ['步行至出口 3', '搭乘銀座線至淺草', '步行 400m 到目的地'] }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-sm font-semibold">{route.title}</div>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {route.steps.map((s, i) => (<li key={i}>{s}</li>))}
        </ul>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-sm">Trip Guard</div>
        <label className="inline-flex cursor-pointer items-center">
          <input type="checkbox" checked={guard} onChange={(e) => setGuard(e.target.checked)} />
          <span className="ml-2 text-sm">{guard ? '監控中' : '關閉'}</span>
        </label>
      </div>
    </div>
  )
}
