'use client';

import React from 'react';
import NodeDetailCard from '@/components/cards/NodeDetailCard';
import FacilityProfile from '@/components/node/FacilityProfile';

export default function L1FacilityProfileDemo() {
  const mockCounts = {
    shopping: 23,
    dining: 18,
    leisure: 8,
    medical: 5,
    finance: 3,
    education: 1
  };

  const mockVibeTags = ['購物天堂', '美食激戰區', '文化聚落'];

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">L1 Facility Profile & Three-Zone UI Demo</h1>
          <p className="text-gray-600 mt-2">基於 L1_FACILITY_TAGS.md 與 UI_SPEC.md 規範實作</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">1. FacilityProfile Component (Standalone)</h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-4">機能指紋與 Vibe Tags</h3>
            <FacilityProfile counts={mockCounts} vibeTags={mockVibeTags} />
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">2. NodeDetailCard Three-Zone Strategy</h2>

          <div className="space-y-3">
            <h3 className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Core Zone (核心圈)
            </h3>
            <p className="text-sm text-gray-500 italic">完整顯示所有 L1-L4 標籤與設施資訊</p>
            <div className="w-full max-w-md">
              <NodeDetailCard
                name={{ zh: "上野站", en: "Ueno Station", ja: "上野駅" }}
                zone="core"
                l1Summary="購物與餐飲中心"
                facilityCounts={mockCounts}
                vibeTags={mockVibeTags}
                crowdLevel="medium"
                crowdTrend="stable"
                facilities={[
                  { id: 'f1', name: 'Atre Ueno', type: 'shop', icon: null },
                  { id: 'f2', name: 'Ichiran Ramen', type: 'service', icon: null },
                  { id: 'f3', name: 'FamilyMart', type: 'shop', icon: null }
                ]}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="inline-block px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Buffer Zone (緩衝圈)
            </h3>
            <p className="text-sm text-gray-500 italic">套用 Grayscale 濾鏡，僅保留基礎導航資訊</p>
            <div className="w-full max-w-md">
              <NodeDetailCard
                name={{ zh: "入谷站", en: "Iriya Station", ja: "入谷駅" }}
                zone="buffer"
                l1Summary="住宅區機能"
                facilityCounts={{ shopping: 5, dining: 3, medical: 0, education: 0, leisure: 0, finance: 0 }}
                vibeTags={['安靜住宅']}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Outer Zone (外圍圈)
            </h3>
            <p className="text-sm text-gray-500 italic">觸發「超出範圍」Fallback UI，引導用戶返回都心</p>
            <div className="w-full max-w-md">
              <NodeDetailCard
                name={{ zh: "取手站", en: "Toride Station", ja: "取手駅" }}
                zone="outer"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">3. Data Edge Cases</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-4">無資料狀態 (Empty Stats)</h3>
              <FacilityProfile counts={{ shopping: 0, dining: 0, medical: 0, education: 0, leisure: 0, finance: 0 }} vibeTags={[]} />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-4">單一類別 (Shopping Only)</h3>
              <FacilityProfile counts={{ shopping: 50, dining: 0, medical: 0, education: 0, leisure: 0, finance: 0 }} vibeTags={['購物狂天堂']} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
