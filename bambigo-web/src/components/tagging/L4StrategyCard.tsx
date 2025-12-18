import React from 'react';
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';
import type { L4ActionCard } from '@/types/tagging';

interface L4StrategyCardProps {
  strategy: L4ActionCard | null;
  isLoading?: boolean;
  onGenerate: () => void;
  className?: string;
}

export const L4StrategyCard: React.FC<L4StrategyCardProps> = ({ 
  strategy, 
  isLoading, 
  onGenerate,
  className 
}) => {
  return (
    <div className={clsx("rounded-2xl overflow-hidden border transition-all duration-300", 
      strategy 
        ? "border-rose-200 shadow-lg shadow-rose-100/50 bg-gradient-to-br from-white to-rose-50/30" 
        : "border-dashed border-gray-300 bg-gray-50/50",
      className
    )}>
      {/* Header / Empty State Action */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={clsx("p-2 rounded-lg", strategy ? "bg-rose-100 text-rose-600" : "bg-gray-200 text-gray-500")}>
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className={clsx("font-bold text-lg leading-tight", strategy ? "text-gray-900" : "text-gray-500")}>
                {strategy ? 'Mobility Strategy' : 'AI Strategy Engine'}
              </h3>
              {!strategy && <p className="text-xs text-gray-400">Context-aware L4 insights</p>}
            </div>
          </div>
          
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-semibold shadow-sm transition-all flex items-center gap-2",
              isLoading 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : strategy
                  ? "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
                  : "bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:opacity-90 hover:shadow-md"
            )}
          >
            {isLoading ? (
              <>
                <ArrowRightIcon className="w-4 h-4 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                {strategy ? 'Regenerate' : 'Generate Insights'}
                {!strategy && <ArrowRightIcon className="w-4 h-4" />}
              </>
            )}
          </button>
        </div>

        {/* Strategy Content */}
        {strategy && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
            <div>
              <h4 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-orange-600">
                {strategy.title}
              </h4>
              <p className="text-gray-600 mt-2 leading-relaxed">
                {strategy.description}
              </p>
            </div>

            {/* Rationale Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-100 rounded-full text-xs text-rose-700 font-medium shadow-sm">
              <span>💡</span>
              <span>{strategy.rationale}</span>
            </div>

            {/* Actions */}
            {strategy.actions && strategy.actions.length > 0 && (
              <div className="pt-4 mt-2 border-t border-rose-100/50">
                <div className="space-y-2">
                  {strategy.actions.map((action, idx) => (
                    <button 
                      key={idx}
                      className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-rose-100 hover:border-rose-300 hover:shadow-md transition-all text-left"
                    >
                      <span className="font-medium text-gray-800 group-hover:text-rose-700 transition-colors">
                        {action.label}
                      </span>
                      <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transform group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {!strategy && !isLoading && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Analyze current tags, weather, and time to generate personalized mobility recommendations.
            </p>
          </div>
        )}
      </div>
      
      {/* Decorative Gradient Bar at Bottom */}
      {strategy && <div className="h-1.5 w-full bg-gradient-to-r from-rose-400 via-orange-400 to-rose-400" />}
    </div>
  );
};
