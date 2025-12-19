'use client'
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

type Props = { onSubmit: (q: string) => void; onMic?: () => void }

export default function SearchBar({ onSubmit, onMic }: Props) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  return (
    <div className="w-full px-4 pb-6 flex gap-3 max-w-md mx-auto">
      <div className="flex-1 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-md px-4 h-12 shadow-lg transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input 
          className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-500 outline-none" 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder={t('common.searchPlaceholder')} 
          onKeyDown={(e) => e.key === 'Enter' && onSubmit(q)}
        />
        {q && (
          <button onClick={() => setQ('')} className="p-1 text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>
      <button 
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 text-blue-600 active:scale-95 transition-transform" 
        onClick={onMic}
        aria-label={t('common.voiceSearch')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </button>
    </div>
  )
}
