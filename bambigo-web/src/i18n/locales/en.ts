import { Dictionary } from '../dictionary'

export const en: Dictionary = {
  common: {
    offline: 'Offline',
    install: 'Install App',
    loading: 'Loading...',
    places: 'places',
    inputPlaceholder: 'Ask something...',
    send: 'Send',
    hazardReported: 'Hazard reported. Rerouting...',
    searchPlaceholder: 'Search places, facilities...',
    voiceSearch: 'Voice search',
    settings: 'Settings',
    menu: 'Menu',
    profile: 'Profile',
    safetyCenter: 'Safety Center',
    emergencyContacts: 'Emergency Contacts',
    safetyGuide: 'Safety Guide',
    helpSupport: 'Help & Support',
    signOut: 'Sign Out',
    language: 'Language',
    theme: 'Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    back: 'Back',
    simulate: 'Simulate',
    cancel: 'Cancel Navigation',
    finish: 'Finish Navigation',
    monitoring: 'Monitoring: Deviation will trigger alert',
    paused: 'Monitoring Paused',
    landmark: 'Landmark',
    start: 'Start',
    destination: 'Destination',
    home: 'Home',
    version: 'Version',
    outOfRange: 'Out of support area: Suggest returning to center or use Google Maps.',
    openGoogleMaps: 'Open Google Maps',
    backToCenter: 'Back to Center',
    manageTags: 'Manage Tags',
    swipeUpForDetails: 'Swipe up for details',
    remove: 'Remove',
    tapForDetails: 'Tap for details',
  },
  header: {
    youAreAt: 'You are at',
    defaultLocation: 'Tokyo Station',
    elderlyMode: 'Senior Mode',
    elderlyModeOn: 'Senior Mode On',
    weather: 'Weather',
    rainRoute: 'Rain Route Active',
    crowdNormal: 'Crowd: Normal',
    eventActive: 'Event Active',
    langLabel: 'EN',
    weatherRain: 'Rain 24°C'
  },
  dashboard: {
    suggestedActions: 'Suggested Actions',
    nearbyFacilities: 'Nearby Facilities',
    sharedMobility: 'Shared Mobility',
    aiGuide: 'AI Guide',
    aiWelcome: 'How can I help you?',
    manage: 'Manage',
    quickActions: 'Quick Actions',
    realTimeAlert: 'Real-time Alert',
    loginRequired: 'Please login to save locations',
    bikeTitle: 'Shared Bike',
    bikeDesc: '{n} stations nearby, {count} bikes available',
    bikeAction: 'Reserve',
    toiletTitle: 'Restroom',
    toiletDesc: 'Public restroom nearby',
    navAction: 'Navigate',
    transitTitle: 'Public Transit',
    transitDelayed: 'Delayed',
    transitSuspended: 'Suspended',
    transitDelayMinutes: 'Approx. {n} min',
    transitAlternative: 'Alternative Routes',
    transitInfo: 'Route Info',
    transitAbnormal: 'Service Disruption',
    transitDetail: 'View Detail',
    taxiTitle: 'Taxi Stand',
    taxiDesc: 'Taxi stand nearby',
    taxiAction: 'Call Taxi',
    understand: 'OK',
    view: 'View',
    doneEditing: 'Done',
    manageFacilities: 'Manage Facilities',
    transport: 'Transport',
    crowdStatus: 'Crowd Status',
    crowdCrowded: 'Crowded',
    crowdNormal: 'Normal',
    crowdQuiet: 'Quiet',
    crowdEstimate: 'Historical Estimate',
    tripGuardEnroll: 'Join Line Trip Guard',
    tripGuardDesc: 'Get real-time delay & anomaly alerts',
  },
  actions: {
    toilet: 'Find Toilet',
    locker: 'Find Locker',
    asakusa: 'To Asakusa',
    evacuate: 'Evacuate',
    reportHazard: 'Report Hazard'
  },
  shelters: {
    emergency: 'Emergency Shelter',
    tsunami: 'Tsunami Evacuation Building',
    flood: 'Flood Shelter',
    fire: 'Wide-area Evacuation Site',
    medical: 'First Aid Station'
  },
  navigation: {
    title: 'Route Navigation',
    next: 'Next',
    remaining: 'Remaining',
    minutes: 'min',
    turnLeft: 'Turn Left',
    turnRight: 'Turn Right',
    turnSlightLeft: 'Turn Slight Left',
    turnSlightRight: 'Turn Slight Right',
    uTurn: 'U-Turn',
    arrive: 'Arrive',
    start: 'Start',
    straight: 'Go Straight',
    fastest: 'Fastest',
    safest: 'Safest',
    shortest: 'Shortest',
    destination: 'Destination',
    distance: 'Distance',
    duration: 'Estimated Time',
    nearest: 'Nearest',
    calculating: 'Calculating route...',
    walking: 'Walking',
    safety: 'Safety First',
    tripGuard: 'Trip Guard'
  },
  alert: {
    expand: 'Details',
    collapse: 'Collapse',
    moreSuffix: 'more',
    l4: {
      seek_shelter: 'Seek Shelter',
      secure_items: 'Secure Items',
      avoid_underground: 'Avoid Underground',
      bring_umbrella: 'Bring Umbrella'
    },
    type: {
      weather: 'Weather',
      earthquake: 'Earthquake',
      other: 'Other'
    }
  },
  tagging: {
    managerRegionLabel: 'Tag Manager',
    activeTagsLabel: 'Active Tags',
    l1Title: 'L1 Categories (Structure)',
    l2Title: 'L2 Live Status (Dynamic)',
    l2: {
      odpt: {
        label: 'Train Status',
        normal: 'Normal Operation',
        delay: 'Delayed',
        suspended: 'Suspended'
      },
      weather: {
        label: 'Weather',
        rain: 'Rain',
        snow: 'Snow'
      },
      crowd: {
        label: 'Crowd',
        crowded: 'Crowded'
      }
    },
    l3Title: 'L3 Service Facilities (Utility)',
    l4Title: 'L4 Mobility Strategy (Action)',
    l4Contexts: {
      luggage: 'Large Luggage',
      stroller: 'Stroller',
      wheelchair: 'Wheelchair/Accessible',
      rush: 'In a Rush'
    },
    stationKnowledge: 'Station Knowledge',
    filterBarLabel: 'Tag Filter Bar',
    serviceFilterPrefix: 'Service filter',
    serviceTagDistribution: 'Service Tag Distribution',
    generateStrategy: 'Generate',
    strategyCardTitle: 'Mobility Strategy',
    strategyEngineTitle: 'AI Strategy Engine',
    strategyEngineSubtitle: 'Context-aware L4 insights',
    strategyEmptyBody: 'Analyze tags, weather, and time to generate personalized mobility recommendations.',
    selectNodeToGenerate: 'Select a node to generate a strategy',
    personasLabel: 'Derived Personas',
    persona: {
      transitHub: 'Transit Hub',
      localVibe: 'Local Vibe',
      digitalNomadReady: 'Digital Nomad Ready',
      accessibleFriendly: 'Accessibility Friendly',
    },
    addTag: 'Add Tag',
    addL1: 'Add Life Function (L1)',
    subCategories: '{{label}} Sub-categories',
    back: 'Back',
    layers: {
      l1: { name: 'Life Function', description: 'Structural/Static Categories' },
      l2: { name: 'Spatial Aggregation', description: 'Area/Atmosphere' },
      l3: { name: 'Service Facility', description: 'Utilities/Amenities' },
      l4: { name: 'Mobility Strategy', description: 'AI Suggestions' }
    },
    l1: {
      dining: {
        label: 'Dining',
        izakaya: 'Izakaya',
        ramen: 'Ramen',
        cafe: 'Cafe',
        restaurant: 'Restaurant',
        fast_food: 'Fast Food'
      },
      shopping: {
        label: 'Shopping',
        drugstore: 'Drugstore',
        convenience_store: 'Convenience Store',
        electronics: 'Electronics',
        supermarket: 'Supermarket'
      },
      medical: {
        label: 'Medical',
        clinic: 'Clinic',
        pharmacy: 'Pharmacy',
        hospital: 'Hospital',
        dentist: 'Dentist'
      },
      leisure: {
        label: 'Leisure',
        park: 'Park',
        museum: 'Museum',
        gym: 'Gym',
        cinema: 'Cinema',
        karaoke: 'Karaoke'
      },
      education: {
        label: 'Education',
        school: 'School',
        university: 'University',
        library: 'Library'
      },
      finance: {
        label: 'Finance',
        bank: 'Bank',
        atm: 'ATM',
        currency_exchange: 'Currency Exchange'
      },
      accommodation: {
        label: 'Accommodation',
        hotel: 'Hotel',
        hostel: 'Hostel',
        apartment: 'Apartment'
      },
      business: {
        label: 'Business',
        office: 'Office Building',
        coworking: 'Co-working Space',
        factory: 'Factory'
      },
      religion: {
        label: 'Religion',
        shrine: 'Shrine',
        temple: 'Temple',
        church: 'Church'
      },
      nature: {
        label: 'Nature',
        scenic_spot: 'Scenic Spot',
        garden: 'Garden',
        mountain: 'Mountain'
      },
      transport: {
        label: 'Transport',
        station: 'Station',
        bus_stop: 'Bus Stop',
        parking: 'Parking'
      },
      public: {
        label: 'Public',
        police: 'Police',
        post_office: 'Post Office',
        government: 'Government'
      },
      residential: {
        label: 'Residential',
        apartment_complex: 'Apartment Complex',
        housing: 'Housing'
      }
    },
    l3: {
      wifi: 'WiFi',
      toilet: 'Toilet',
      charging: 'Charging',
      locker: 'Locker',
      accessibility: 'Accessibility',
      rest_area: 'Rest Area',
      other: 'Other'
    }
  },
  nodeDetail: {
    outOfRangeTitle: 'Out of Support Area',
    planRouteBack: 'Plan route back to center',
    later: 'Not now',
    serviceFacilitiesTitle: 'Service Facilities (L3)',
    trafficTitle: 'Live Transit',
    crowdTitle: 'Crowd Forecast',
    crowdHistorical: 'Historical',
    crowdTrendLabel: 'Trend',
    crowdComfort: 'Comfortable',
    crowdMedium: 'Moderate',
    crowdHigh: 'Crowded',
    trendUp: 'Rising',
    trendDown: 'Easing',
    trendStable: 'Stable',
    nearbyFacilitiesTitle: 'Nearby Facilities',
    bufferNotice: 'This area provides basic navigation only',
    bufferLearnMore: 'Learn about zone layers',
  }
}
