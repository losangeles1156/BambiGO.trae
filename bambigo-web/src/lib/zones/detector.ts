export type Zone = 'core' | 'buffer' | 'outer'
import { getAdapter } from '../adapters'

function insideBBox(lon: number, lat: number, bbox: [number, number, number, number]): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
}

export function detectZoneFromPoint(lon: number, lat: number): Zone {
  const core = getAdapter('tokyo_core')
  const buffer = getAdapter('tokyo_buffer')
  if (core && insideBBox(lon, lat, core.bounds)) return 'core'
  if (buffer && insideBBox(lon, lat, buffer.bounds)) return 'buffer'
  return 'outer'
}
