'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UserStatusSelector, UserStatus } from '@/components/tagging/UserStatusSelector';
import { ActionRecommendationCard, ActionRecommendation } from '@/components/tagging/ActionRecommendationCard';

// Mock logic to simulate AI engine
const MOCK_SCENARIOS: Record<string, ActionRecommendation> = {
  'luggage': {
    decision: "改走 A3 電梯出口，避開南口階梯",
    tip: "提示：南口雖近，但有 20 階樓梯且無手扶梯。A3 出口雖然繞路 3 分鐘，但全程無障礙。",
    tipType: 'info'
  },
  'rush': {
    decision: "直接前往 1 號車廂，最靠近轉乘通道",
    tip: "提示：此站轉乘通道位於月台最前端，下車後可直接上手扶梯，節省約 4 分鐘。",
    tipType: 'info'
  },
  'stroller+rush': {
    decision: "使用東口寬閘門，直達電梯",
    tip: "警告：中央口人潮極度擁擠，且電梯需排隊。東口雖然遠 50 公尺，但人流少且閘門寬敞。",
    tipType: 'warning'
  },
  'impaired': {
    decision: "請聯繫站務員預約斜坡板服務",
    tip: "提示：此月台間隙較大（約 15cm），建議在改札口先行告知站務員，他們會安排人員在月台等候。",
    tipType: 'info'
  },
  'luggage+rush': {
    decision: "搭乘後方電梯至 B1，轉乘銀座線",
    tip: "警告：前方手扶梯正在維修中，且樓梯狹窄。攜帶大型行李請務必使用後方電梯。",
    tipType: 'warning'
  },
  'default': {
    decision: "往 3 號出口方向前進",
    tip: "提示：3 號出口為主要地標出口，設有清楚的周邊地圖。",
    tipType: 'info'
  }
};

export default function L4RecommendationDemoPage() {
  const [selectedStatuses, setSelectedStatuses] = useState<UserStatus[]>([]);
  const [recommendation, setRecommendation] = useState<ActionRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const toggleStatus = (status: UserStatus) => {
    setSelectedStatuses((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      if (next.length === 0) {
        setRecommendation(null)
        setIsLoading(false)
        return next
      }

      setIsLoading(true)

      const key = next.slice().sort().join('+')
      let result = MOCK_SCENARIOS[key]
      if (!result) {
        const singleMatch = next.find((s) => MOCK_SCENARIOS[s])
        result = singleMatch ? MOCK_SCENARIOS[singleMatch] : MOCK_SCENARIOS['default']
      }

      timerRef.current = setTimeout(() => {
        setRecommendation(result)
        setIsLoading(false)
      }, 800)

      return next
    })
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-md mx-auto space-y-8">
        
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">L4 行動建議引擎</h1>
          <p className="text-gray-500">BambiGO Context-Aware UI Demo</p>
        </header>

        {/* 1. Status Selector */}
        <section>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            目前狀態 (可複選)
          </label>
          <UserStatusSelector 
            selectedStatuses={selectedStatuses} 
            onToggleStatus={toggleStatus} 
          />
        </section>

        {/* 2. Recommendation Card */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">
              AI 建議
            </label>
            {isLoading && <span className="text-xs text-rose-500 animate-pulse font-medium">分析最佳路徑中...</span>}
          </div>
          
          <ActionRecommendationCard 
            recommendation={recommendation}
            isLoading={isLoading}
          />
        </section>

        {/* Debug Info */}
        <section className="pt-8 border-t border-gray-200">
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">開發者資訊</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
              {JSON.stringify({ selectedStatuses, recommendation }, null, 2)}
            </pre>
          </details>
        </section>

      </div>
    </div>
  );
}
