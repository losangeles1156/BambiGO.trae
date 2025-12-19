export type JsonB = Record<string, string>

export function getLocalizedName(name: JsonB | null | undefined, locale: string): string {
  if (!name) return ''
  
  // Prioritize global override if running in browser
  let targetLocale = locale
  if (typeof window !== 'undefined') {
     const stored = localStorage.getItem('appLang')
     if (stored) targetLocale = stored
     else if (document.documentElement.lang) targetLocale = document.documentElement.lang
  }

  // Normalize locale (e.g. zh-TW, ja-JP -> ja)
  // Special case: zh-TW is kept as is, others simplified to prefix
  const lang = targetLocale === 'zh-TW' ? 'zh-TW' : targetLocale.split('-')[0]
  
  // Try exact match first, then fallbacks
  // Order: Requested -> zh-TW -> ja -> en -> First available
  return name[targetLocale] || name[lang] || name['zh-TW'] || name['zh'] || name['ja'] || name['en'] || Object.values(name)[0] || ''
}
