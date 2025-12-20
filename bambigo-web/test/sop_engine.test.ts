import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWalkingRoute, checkRouteSafety, DisasterZone, clearRouteCache } from '../src/lib/sop/engine';

// Mock fetch for OSRM
global.fetch = vi.fn();

describe('SOP Engine - Routing & Safety', () => {
  const start: [number, number] = [139.777, 35.713]; // Ueno Station
  const end: [number, number] = [139.774, 35.714]; // Near Ueno Park

  const mockSafeRoute = {
    code: 'Ok',
    routes: [
      {
        distance: 500,
        duration: 360,
        geometry: {
          type: 'LineString',
          coordinates: [
            [139.775, 35.713],
            [139.774, 35.7135],
            [139.773, 35.714]
          ]
        },
        legs: [{
          steps: [
            {
              maneuver: { instruction: 'Head north', type: 'depart', modifier: 'straight', location: [139.777, 35.713] },
              distance: 250,
              duration: 180
            },
            {
              maneuver: { instruction: 'Arrive', type: 'arrive', modifier: 'straight', location: [139.775, 35.714] },
              distance: 0,
              duration: 0
            }
          ]
        }]
      }
    ]
  };

  const mockUnsafeRoute = {
    code: 'Ok',
    routes: [
      {
        distance: 400,
        duration: 300,
        geometry: {
          type: 'LineString',
          coordinates: [
            [139.777, 35.713],
            [139.7765, 35.7135], // Inside hazard zone
            [139.775, 35.714]
          ]
        },
        legs: [{
          steps: [
            {
              maneuver: { instruction: 'Go through fire', type: 'depart', modifier: 'straight', location: [139.777, 35.713] },
              distance: 400,
              duration: 300
            }
          ]
        }]
      }
    ]
  };

  const hazardZone: DisasterZone = {
    id: 'hazard-1',
    type: 'fire',
    severity: 'high',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [139.776, 35.713],
        [139.777, 35.713],
        [139.777, 35.714],
        [139.776, 35.714],
        [139.776, 35.713]
      ]]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearRouteCache();
  });

  it('successfully fetches a safe route', async () => {
    (global.fetch as any).mockResolvedValue({
      json: async () => mockSafeRoute
    });

    const result = await fetchWalkingRoute(start, end, { useCache: false });
    
    expect(result.features[0].properties!.safety_status).toBe('safe');
    expect(result.features[0].properties!.distance).toBe(500);
    expect(result.features[0].properties!.steps).toHaveLength(2);
  });

  it('identifies an unsafe route passing through hazard zone', async () => {
    (global.fetch as any).mockResolvedValue({
      json: async () => mockUnsafeRoute
    });

    const result = await fetchWalkingRoute(start, end, { 
      avoidZones: [hazardZone],
      useCache: false 
    });
    
    expect(result.features[0].properties!.safety_status).toBe('compromised');
    expect(result.features[0].properties!.warning).toContain('hazardous zone');
  });

  it('selects a safe alternative when primary is unsafe', async () => {
    (global.fetch as any).mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [
          mockUnsafeRoute.routes[0], // Primary is unsafe
          mockSafeRoute.routes[0]    // Alternative is safe
        ]
      })
    });

    const result = await fetchWalkingRoute(start, end, { 
      avoidZones: [hazardZone],
      useCache: false 
    });
    
    expect(result.features[0].properties!.safety_status).toBe('safe');
    expect(result.features[0].properties!.distance).toBe(500); // Should pick the safe one
  });

  it('prefers shortest route when specified', async () => {
    const longerSafeRoute = { ...mockSafeRoute.routes[0], distance: 1000 };
    const shorterSafeRoute = { ...mockSafeRoute.routes[0], distance: 500 };

    (global.fetch as any).mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [longerSafeRoute, shorterSafeRoute]
      })
    });

    const result = await fetchWalkingRoute(start, end, { 
      preference: 'shortest',
      useCache: false 
    });
    
    expect(result.features[0].properties!.distance).toBe(500);
  });

  it('checks segment-polygon intersection correctly', () => {
    const path: [number, number][] = [
      [0, 0],
      [10, 10]
    ];
    
    const zone: DisasterZone = {
      id: 'z1',
      type: 'flood',
      severity: 'medium',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [5, 0],
          [5, 10],
          [6, 10],
          [6, 0],
          [5, 0]
        ]]
      }
    };

    // This segment (0,0)->(10,10) intersects the vertical box (5,0)->(6,10)
    expect(checkRouteSafety(path, [zone])).toBe(true);

    const safePath: [number, number][] = [
      [0, 0],
      [4, 0]
    ];
    expect(checkRouteSafety(safePath, [zone])).toBe(false);
  });
});
