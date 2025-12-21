export interface StationIdentity {
  color: string;
  accentColor: string;
  textColor: string;
  lineCode?: string;
  operatorName?: string;
}

export const STATION_BRANDS: Record<string, StationIdentity> = {
  // Default fallback
  default: {
    color: '#2563eb', // blue-600
    accentColor: '#dbeafe', // blue-100
    textColor: '#ffffff',
    operatorName: 'Station',
  },
  
  // JR East - Yamanote Line (Green)
  'JR-East.Yamanote': {
    color: '#80C241',
    accentColor: '#e6f4d9',
    textColor: '#ffffff',
    lineCode: 'JY',
    operatorName: 'JR Yamanote',
  },
  
  // Tokyo Metro - Ginza Line (Orange)
  'TokyoMetro.Ginza': {
    color: '#F39700',
    accentColor: '#fdedcc',
    textColor: '#ffffff',
    lineCode: 'G',
    operatorName: 'Ginza Line',
  },

  // Tokyo Metro - Hibiya Line (Silver)
  'TokyoMetro.Hibiya': {
    color: '#9CAEB7',
    accentColor: '#ebf0f2',
    textColor: '#000000',
    lineCode: 'H',
    operatorName: 'Hibiya Line',
  },

  // Toei - Oedo Line (Magenta)
  'Toei.Oedo': {
    color: '#E60012',
    accentColor: '#fad9dc',
    textColor: '#ffffff',
    lineCode: 'E',
    operatorName: 'Oedo Line',
  },

  // Mock Mappings for Demo
  'mock-ueno': {
    color: '#80C241', // Yamanote Green
    accentColor: '#e6f4d9',
    textColor: '#ffffff',
    lineCode: 'JY',
    operatorName: 'JR East',
  },
  'mock-ginza': {
    color: '#F39700', // Ginza Orange
    accentColor: '#fdedcc',
    textColor: '#ffffff',
    lineCode: 'G',
    operatorName: 'Tokyo Metro',
  },
  'mock-tokyo': {
    color: '#E60012', // Marunouchi Red (approx)
    accentColor: '#fad9dc',
    textColor: '#ffffff',
    lineCode: 'M',
    operatorName: 'Tokyo Metro',
  }
};

export function getStationIdentity(nodeId?: string): StationIdentity {
  if (!nodeId) return STATION_BRANDS.default;

  // Direct match
  if (STATION_BRANDS[nodeId]) {
    return STATION_BRANDS[nodeId];
  }

  // Pattern match (e.g. odpt.Station:Toei.Oedo.Kachidoki -> Toei.Oedo)
  for (const key of Object.keys(STATION_BRANDS)) {
    if (nodeId.includes(key)) {
      return STATION_BRANDS[key];
    }
  }

  return STATION_BRANDS.default;
}
