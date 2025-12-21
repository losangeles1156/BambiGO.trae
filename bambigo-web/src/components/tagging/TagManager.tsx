'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { 
  ChevronDown, ChevronUp, Briefcase, Baby, Wheelchair, Timer, 
  TrainFront, AlertTriangle, CloudRain, Users, 
  Utensils, ShoppingBag, Stethoscope, Palmtree, GraduationCap, 
  Landmark, Building2, Ticket, Home, Bus, Wifi, Zap, 
  Accessibility as AccessibilityIcon, Coffee, Info
} from 'lucide-react'
import type { AppTag, TagState } from '../../lib/tagging'
import * as tagging from '../../lib/tagging'
import { useLanguage } from '@/contexts/LanguageContext'
import { L4StrategyCard } from './L4StrategyCard'
import type { L4ActionCard } from '@/types/tagging'
import { clsx } from 'clsx'

type Props = {
  value?: TagState
  onChange?: (next: TagState) => void
  nodeId?: string
}

type OdptStatus = 'normal' | 'delay' | 'suspended';

export default function TagManager({ value, onChange, nodeId }: Props) {
  const { t } = useLanguage()
  const [state, setState] = useState<TagState>(value || { tags: [] })
  const [strategy, setStrategy] = useState<L4ActionCard | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  
  const [odptStatus, setOdptStatus] = useState<OdptStatus>('normal');

  const [l4Contexts, setL4Contexts] = useState({
    luggage: false,
    stroller: false,
    wheelchair: false,
    rush: false
  });

  useEffect(() => {
    if (value) setState(value)
  }, [value])

  const apply = (updater: (prev: TagState) => TagState) => {
    setState((prev) => {
      const next = updater(prev)
      onChange?.(next)
      return next
    })
  }

  const toggleTag = (id: string, layer: 'L1' | 'L2' | 'L3', label: string, extra?: any) => {
    apply((prev) => {
      if (prev.tags.some((x) => x.id === id)) return tagging.deleteTag(prev, id)
      return tagging.createTag(prev, { id, layer, label, ...extra })
    })
  }

  const isActive = (id: string) => state.tags.some((x) => x.id === id)

  // L1 Categories Configuration
  const l1Categories = [
    { id: 'dining', icon: Utensils, color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { id: 'shopping', icon: ShoppingBag, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'transport', icon: Bus, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'leisure', icon: Palmtree, color: 'text-green-600 bg-green-50 border-green-200' },
    { id: 'medical', icon: Stethoscope, color: 'text-red-600 bg-red-50 border-red-200' },
    { id: 'business', icon: Briefcase, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  ]

  // L3 Amenities Configuration
  const l3Amenities = [
    { id: 'wifi', icon: Wifi },
    { id: 'toilet', icon: Baby }, // Using Baby as proxy for restroom/care? Or maybe separate.
    { id: 'charging', icon: Zap },
    { id: 'accessibility', icon: AccessibilityIcon },
    { id: 'rest_area', icon: Coffee },
  ]

  const generateL4 = async () => {
    if (strategyLoading) return
    setStrategyLoading(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // Mock Smart Logic
      let mockStrategy: L4ActionCard;

      if (odptStatus === 'delay' || odptStatus === 'suspended') {
        if (l4Contexts.rush) {
          mockStrategy = {
            id: 'strategy-rush-delay',
            type: 'alert',
            title: t('tagging.l4Contexts.rush') + ' + ' + t('tagging.l2.odpt.delay'),
            description: odptStatus === 'suspended' 
              ? 'Train suspended. Recommended: Taxi to nearby major hub.' 
              : 'Train delayed. Recommended: Express Bus or Taxi to avoid waiting.',
            rationale: 'Time is critical. Avoid uncertain rail status.',
            knowledge: 'Note: Taxi stand at North Exit is often crowded during delays. Try South Exit app-based pickup.',
            actions: [
              { label: 'Find Taxi Stand', action: 'navigate_taxi' },
              { label: 'Check Bus Route', action: 'navigate_bus' }
            ]
          };
        } else {
          mockStrategy = {
            id: 'strategy-wait-delay',
            type: 'secondary',
            title: t('tagging.l2.odpt.delay') + ' - Relax Mode',
            description: 'Train is delayed. Why not wait at a nearby cafe?',
            rationale: 'Avoid crowd congestion on platform. Utilize L1 Cafe facilities.',
            knowledge: 'Tip: This station has a hidden underground passage to the department store (Exit B2).',
            actions: [
              { label: 'Find Nearby Cafe', action: 'filter_cafe' },
              { label: 'Check Rest Areas', action: 'filter_rest_area' }
            ]
          };
        }
      } else if (l4Contexts.luggage || l4Contexts.stroller || l4Contexts.wheelchair) {
        mockStrategy = {
          id: 'strategy-accessible',
          type: 'primary',
          title: 'Accessible Route Priority',
          description: 'Route optimized for elevators and wide gates.',
          rationale: 'Detected mobility constraints (Luggage/Stroller/Wheelchair).',
          knowledge: 'Warning: The elevator at West Gate is currently under maintenance. Use East Gate.',
          actions: [
            { label: 'Show Elevator Map', action: 'show_elevators' },
            { label: 'Station Accessibility Info', action: 'station_info' }
          ]
        };
      } else {
        mockStrategy = {
          id: 'strategy-normal',
          type: 'primary',
          title: 'Optimal Transit Route',
          description: 'Standard fastest route via subway.',
          rationale: 'Normal operation. No specific constraints.',
          knowledge: 'Did you know? Car 4 is closest to the stairs at the destination.',
          actions: [
            { label: 'Start Navigation', action: 'navigate_start' }
          ]
        };
      }

      setStrategy(mockStrategy);
    } catch (err) {
      console.error(err)
    } finally {
      setStrategyLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      
      {/* L2: Live Status Dashboard */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-violet-100 rounded text-violet-600">
            <TrainFront size={16} />
          </div>
          <span className="font-bold text-gray-800 text-sm">{t('tagging.l2Title')}</span>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {/* ODPT Status */}
          <div className="col-span-3 bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
             <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">{t('tagging.l2.odpt.label')}</span>
                {odptStatus !== 'normal' && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-bold animate-pulse">
                    <AlertTriangle size={12} />
                    Alert
                  </span>
                )}
             </div>
             <div className="flex gap-1">
               {(['normal', 'delay', 'suspended'] as const).map((s) => (
                 <button
                   key={s}
                   onClick={() => setOdptStatus(s)}
                   className={clsx(
                     "flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all border",
                     odptStatus === s
                       ? s === 'normal' 
                         ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                         : 'bg-red-500 text-white border-red-600 shadow-sm'
                       : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                   )}
                 >
                   {t(`tagging.l2.odpt.${s}`)}
                 </button>
               ))}
             </div>
          </div>

          {/* Weather & Crowd (Toggles) */}
          <button 
            onClick={() => toggleTag('L2:rain', 'L2', t('header.rainRoute'), { context: { weather: 'rain' } })}
            className={clsx(
              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1",
              isActive('L2:rain') 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50"
            )}
          >
            <CloudRain size={20} />
            <span className="text-[10px] font-medium">{t('tagging.l2.weather.label')}</span>
          </button>

          <button 
             onClick={() => toggleTag('L2:crowded', 'L2', t('dashboard.crowdCrowded'))}
             className={clsx(
              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1",
              isActive('L2:crowded') 
                ? "bg-amber-50 border-amber-200 text-amber-700" 
                : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50"
            )}
          >
            <Users size={20} />
            <span className="text-[10px] font-medium">{t('tagging.l2.crowd.label')}</span>
          </button>
        </div>
      </section>

      {/* L1: Service Finder (Quick Guide) */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="font-bold text-gray-800 text-sm">{t('tagging.l1Title')}</span>
          <span className="text-xs text-gray-400">Select to Find</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {l1Categories.map((cat) => {
             const active = isActive(`L1:${cat.id}:main`); // Simplified ID for demo
             return (
              <button
                key={cat.id}
                onClick={() => toggleTag(`L1:${cat.id}:main`, 'L1', t(`tagging.l1.${cat.id}.label`), { l1: { mainCategory: cat.id } })}
                className={clsx(
                  "flex flex-col items-center p-3 rounded-2xl border transition-all duration-200",
                  active 
                    ? cat.color + " ring-2 ring-offset-1 ring-black/5 shadow-sm" 
                    : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200"
                )}
              >
                <cat.icon size={24} className="mb-2 opacity-90" />
                <span className="text-xs font-semibold">{t(`tagging.l1.${cat.id}.label`)}</span>
              </button>
             )
          })}
        </div>
      </section>

      {/* L3: Amenities (Quick Check) */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <span className="font-bold text-gray-800 text-sm block mb-3">{t('tagging.l3Title')}</span>
        <div className="flex flex-wrap gap-3">
          {l3Amenities.map((item) => {
            const active = isActive(`L3:${item.id}:sub`);
            return (
              <button
                key={item.id}
                onClick={() => toggleTag(`L3:${item.id}:sub`, 'L3', t(`tagging.l3.${item.id}`), { l3: { subCategory: item.id } })}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border transition-all",
                  active
                    ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon size={14} />
                {t(`tagging.l3.${item.id}`)}
              </button>
            )
          })}
        </div>
      </section>

      {/* L4: Strategy Contexts & Action */}
      <section className="pt-2">
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-3xl p-5 border border-rose-100 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-rose-100 rounded text-rose-600">
                <Briefcase size={16} />
              </div>
              <span className="font-bold text-gray-900 text-sm">{t('tagging.l4Title')}</span>
           </div>

           {/* Personal Context Toggles */}
           <div className="flex flex-wrap gap-2 mb-6">
             {[
               { key: 'luggage', icon: Briefcase, label: t('tagging.l4Contexts.luggage') },
               { key: 'stroller', icon: Baby, label: t('tagging.l4Contexts.stroller') },
               { key: 'wheelchair', icon: Wheelchair, label: t('tagging.l4Contexts.wheelchair') },
               { key: 'rush', icon: Timer, label: t('tagging.l4Contexts.rush') }
             ].map((ctx) => (
               <button
                 key={ctx.key}
                 onClick={() => setL4Contexts(prev => ({ ...prev, [ctx.key]: !prev[ctx.key as keyof typeof l4Contexts] }))}
                 className={clsx(
                   "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                   l4Contexts[ctx.key as keyof typeof l4Contexts]
                     ? "bg-white text-rose-600 border-rose-200 shadow-sm"
                     : "bg-white/50 text-gray-500 border-transparent hover:bg-white/80"
                 )}
               >
                 <ctx.icon size={14} />
                 {ctx.label}
               </button>
             ))}
           </div>

           {/* Strategy Card */}
           <L4StrategyCard 
             strategy={strategy}
             isLoading={strategyLoading}
             onGenerate={generateL4}
             className="bg-white/80 backdrop-blur-sm"
           />
        </div>
      </section>

    </div>
  )
}
