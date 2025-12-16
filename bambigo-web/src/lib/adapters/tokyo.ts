import type { CityAdapter } from './types'

export const tokyoCoreAdapter: CityAdapter = {
  id: 'tokyo_core',
  name: { zh: '東京都心', ja: '東京都心', en: 'Central Tokyo' },
  bounds: [139.73, 35.65, 139.82, 35.74],
  zone_type: 'core',
  features: { hasSubway: true, hasSharedMobility: true, hasTaxiIntegration: true },
}

export const tokyoBufferAdapter: CityAdapter = {
  id: 'tokyo_buffer',
  name: { zh: '東京周邊', ja: '東京周辺', en: 'Greater Tokyo' },
  // A loose buffer around core; can be refined later
  bounds: [139.60, 35.55, 139.95, 35.85],
  zone_type: 'buffer',
  features: { hasSubway: true, hasSharedMobility: false, hasTaxiIntegration: false },
}

