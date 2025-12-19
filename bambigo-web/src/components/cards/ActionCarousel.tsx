'use client'

import { L4ActionCard } from '../../types/tagging'
import { Heart, Moon, Sun, Utensils, Wifi, Umbrella, Map as MapIcon, Shield, Zap, Baby, ArrowRight, Info } from 'lucide-react'

type Props = { 
  cards: L4ActionCard[]; 
  onPrimaryClick?: (card: L4ActionCard) => void 
}

const getCardStyle = (card: L4ActionCard) => {
  const tags = new Set(card.tags || [])
  const title = card.title.toLowerCase()

  if (title.includes('family') || tags.has('baby_care')) {
    return {
      bg: 'bg-gradient-to-br from-pink-50 to-rose-50',
      border: 'border-pink-200',
      text: 'text-pink-900',
      accent: 'text-pink-600',
      button: 'bg-pink-600 hover:bg-pink-700',
      icon: Baby
    }
  }
  if (title.includes('night') || tags.has('safety')) {
    return {
      bg: 'bg-gradient-to-br from-indigo-50 to-slate-100',
      border: 'border-indigo-200',
      text: 'text-indigo-900',
      accent: 'text-indigo-600',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      icon: Moon
    }
  }
  if (title.includes('heat') || tags.has('water')) {
    return {
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      border: 'border-orange-200',
      text: 'text-orange-900',
      accent: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700',
      icon: Sun
    }
  }
  if (title.includes('eat') || tags.has('dining')) {
    return {
      bg: 'bg-gradient-to-br from-orange-50 to-red-50',
      border: 'border-orange-200',
      text: 'text-orange-900',
      accent: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700',
      icon: Utensils
    }
  }
  if (tags.has('wifi') || tags.has('charging')) {
    return {
      bg: 'bg-gradient-to-br from-sky-50 to-blue-50',
      border: 'border-sky-200',
      text: 'text-sky-900',
      accent: 'text-sky-600',
      button: 'bg-sky-600 hover:bg-sky-700',
      icon: Wifi
    }
  }
  if (title.includes('rain') || tags.has('indoor')) {
    return {
      bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
      border: 'border-slate-200',
      text: 'text-slate-900',
      accent: 'text-slate-600',
      button: 'bg-slate-600 hover:bg-slate-700',
      icon: Umbrella
    }
  }
  if (title.includes('complex') || tags.has('transfer')) {
    return {
      bg: 'bg-gradient-to-br from-purple-50 to-fuchsia-50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      accent: 'text-purple-600',
      button: 'bg-purple-600 hover:bg-purple-700',
      icon: MapIcon
    }
  }

  // Default
  return {
    bg: 'bg-gradient-to-br from-gray-50 to-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    accent: 'text-gray-600',
    button: 'bg-gray-900 hover:bg-gray-800',
    icon: Info
  }
}

export default function ActionCarousel({ cards, onPrimaryClick }: Props) {
  if (!cards || cards.length === 0) return null

  return (
    <div 
      className="flex overflow-x-auto gap-3 p-2 snap-x snap-mandatory scrollbar-hide" 
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* Hidden scrollbar styles for Webkit */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {cards.map((c, i) => {
        const style = getCardStyle(c)
        const Icon = style.icon
        
        return (
          <div
            key={i}
            className={`
              snap-center shrink-0 
              ${i === 0 ? 'min-w-[85vw] md:min-w-[22rem]' : 'min-w-[80vw] md:min-w-[20rem]'} 
              rounded-2xl border ${style.border} ${style.bg} backdrop-blur-sm shadow-sm
              p-5 flex flex-col justify-between
            `}
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl bg-white/60 ${style.accent}`}>
                  <Icon size={20} />
                </div>
                {c.rationale && (
                  <div className="px-2 py-1 rounded-full bg-white/40 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    {c.rationale.length > 20 ? 'Recommendation' : c.rationale}
                  </div>
                )}
              </div>
              
              <h3 className={`font-bold text-lg ${style.text} mb-1`}>
                {c.title}
              </h3>
              
              <p className={`text-sm ${style.text} opacity-80 leading-relaxed`}>
                {c.description}
              </p>
            </div>
            
            {c.actions && c.actions.length > 0 && (
              <button 
                onClick={() => onPrimaryClick?.(c)} 
                className={`
                  mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm
                  flex items-center justify-center gap-2
                  ${style.button}
                  active:scale-[0.98] transition-all
                `}
              >
                {c.actions[0].label}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )
      })}
      {/* Spacer for end of list padding */}
      <div className="w-2 shrink-0" />
    </div>
  )
}
