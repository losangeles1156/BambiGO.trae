export type JsonB = Record<string, string>

export function getLocalizedName(name: JsonB | null | undefined, locale: string): string {
  if (!name) return ''
  // Normalize locale (e.g. zh-TW, ja-JP -> ja)
  const lang = locale === 'zh-TW' ? 'zh-TW' : locale.split('-')[0]
  
  // Rule 2.6: zh-TW is default
  const fallback = Object.values(name)[0]
  return name[lang] || name['zh-TW'] || name['ja'] || name['en'] || (fallback ? String(fallback) : '')
}
