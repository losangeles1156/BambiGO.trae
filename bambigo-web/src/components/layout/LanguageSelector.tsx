'use client'

import React from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Locale } from '@/i18n/dictionary'
import { Globe } from 'lucide-react'
import { clsx } from 'clsx'

const languages: { label: string; value: Locale }[] = [
  { label: '繁中', value: 'zh-TW' },
  { label: 'EN', value: 'en' },
  { label: '日本語', value: 'ja' },
]

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage()

  return (
    <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
      <Globe className="w-3 h-3 text-slate-400 ml-1" />
      <div className="flex">
        {languages.map((lang) => (
          <button
            key={lang.value}
            onClick={() => setLocale(lang.value)}
            className={clsx(
              "px-2 py-0.5 text-[10px] font-bold rounded transition-all",
              locale === lang.value
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  )
}
