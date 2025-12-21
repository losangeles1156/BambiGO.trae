'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  ChevronRight, ChevronLeft, MapPin, Navigation, 
  SlidersHorizontal, RefreshCw, Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '@/contexts/LanguageContext';
import { L1_CATEGORIES_DATA } from './constants';
import { fetchWalkingRoute } from '@/lib/sop/engine';

// --- Types ---
interface Place {
  id: string;
  name: string;
  category: { main: string; sub: string };
  location: { lat: number; lng: number };
  address: string;
  distance: number; // meters
  openNow: boolean;
  rating?: number;
}

type RouteSummary = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  distanceMeters?: number;
  durationSeconds?: number;
};

interface L1ServiceLocatorProps {
  userLocation?: { lat: number; lng: number };
  onPlaceSelect?: (place: Place) => void;
  className?: string;
}

type CenterSource = 'prop' | 'geolocation' | 'fallback';

// --- Mock Data Generator ---
// In a real app, this would fetch from an API (OSM/Backend)
const generateMockPlaces = (
  mainCat: string, 
  subCat: string, 
  center: { lat: number; lng: number }, 
  radius: number
): Place[] => {
  const count = Math.floor(Math.random() * 5) + 3; // 3-8 places
  return Array.from({ length: count }).map((_, i) => {
    // Random offset within radius (approx)
    // 1 deg lat ~ 111km => 1m ~ 0.000009 deg
    const offsetLat = (Math.random() - 0.5) * (radius * 2 / 111000);
    const offsetLng = (Math.random() - 0.5) * (radius * 2 / (111000 * Math.cos(center.lat * Math.PI / 180)));
    
    const dist = Math.sqrt(offsetLat*offsetLat + offsetLng*offsetLng) * 111000; // rough linear approx

    return {
      id: `${mainCat}-${subCat}-${i}`,
      name: `${subCat.charAt(0).toUpperCase() + subCat.slice(1)} Spot ${i + 1}`,
      category: { main: mainCat, sub: subCat },
      location: { 
        lat: center.lat + offsetLat, 
        lng: center.lng + offsetLng 
      },
      address: `${Math.floor(dist)}m from center`,
      distance: Math.floor(dist), // This would be recalculated based on user pos
      openNow: Math.random() > 0.2,
      rating: 3 + Math.random() * 2
    };
  }).sort((a, b) => a.distance - b.distance);
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const φ1 = a.lat * Math.PI / 180;
  const φ2 = b.lat * Math.PI / 180;
  const Δφ = (b.lat - a.lat) * Math.PI / 180;
  const Δλ = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const φ1 = a.lat * Math.PI / 180;
  const φ2 = b.lat * Math.PI / 180;
  const Δλ = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const deg = (θ * 180 / Math.PI + 360) % 360;
  return deg;
}

function compass8(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// --- Component ---
export default function L1ServiceLocator({ userLocation, onPlaceSelect, className }: L1ServiceLocatorProps) {
  const { t } = useLanguage();
  
  // State
  const [view, setView] = useState<'main' | 'sub' | 'places'>('main');
  const [selectedMain, setSelectedMain] = useState<typeof L1_CATEGORIES_DATA[0] | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [radius, setRadius] = useState(300); // meters
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [routeByPlaceId, setRouteByPlaceId] = useState<Record<string, RouteSummary>>({});

  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geoOk, setGeoOk] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const radiusDebounceRef = useRef<number | null>(null);

  const center = useMemo(() => {
    if (userLocation) return userLocation;
    if (geoCenter) return geoCenter;
    return { lat: 35.6812, lng: 139.7671 };
  }, [geoCenter, userLocation]);

  const centerSource: CenterSource = userLocation ? 'prop' : geoCenter ? 'geolocation' : 'fallback';

  useEffect(() => {
    if (userLocation) return;

    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoOk(true);
      },
      () => {
        setGeoCenter(null);
        setGeoOk(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [userLocation]);

  // Handlers
  const handleMainSelect = (cat: typeof L1_CATEGORIES_DATA[0]) => {
    setSelectedMain(cat);
    setView('sub');
  };

  const handleSubSelect = (subId: string) => {
    setSelectedSub(subId);
    setView('places');
    fetchPlaces(selectedMain!.id, subId);
  };

  const fetchPlaces = useCallback(async (mainId: string, subId: string) => {
    setLoading(true);
    // Simulate network delay for "Cold start" requirement check
    await new Promise(resolve => setTimeout(resolve, 600)); 
    
    const newPlaces = generateMockPlaces(mainId, subId, center, radius).map((p) => {
      const d = Math.round(haversineMeters(center, p.location));
      return { ...p, distance: d, address: p.address || `${d}m` };
    }).sort((a, b) => a.distance - b.distance);
    setPlaces(newPlaces);
    setLastUpdated(new Date());
    setLoading(false);
  }, [center, radius]);

  useEffect(() => {
    if (view !== 'places') return;
    if (!selectedMain || !selectedSub) return;
    if (radiusDebounceRef.current) window.clearTimeout(radiusDebounceRef.current);
    radiusDebounceRef.current = window.setTimeout(() => {
      fetchPlaces(selectedMain.id, selectedSub);
    }, 250);
    return () => {
      if (radiusDebounceRef.current) window.clearTimeout(radiusDebounceRef.current);
      radiusDebounceRef.current = null;
    };
  }, [fetchPlaces, selectedMain, selectedSub, view]);

  const handleBack = () => {
    if (view === 'places') setView('sub');
    else if (view === 'sub') {
      setView('main');
      setSelectedMain(null);
    }
  };

  const openGoogleMaps = (place: Place) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${center.lat},${center.lng}&destination=${place.location.lat},${place.location.lng}&travelmode=walking`;
    window.open(url, '_blank');
  };

  // Distance formatting
  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
    return `${m}m`;
  };

  const formatDurationMin = (sec: number) => {
    const min = Math.max(1, Math.round(sec / 60));
    return `${min}${t('navigation.minutes')}`;
  };

  const ensureWalkingRoute = async (place: Place) => {
    const existing = routeByPlaceId[place.id];
    if (existing?.status === 'loading' || existing?.status === 'ready') return;
    setRouteByPlaceId((prev) => ({ ...prev, [place.id]: { status: 'loading' } }));
    try {
      const start: [number, number] = [center.lng, center.lat];
      const end: [number, number] = [place.location.lng, place.location.lat];
      const fc = await fetchWalkingRoute(start, end, { profile: 'walking', useCache: true });
      const feature = fc.features?.[0];
      const props = (feature?.properties || {}) as { distance?: number; duration?: number };
      const distanceMeters = typeof props.distance === 'number' ? Math.round(props.distance) : undefined;
      const durationSeconds = typeof props.duration === 'number' ? Math.round(props.duration) : undefined;
      setRouteByPlaceId((prev) => ({
        ...prev,
        [place.id]: { status: 'ready', distanceMeters, durationSeconds },
      }));
    } catch {
      setRouteByPlaceId((prev) => ({ ...prev, [place.id]: { status: 'error' } }));
    }
  };

  const personaLine = useMemo(() => {
    const traits: string[] = [];
    if (selectedMain?.id === 'transport') traits.push(t('tagging.persona.transitHub'));
    if (selectedMain?.id === 'residential') traits.push(t('tagging.persona.localVibe'));
    if (selectedMain?.id === 'business') traits.push(t('tagging.persona.digitalNomadReady'));
    if (selectedMain?.id === 'medical') traits.push(t('tagging.persona.accessibleFriendly'));
    if (selectedMain?.id === 'dining' && selectedSub === 'cafe') traits.push(t('tagging.persona.digitalNomadReady'));
    if (places.some((p) => p.openNow === false)) traits.push(t('tagging.l1PersonaCrowdHint'));
    const unique = Array.from(new Set(traits)).filter(Boolean).slice(0, 3);
    const body = unique.length ? unique.join(' · ') : t('tagging.l1PersonaPlaceholder');
    return `${t('tagging.personasLabel')}：${body}`;
  }, [places, selectedMain?.id, selectedSub, t]);

  const centerBadge = useMemo(() => {
    if (centerSource === 'geolocation' && geoOk) return t('tagging.l1CenterGps');
    if (centerSource === 'prop') return t('tagging.l1CenterNode');
    return t('tagging.l1CenterFallback');
  }, [centerSource, geoOk, t]);

  return (
    <div className={clsx("bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]", className)}>
      
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-600">{personaLine}</div>
          <div className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
            {centerBadge}
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {view !== 'main' && (
              <button onClick={handleBack} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            )}
            <h3 className="font-bold text-gray-800">
              {view === 'main' ? t('tagging.l1Title') : 
               view === 'sub' ? t(`tagging.l1.${selectedMain?.id}.label`) :
               t(`tagging.l1.${selectedMain?.id}.${selectedSub}`)}
            </h3>
          </div>
          {lastUpdated && view === 'places' && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <RefreshCw size={10} /> {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Range Slider (Only visible in Places view or globally?) 
            Let's make it global but disabled in main view if needed, 
            or just show in Places view where it matters most. 
            User req: "Strictly limit display radius... Adjustable" 
        */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
           <SlidersHorizontal size={16} className="text-gray-400" />
           <div className="flex-1 flex flex-col">
             <div className="flex justify-between text-[10px] text-gray-500 font-medium uppercase tracking-wider">
               <span>{t('tagging.l1RadiusLabel')}</span>
               <span>{radius}m</span>
             </div>
             <input 
               type="range" 
               min="100" 
               max="500" 
                step="50"
               value={radius}
               onChange={(e) => {
                 setRadius(Number(e.target.value));
               }}
               className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
             />
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth">
        
        {/* VIEW: MAIN CATEGORIES */}
        {view === 'main' && (
          <div className="p-4 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
            {L1_CATEGORIES_DATA.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleMainSelect(cat)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 group"
              >
                <span className="text-4xl mb-3 filter drop-shadow-sm group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="font-bold text-gray-700 group-hover:text-blue-700">{t(`tagging.l1.${cat.id}.label`)}</span>
              </button>
            ))}
          </div>
        )}

        {/* VIEW: SUB CATEGORIES */}
        {view === 'sub' && selectedMain && (
          <div className="p-2 space-y-1 animate-in fade-in slide-in-from-right-8 duration-300">
            {selectedMain.subCategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleSubSelect(sub.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-200 group-hover:bg-blue-500 transition-colors" />
                  <span className="font-medium text-gray-700 group-hover:text-blue-700 text-lg">
                    {t(`tagging.l1.${selectedMain.id}.${sub.id}`)}
                  </span>
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        )}

        {/* VIEW: PLACES LIST */}
        {view === 'places' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <RefreshCw className="animate-spin mb-2" size={24} />
                <span className="text-xs">{t('common.loading')}</span>
              </div>
            ) : places.length === 0 ? (
              <div className="text-center text-gray-400 py-10">
                {t('tagging.l1NoPlacesPrefix')} {radius}m. <br/>{t('tagging.l1NoPlacesTryIncrease')}
              </div>
            ) : (
              places.map((place, idx) => {
                const route = routeByPlaceId[place.id] || { status: 'idle' as const };
                const isExpanded = expandedPlaceId === place.id;
                return (
                <div 
                  key={place.id}
                  className="bg-white rounded-2xl p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 border border-transparent hover:border-blue-100 group relative overflow-hidden"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-2xl shadow-inner">
                        {selectedMain?.icon}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                          {place.name}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <MapPin size={12} />
                          <span>{place.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", place.openNow ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                             {place.openNow ? t('tagging.l1OpenNow') : t('tagging.l1Closed')}
                           </span>
                           <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                             <Clock size={10} /> 09:00 - 22:00
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-semibold">{t('navigation.straightLine')}</div>
                      <span className="block text-lg font-bold text-blue-600">
                        {formatDistance(place.distance)}
                      </span>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{t('navigation.straightLine')}</span>
                        <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {compass8(bearingDeg(center, place.location))} · {formatDistance(place.distance)}
                        </span>
                        <button
                          onClick={() => openGoogleMaps(place)}
                          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white inline-flex items-center justify-center shadow-sm"
                          aria-label={t('common.openGoogleMaps')}
                        >
                          <Navigation size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                    <button 
                      onClick={async () => {
                        setExpandedPlaceId((prev) => (prev === place.id ? null : place.id));
                        if (!isExpanded) await ensureWalkingRoute(place);
                        onPlaceSelect?.(place);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                      {t('tagging.l1Details')}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-gray-600">{t('navigation.distance')} / {t('navigation.duration')}</div>
                        {route.status === 'loading' && (
                          <div className="text-gray-500">{t('navigation.calculating')}</div>
                        )}
                        {route.status === 'error' && (
                          <div className="text-gray-500">{t('navigation.distance')}：{formatDistance(place.distance)}</div>
                        )}
                        {route.status === 'ready' && (
                          <div className="text-gray-700 font-semibold">
                            {route.distanceMeters ? formatDistance(route.distanceMeters) : formatDistance(place.distance)}
                            {route.durationSeconds ? ` · ${formatDurationMin(route.durationSeconds)}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
