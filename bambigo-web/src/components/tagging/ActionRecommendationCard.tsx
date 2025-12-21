'use client';

import React from 'react';
import { clsx } from 'clsx';
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  ArrowRightCircleIcon 
} from '@heroicons/react/24/solid';

export interface ActionRecommendation {
  decision: string;
  tip: string;
  tipType: 'warning' | 'info';
}

interface ActionRecommendationCardProps {
  recommendation: ActionRecommendation | null;
  isLoading?: boolean;
  className?: string;
}

export const ActionRecommendationCard: React.FC<ActionRecommendationCardProps> = ({
  recommendation,
  isLoading,
  className
}) => {
  if (isLoading) {
    return (
      <div className={clsx("w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse", className)}>
        <div className="h-8 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
        <div className="h-20 bg-gray-100 rounded-lg w-full"></div>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className={clsx("w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center", className)}>
        <p className="text-gray-400 font-medium">請選擇您的狀態以獲取建議</p>
      </div>
    );
  }

  const isWarning = recommendation.tipType === 'warning';

  return (
    <div className={clsx("w-full rounded-2xl overflow-hidden border shadow-lg transition-all duration-300", 
      "border-gray-200 bg-white",
      className
    )}>
      {/* (A) Decision Instruction - High Visibility Area */}
      <div className="bg-slate-900 text-white p-6">
        <div className="flex items-start gap-4">
          <ArrowRightCircleIcon className="w-10 h-10 text-emerald-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-1">
              建議行動 RECOMMENDED ACTION
            </p>
            <h2 className="text-2xl md:text-3xl font-black leading-tight tracking-tight">
              {recommendation.decision}
            </h2>
          </div>
        </div>
      </div>

      {/* (B) Transport Knowledge Tip - Contextual Info */}
      <div className={clsx(
        "p-5 border-t-4 flex items-start gap-3",
        isWarning ? "bg-amber-50 border-amber-400" : "bg-blue-50 border-blue-400"
      )}>
        {isWarning ? (
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        ) : (
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
        )}
        
        <div>
          <h3 className={clsx(
            "font-bold text-sm mb-1 uppercase tracking-wide",
            isWarning ? "text-amber-800" : "text-blue-800"
          )}>
            {isWarning ? '注意 WARNING' : '提示 INFO'}
          </h3>
          <p className={clsx(
            "text-base md:text-lg font-medium leading-relaxed",
            isWarning ? "text-amber-900" : "text-blue-900"
          )}>
            {recommendation.tip}
          </p>
        </div>
      </div>
    </div>
  );
};
