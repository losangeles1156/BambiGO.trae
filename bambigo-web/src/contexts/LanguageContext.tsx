'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { dictionary, Locale, Dictionary } from '../i18n/dictionary'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string) => string
  dict: Dictionary
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-TW')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true) // eslint-disable-line
    // 1. Check localStorage
    const saved = localStorage.getItem('appLang') as Locale
    if (saved && ['zh-TW', 'en', 'ja'].includes(saved)) {
      setLocaleState(saved)
      document.documentElement.lang = saved === 'zh-TW' ? 'zh-TW' : saved
      return
    }

    // 2. Check navigator
    const nav = navigator.language
    if (nav.startsWith('en')) {
      setLocaleState('en')
    } else if (nav.startsWith('ja')) {
      setLocaleState('ja')
    } else {
      setLocaleState('zh-TW')
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('appLang', newLocale)
    document.documentElement.lang = newLocale === 'zh-TW' ? 'zh-TW' : newLocale
  }, [])

  const t = useCallback((path: string): string => {
    const keys = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = dictionary[locale]
    for (const key of keys) {
      if (current[key] === undefined) return path
      current = current[key]
    }
    return current as string
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t, dict: dictionary[locale] }), [locale, setLocale, t])

  if (!mounted) {
     // Return null or initial state to prevent hydration mismatch if needed, 
     // but here we just render children with default 'zh-TW' to avoid flicker
     // Ideally we might want to wait for mount to know the real language, 
     // but for SEO/SSR 'zh-TW' default is fine.
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
