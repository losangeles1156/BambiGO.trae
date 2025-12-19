'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { L3Category } from '../types/tagging'
import { WeatherAlert } from '../lib/weather/jma_rss'

export type SOPMode = 'normal' | 'emergency'

interface SOPState {
  mode: SOPMode
  activeAlert: WeatherAlert | null
  targetCategory: L3Category | null
  targetFacilityId: string | null
  navigationRoute: [number, number][] | null // Simple line string for now
}

interface SOPContextType extends SOPState {
  activateSOP: (alert: WeatherAlert, category: string) => void
  deactivateSOP: () => void
  selectFacility: (facilityId: string) => void
  setRoute: (route: [number, number][]) => void
}

const SOPContext = createContext<SOPContextType | undefined>(undefined)

export function SOPProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SOPMode>('normal')
  const [activeAlert, setActiveAlert] = useState<WeatherAlert | null>(null)
  const [targetCategory, setTargetCategory] = useState<L3Category | null>(null)
  const [targetFacilityId, setTargetFacilityId] = useState<string | null>(null)
  const [navigationRoute, setNavigationRoute] = useState<[number, number][] | null>(null)

  const activateSOP = useCallback((alert: WeatherAlert, category: string) => {
    console.log('SOP Activated:', alert.title, 'Target:', category)
    setMode('emergency')
    setActiveAlert(alert)
    // Map string to L3Category if possible, else default to 'other' (or specific logic)
    // We assume the tag passed is already a valid L3Category key or mapped
    setTargetCategory(category as L3Category)
  }, [])

  const deactivateSOP = useCallback(() => {
    setMode('normal')
    setActiveAlert(null)
    setTargetCategory(null)
    setTargetFacilityId(null)
    setNavigationRoute(null)
  }, [])

  const selectFacility = useCallback((facilityId: string) => {
    setTargetFacilityId(facilityId)
  }, [])

  const setRoute = useCallback((route: [number, number][]) => {
    setNavigationRoute(route)
  }, [])

  return (
    <SOPContext.Provider 
      value={{ 
        mode, 
        activeAlert, 
        targetCategory, 
        targetFacilityId,
        navigationRoute,
        activateSOP, 
        deactivateSOP,
        selectFacility,
        setRoute
      }}
    >
      {children}
    </SOPContext.Provider>
  )
}

export function useSOP() {
  const context = useContext(SOPContext)
  if (context === undefined) {
    throw new Error('useSOP must be used within a SOPProvider')
  }
  return context
}
