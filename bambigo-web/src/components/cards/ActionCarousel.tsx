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
            ${i === 0 ? 'min-w-[80vw] md:min-w-[20rem]' : 'min-w-[70vw] md:min-w-[16rem]'} 
            rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 backdrop-blur-sm shadow-lg ring-1 ring-rose-200/40 
            p-4 flex flex-col justify-between
          `}
        >
          <div>
            <div className={`font-bold text-base text-rose-700`}>
              {c.title}
            </div>
            {c.desc && (
              <div className={`mt-2 text-sm text-gray-700`}>
                {c.desc}
              </div>
            )}
          </div>
          
          {c.primary && (
            <button 
              onClick={() => onPrimaryClick?.(c)} 
              className={`
                mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm
                bg-rose-600 hover:bg-rose-700
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
