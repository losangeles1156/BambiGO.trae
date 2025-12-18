'use client'

type Card = { title: string; desc?: string; primary?: string }
type Props = { cards: Card[]; onPrimaryClick?: (card: Card) => void }

export default function ActionCarousel({ cards, onPrimaryClick }: Props) {
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
      
      {cards.map((c, i) => (
        <div
          key={i}
          className={`
            snap-center shrink-0 
            ${i === 0 ? 'min-w-[80vw] md:min-w-[20rem] border-blue-500 bg-blue-50/90 backdrop-blur-sm' : 'min-w-[70vw] md:min-w-[16rem] bg-white/90 backdrop-blur-sm'} 
            rounded-2xl border ${i === 0 ? 'shadow-lg ring-1 ring-blue-500/20' : 'shadow-md ring-1 ring-black/5'} 
            p-4 flex flex-col justify-between
          `}
        >
          <div>
            <div className={`font-bold ${i === 0 ? 'text-base text-blue-900' : 'text-base text-gray-900'}`}>
              {c.title}
            </div>
            {c.desc && (
              <div className={`${i === 0 ? 'mt-2 text-sm text-blue-800/80' : 'mt-2 text-sm text-gray-600'}`}>
                {c.desc}
              </div>
            )}
          </div>
          
          {c.primary && (
            <button 
              onClick={() => onPrimaryClick?.(c)} 
              className={`
                mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm
                ${i === 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900'}
                active:scale-[0.97] transition-all
              `}
            >
              {c.primary}
            </button>
          )}
        </div>
      ))}
      {/* Spacer for end of list padding */}
      <div className="w-2 shrink-0" />
    </div>
  )
}
