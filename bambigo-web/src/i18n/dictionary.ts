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
    backToCenter: string
    manageTags: string
    swipeUpForDetails: string
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
}

export const dictionary: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  'en': en,
  'ja': ja
}
