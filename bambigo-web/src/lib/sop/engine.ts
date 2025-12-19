import { L3ServiceFacility } from '../../types/tagging';
import { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import { ab } from '../utils/ab-testing';

// --- Types ---
export interface DisasterZone {
  id: string;
  type: 'flood' | 'fire' | 'closure' | 'other';
  geometry: Polygon;
  severity: 'low' | 'medium' | 'high';
}

// --- Cache Implementation ---
const ROUTE_CACHE_KEY = 'bambigo_route_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: FeatureCollection;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * ONLY FOR TESTING: Clears the memory cache
 */
export function clearRouteCache() {
  memoryCache.clear();
}

function getCacheKey(start: [number, number], end: [number, number], profile: string): string {
  return `${profile}_${start.join(',')}_${end.join(',')}`;
}

function saveToCache(key: string, data: FeatureCollection) {
  const entry: CacheEntry = { data, timestamp: Date.now() };
  memoryCache.set(key, entry);
  
  // Also save to LocalStorage for persistence
  try {
    const existing = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
    existing[key] = entry;
    localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(existing));
  } catch (e) {
    // Ignore storage errors (e.g. quota exceeded)
  }
}

function getFromCache(key: string): FeatureCollection | null {
  // 1. Check memory
  const memEntry = memoryCache.get(key);
  if (memEntry && (Date.now() - memEntry.timestamp < CACHE_TTL)) {
    console.log('⚡ Route Cache Hit (Memory):', key);
    return memEntry.data;
  }

  // 2. Check LocalStorage
  try {
    const storage = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
    const entry = storage[key] as CacheEntry;
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
      console.log('⚡ Route Cache Hit (LocalStorage):', key);
      // Backfill memory cache
      memoryCache.set(key, entry);
      return entry.data;
    }
  } catch (e) {}

  return null;
}

// --- Distance & Nearest ---
export function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371e3; // metres
  const φ1 = p1[1] * Math.PI / 180; // lat
  const φ2 = p2[1] * Math.PI / 180;
  const Δφ = (p2[1] - p1[1]) * Math.PI / 180;
  const Δλ = (p2[0] - p1[0]) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function findNearestFacility(
  userLocation: [number, number],
  facilities: L3ServiceFacility[],
  category?: string
): L3ServiceFacility | null {
  if (!facilities.length) return null;

  let nearest: L3ServiceFacility | null = null;
  let minDist = Infinity;

  const candidates = category 
    ? facilities.filter(f => f.category === category || f.subCategory === category)
    : facilities;

  for (const f of candidates) {
    if (!f.location.coordinates) continue;
    
    const dist = calculateDistance(userLocation, f.location.coordinates);
    if (dist < minDist) {
      minDist = dist;
      nearest = f;
    }
  }

  return nearest;
}

// --- Routing ---

/**
 * Fetches real walking routes from OSRM with Caching & Smart Obstacle Avoidance
 * Supports multiple route options: fastest, safest, shortest
 */
export async function fetchWalkingRoute(
  start: [number, number],
  end: [number, number],
  options: {
    avoidZones?: DisasterZone[],
    profile?: 'walking' | 'driving' | 'cycling',
    useCache?: boolean,
    preference?: 'fastest' | 'safest' | 'shortest'
  } = {}
): Promise<FeatureCollection> {
  // Use A/B testing to determine default preference if not specified
  const defaultPreference = ab.isEnabled('shortest_path_default') ? 'shortest' : 'fastest';
  const { profile = 'walking', useCache = true, avoidZones = [], preference = defaultPreference } = options;
  const cacheKey = `${getCacheKey(start, end, profile)}_${preference}`;

  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
  }

  // Request multiple alternatives to find a safe path
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&alternatives=true&steps=true`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok') {
      throw new Error(`OSRM Error: ${data.code}`);
    }

    const routes = data.routes;
    let selectedRoute = routes[0];

    // --- Safest Route Logic ---
    if (avoidZones.length > 0) {
      // Try to find a route that doesn't intersect any zone
      const safeRoutes = routes.filter((r: any) => !checkRouteSafety(r.geometry.coordinates, avoidZones));
      
      if (safeRoutes.length > 0) {
        // Pick the best from safe routes based on preference
        if (preference === 'shortest') {
          selectedRoute = safeRoutes.sort((a: any, b: any) => a.distance - b.distance)[0];
        } else {
          selectedRoute = safeRoutes[0]; // OSRM's first is usually fastest
        }
      } else {
        // All routes are compromised, pick the one with least intersection? 
        // For now, just mark the primary as compromised
        selectedRoute.is_compromised = true;
      }
    } else if (preference === 'shortest') {
      selectedRoute = routes.sort((a: any, b: any) => a.distance - b.distance)[0];
    }

    const feature: Feature<LineString> = {
      type: 'Feature',
      properties: {
        type: 'sop_route',
        distance: selectedRoute.distance,
        duration: selectedRoute.duration,
        profile,
        preference,
        safety_status: selectedRoute.is_compromised ? 'compromised' : 'safe',
        warning: selectedRoute.is_compromised ? 'Route passes through hazardous zone' : undefined,
        timestamp: Date.now(),
        steps: selectedRoute.legs?.[0]?.steps?.map((s: any) => ({
          instruction: s.maneuver.instruction,
          type: mapManeuverType(s.maneuver.type, s.maneuver.modifier),
          distance: s.distance,
          duration: s.duration,
          location: s.maneuver.location
        })) || []
      },
      geometry: selectedRoute.geometry
    };

    // Include alternative routes in the feature collection for UI selection
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [feature]
    };

    // Add alternatives as low-opacity features if requested (could be used by UI)
    routes.forEach((r: any, idx: number) => {
      if (r === selectedRoute) return;
      fc.features.push({
        type: 'Feature',
        properties: {
          type: 'sop_route_alternative',
          index: idx,
          distance: r.distance,
          duration: r.duration,
          is_safe: !checkRouteSafety(r.geometry.coordinates, avoidZones),
          steps: r.legs?.[0]?.steps?.map((s: any) => ({
            instruction: s.maneuver.instruction,
            type: mapManeuverType(s.maneuver.type, s.maneuver.modifier),
            distance: s.distance,
            duration: s.duration,
            location: s.maneuver.location
          })) || []
        },
        geometry: r.geometry
      });
    });

    if (useCache) saveToCache(cacheKey, fc);
    return fc;
  } catch (error) {
    console.error('Failed to fetch real route, falling back to straight line:', error);
    return createRouteToFacility(start, end);
  }
}

/**
 * Maps OSRM maneuver types to our NavigationStep types
 */
function mapManeuverType(type: string, modifier?: string): string {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'start';
  
  switch (modifier) {
    case 'left': return 'turn-left';
    case 'right': return 'turn-right';
    case 'slight left': return 'turn-slight-left';
    case 'slight right': return 'turn-slight-right';
    case 'uturn': return 'u-turn';
    default: return 'straight';
  }
}

/**
 * Enhanced safety check for route: checks if any segment intersects with hazardous zones
 */
export function checkRouteSafety(path: [number, number][], zones: DisasterZone[]): boolean {
  for (const zone of zones) {
    const polygon = zone.geometry.coordinates[0]; // Outer ring
    
    // 1. Check if any point is inside
    for (const point of path) {
      if (isPointInPolygon(point, polygon as [number, number][])) return true;
    }

    // 2. Check if any segment intersects polygon boundaries
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      for (let j = 0; j < polygon.length - 1; j++) {
        const v1 = polygon[j];
        const v2 = polygon[j + 1];
        if (doSegmentsIntersect(p1, p2, v1 as [number, number], v2 as [number, number])) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Helper to check if two line segments intersect
 */
function doSegmentsIntersect(
  p1: [number, number], p2: [number, number], 
  p3: [number, number], p4: [number, number]
): boolean {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function createRouteToFacility(
  start: [number, number],
  end: [number, number]
): FeatureCollection {
  const routeFeature: Feature = {
    type: 'Feature',
    properties: { type: 'sop_route' },
    geometry: {
      type: 'LineString',
      coordinates: [start, end]
    }
  };

  return {
    type: 'FeatureCollection',
    features: [routeFeature]
  };
}
