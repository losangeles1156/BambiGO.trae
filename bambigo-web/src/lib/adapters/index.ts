import type { CityAdapter } from './types'
import { tokyoCoreAdapter, tokyoBufferAdapter } from './tokyo'

const registry: Record<string, CityAdapter> = {
  [tokyoCoreAdapter.id]: tokyoCoreAdapter,
  [tokyoBufferAdapter.id]: tokyoBufferAdapter,
}

export function getAdapter(id: string): CityAdapter | null {
  return registry[id] || null
}

export function listAdapters(): CityAdapter[] {
  return Object.values(registry)
}

