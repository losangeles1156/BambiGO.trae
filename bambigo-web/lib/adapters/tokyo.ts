export interface CityAdapter {
  id: string
  hasSubway: boolean
  hasSharedMobility: boolean
  hasBus: boolean
  odptOperators: string[]
  gbfsSystems: string[]
  defaultLanguage: 'zh-TW' | 'ja' | 'en'
  bounds: {
    sw: [number, number]
    ne: [number, number]
  }
}

export const tokyoAdapter: CityAdapter = {
  id: 'tokyo_core',
  hasSubway: true,
  hasSharedMobility: true,
  hasBus: true,
  odptOperators: ['odpt.Operator:TokyoMetro', 'odpt.Operator:Toei', 'odpt.Operator:JR-East'],
  gbfsSystems: ['docomo-cycle-tokyo', 'luup'],
  defaultLanguage: 'zh-TW',
  bounds: {
    sw: [139.73, 35.65],
    ne: [139.82, 35.74]
  }
}
