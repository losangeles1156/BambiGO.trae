import { describe, it, expect } from 'vitest';
import { calculateDistance, findNearestFacility, createRouteToFacility } from '../src/lib/sop/engine';
import { L3ServiceFacility } from '../src/types/tagging';

describe('SOP Engine', () => {
  it('should calculate distance correctly (Haversine)', () => {
    // Tokyo Station -> Imperial Palace (approx 1km)
    const p1: [number, number] = [139.7671, 35.6812];
    const p2: [number, number] = [139.7528, 35.6852];
    
    const dist = calculateDistance(p1, p2);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1500);
  });

  it('should find the nearest facility', () => {
    const userLoc: [number, number] = [139.7671, 35.6812]; // Tokyo Station
    
    const facilities: L3ServiceFacility[] = [
      {
        id: '1', nodeId: 'n1', category: 'shelter', subCategory: 'school',
        location: { coordinates: [139.77, 35.68] }, // Close
        provider: { type: 'public' }, attributes: {}
      },
      {
        id: '2', nodeId: 'n2', category: 'shelter', subCategory: 'gym',
        location: { coordinates: [139.80, 35.70] }, // Far
        provider: { type: 'public' }, attributes: {}
      }
    ];

    const nearest = findNearestFacility(userLoc, facilities);
    expect(nearest?.id).toBe('1');
  });

  it('should filter by category if provided', () => {
    const userLoc: [number, number] = [139.7671, 35.6812];
    
    const facilities: L3ServiceFacility[] = [
      {
        id: '1', nodeId: 'n1', category: 'shelter', subCategory: 'school',
        location: { coordinates: [139.77, 35.68] },
        provider: { type: 'public' }, attributes: {}
      },
      {
        id: '2', nodeId: 'n2', category: 'medical_aid', subCategory: 'hospital',
        location: { coordinates: [139.7672, 35.6813] }, // Closer but wrong type
        provider: { type: 'public' }, attributes: {}
      }
    ];

    const nearest = findNearestFacility(userLoc, facilities, 'shelter');
    expect(nearest?.id).toBe('1');
  });

  it('should create a GeoJSON route', () => {
    const start: [number, number] = [0, 0];
    const end: [number, number] = [1, 1];
    const route = createRouteToFacility(start, end);
    
    expect(route.type).toBe('FeatureCollection');
    expect(route.features[0].geometry.type).toBe('LineString');
    expect((route.features[0].geometry as any).coordinates).toEqual([start, end]);
  });
});
