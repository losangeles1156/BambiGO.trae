'use client'

import { useState, useEffect, useMemo } from 'react'
import NavigationCard, { NavigationStep } from '../features/navigation/NavigationCard'
import { CheckCircle2, Shield, AlertTriangle, XCircle } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

type Props = { 
  destination: string | null
  onExit?: () => void
  steps?: NavigationStep[]
}

// Mock Data Generation
const generateRoute = (dest: string, t: any): NavigationStep[] => [
  { id: '1', type: 'start', instruction: t('header.langLabel') === '日' ? '北に進み、中央通りへ' : '往北走，前往中央通', distance: 50, secondaryText: `${t('common.start')}：${t('header.defaultLocation')}` },
  { id: '2', type: 'straight', instruction: t('header.langLabel') === '日' ? '中央通りを直進' : '沿著中央通直行', distance: 300 },
  { id: '3', type: 'turn-left', instruction: t('header.langLabel') === '日' ? '左折して雷門通りへ' : '左轉進入雷門通り', distance: 150, secondaryText: `${t('common.landmark')}：FamilyMart` },
  { id: '4', type: 'straight', instruction: t('header.langLabel') === '日' ? '雷門を通過' : '直行經過雷門', distance: 200 },
  { id: '5', type: 'arrive', instruction: `${t('common.destination')} ${dest || ''}`, distance: 0 }
]

export default function TaskMode({ destination, onExit, steps }: Props) {
  const { t } = useLanguage()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [guard, setGuard] = useState(true)
  const [progress, setProgress] = useState(0)

  const defaultRoute = useMemo(() => generateRoute(destination || t('common.destination'), t), [destination, t])
  const route = steps && steps.length > 0 ? steps : defaultRoute

  // Simulate progress
  useEffect(() => {
    // Reset progress on step change
    setProgress(0)
    
    if (currentStepIndex >= route.length - 1) {
      setProgress(100)
      return
    }
    
    const timer = setInterval(() => {
      setProgress(p => Math.min(p + 1, 95)) // Cap at 95 until manual next
    }, 100)
    
    return () => clearInterval(timer)
  }, [currentStepIndex, route])

  const nextStep = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentStepIndex < route.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
      setProgress(0)
    }
  }

  const prevStep = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
      setProgress(0)
    }
  }

  const handleExit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onExit?.()
  }

  if (route.length === 0) return null

  const currentStep = route[currentStepIndex]
  const nextStepData = route[currentStepIndex + 1]
  const isFinished = currentStepIndex === route.length - 1

  return (
    <div className="flex flex-col h-full relative pointer-events-none">
      {/* Top Navigation Card Area */}
      <div className="p-4 z-20 pointer-events-auto">
        <NavigationCard 
          currentStep={currentStep}
          nextStep={nextStepData}
          totalDistance={route.slice(currentStepIndex).reduce((acc: number, s: NavigationStep) => acc + s.distance, 0)}
          totalTime={Math.ceil(route.slice(currentStepIndex).reduce((acc: number, s: NavigationStep) => acc + s.distance, 0) / 80)} // Approx 80m/min
          progress={progress}
        />
      </div>

      {/* Map Interaction Layer (Placeholder for transparency) */}
      <div className="flex-1" />

      {/* Bottom Controls */}
      <div className="p-4 space-y-3 z-20 bg-gradient-to-t from-white/90 via-white/50 to-transparent pb-8 pointer-events-auto">
        
        {/* Guard Status */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${guard ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{t('navigation.tripGuard')}</div>
              <div className="text-xs text-gray-500">{guard ? t('common.monitoring') : t('common.paused')}</div>
            </div>
          </div>
          <button 
            onClick={() => setGuard(!guard)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${guard ? 'bg-green-500' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${guard ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Simulation Controls (For Demo) */}
        <div className="grid grid-cols-2 gap-3">
          {!isFinished ? (
            <>
              <button 
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="bg-white text-gray-700 border border-gray-200 shadow-sm active:scale-95 transition-transform py-3 text-sm font-medium rounded-xl disabled:opacity-50"
              >
                {t('common.back')}
              </button>
              <button 
                onClick={nextStep}
                className="bg-gray-900 text-white py-3 text-sm font-medium rounded-xl shadow-lg active:scale-95 transition-transform"
              >
                {t('common.simulate')}
              </button>
            </>
          ) : (
            <button 
              onClick={handleExit}
              className="col-span-2 bg-green-500 text-white py-3 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
              {t('common.finish')}
            </button>
          )}
        </div>
        
        <button onClick={handleExit} className="w-full text-center text-xs text-gray-400 py-2">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
