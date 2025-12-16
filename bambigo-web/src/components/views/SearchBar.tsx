'use client'
import { useState } from 'react'
type Props = { onSubmit: (q: string) => void; onMic?: () => void }
export default function SearchBar({ onSubmit, onMic }: Props) {
  const [q, setQ] = useState('')
  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, right: 72, zIndex: 1000 }}>
      <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 shadow-sm">
        <input className="flex-1 bg-transparent text-sm outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋地點或需求" />
        <button className="rounded bg-blue-600 px-3 py-1 text-xs text-white" onClick={() => onSubmit(q)}>搜尋</button>
      </div>
      <button style={{ position: 'absolute', right: -48, bottom: 0 }} className="rounded-full bg-blue-600 p-3 text-white" onClick={onMic}>🎤</button>
    </div>
  )
}
