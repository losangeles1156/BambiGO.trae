import { zhTW } from './locales/zh-TW'
import { en } from './locales/en'
import { ja } from './locales/ja'

export type Locale = 'zh-TW' | 'en' | 'ja'

export type Dictionary = {
  common: {
    offline: string
    install: string
    loading: string
    places: string
    inputPlaceholder: string
    send: string
    hazardReported: string
    searchPlaceholder: string
    voiceSearch: string
    settings: string
    menu: string
    profile: string
    safetyCenter: string
    emergencyContacts: string
    safetyGuide: string
    helpSupport: string
    signOut: string
    language: string
    theme: string
    lightMode: string
    darkMode: string
    back: string
    simulate: string
    cancel: string
    finish: string
    monitoring: string
    paused: string
    landmark: string
    start: string
    destination: string
    home: string
    version: string
    outOfRange: string
    openGoogleMaps: string
    refresh: string
    backToCenter: string
    manageTags: string
    swipeUpForDetails: string
    remove: string
    tapForDetails: string
  },
  header: {
    youAreAt: string
    defaultLocation: string
    elderlyMode: string
    elderlyModeOn: string
    weather: string
    rainRoute: string
    crowdNormal: string
    eventActive: string
    langLabel: string
    weatherRain: string
  }
  dashboard: {
    suggestedActions: string
    nearbyFacilities: string
    sharedMobility: string
    aiGuide: string
    aiWelcome: string
    manage: string
    quickActions: string
    realTimeAlert: string
    loginRequired: string
    bikeTitle: string
    bikeDesc: string
    bikeAction: string
    toiletTitle: string
    toiletDesc: string
    navAction: string
    transitTitle: string
    transitDelayed: string
    transitSuspended: string
    transitDelayMinutes: string
    transitAlternative: string
    transitInfo: string
    transitAbnormal: string
    transitDetail: string
    taxiTitle: string
    taxiDesc: string
    taxiAction: string
    understand: string
    view: string
    doneEditing: string
    manageFacilities: string
    transport: string
    crowdStatus: string
    crowdCrowded: string
    crowdNormal: string
    crowdQuiet: string
    crowdEstimate: string
    tripGuardEnroll: string
    tripGuardDesc: string
  }
  actions: {
    toilet: string
    locker: string
    asakusa: string
    evacuate: string
    reportHazard: string
  }
  shelters: {
    emergency: string
    tsunami: string
    flood: string
    fire: string
    medical: string
  }
  navigation: {
    title: string
    next: string
    remaining: string
    minutes: string
    turnLeft: string
    turnRight: string
    turnSlightLeft: string
    turnSlightRight: string
    uTurn: string
    arrive: string
    start: string
    straight: string
    straightLine: string
    fastest: string
    safest: string
    shortest: string
    destination: string
    distance: string
    duration: string
    nearest: string
    calculating: string
    walking: string
    safety: string
    tripGuard: string
  }
  alert: {
    expand: string
    collapse: string
    moreSuffix: string
    l4: {
      seek_shelter: string
      secure_items: string
      avoid_underground: string
      bring_umbrella: string
    }
    type: {
      weather: string
      earthquake: string
      other: string
    }
  }

  tagging: {
    managerRegionLabel: string
    activeTagsLabel: string
    l1Title: string
    l2Title: string
    l3Title: string
    l4Title: string
    l1RadiusLabel: string
    l1NoPlacesPrefix: string
    l1NoPlacesTryIncrease: string
    l1OpenNow: string
    l1Closed: string
    l1Details: string
    l1PersonaPlaceholder: string
    l1PersonaCrowdHint: string
    l1CenterGps: string
    l1CenterNode: string
    l1CenterFallback: string
    l2AlertsLabel: string
    l2NoAlerts: string
    l2TransitNormal: string
    l2TransitDelayed: string
    l2TransitSuspended: string
    l2TransitUnknown: string
    l3LocationUnknown: string
    l3ValueLabel: string
    l3ValuePlaceholder: string
    l3Mvp: {
      toilet: string
      locker: string
      charging: string
      atm: string
      accessibility: string
      bike: string
    }
    l4Contexts: {
      luggage: string
      stroller: string
      wheelchair: string
      rush: string
    }
    l1: {
      dining: {
        label: string
        izakaya: string
        ramen: string
        cafe: string
        restaurant: string
        fast_food: string
      }
      shopping: {
        label: string
        drugstore: string
        convenience_store: string
        electronics: string
        supermarket: string
      }
      medical: {
        label: string
        clinic: string
        pharmacy: string
        hospital: string
        dentist: string
      }
      leisure: {
        label: string
        park: string
        museum: string
        gym: string
        cinema: string
        karaoke: string
      }
      education: {
        label: string
        school: string
        university: string
        library: string
      }
      finance: {
        label: string
        bank: string
        atm: string
        currency_exchange: string
      }
      accommodation: {
        label: string
        hotel: string
        hostel: string
        apartment: string
      }
      business: {
        label: string
        office: string
        coworking: string
        factory: string
      }
      religion: {
        label: string
        shrine: string
        temple: string
        church: string
      }
      public: {
        label: string
        police: string
        post_office: string
        government: string
      }
      transport: {
        label: string
        station: string
        bus_stop: string
        parking: string
      }
      nature: {
        label: string
        scenic_spot: string
        garden: string
        mountain: string
      }
      residential: {
        label: string
        apartment: string
        house: string
      }
    }
    l2: {
      odpt: { label: string; normal: string; delay: string; suspended: string }
      crowd: { label: string; normal: string; high: string; veryHigh: string }
      weather: { label: string; sunny: string; rain: string; storm: string }
      mobility: {
        label: string
        available: string
        scarce: string
      }
    }
    l3: {
      wifi: string
      toilet: string
      charging: string
      locker: string
      accessibility: string
      rest_area: string
      other: string
    }
    subCategories: string
    filterBarLabel: string
    serviceFilterPrefix: string
    serviceTagDistribution: string
    generateStrategy: string
    strategyCardTitle: string
    strategyEngineTitle: string
    strategyEngineSubtitle: string
    strategyEmptyBody: string
    selectNodeToGenerate: string
    personasLabel: string
    persona: {
      transitHub: string
      localVibe: string
      digitalNomadReady: string
      accessibleFriendly: string
    }
    addTag: string
    addL1: string
    back: string
    layers: {
      l1: { name: string, description: string }
      l2: { name: string, description: string }
      l3: { name: string, description: string }
      l4: { name: string, description: string }
    }
  }

  nodeDetail: {
    outOfRangeTitle: string
    planRouteBack: string
    later: string
    serviceFacilitiesTitle: string
    trafficTitle: string
    crowdTitle: string
    crowdHistorical: string
    crowdTrendLabel: string
    crowdComfort: string
    crowdMedium: string
    crowdHigh: string
    trendUp: string
    trendDown: string
    trendStable: string
    nearbyFacilitiesTitle: string
    bufferNotice: string
    bufferLearnMore: string
  }
}

export const dictionary: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  'en': en,
  'ja': ja
}
