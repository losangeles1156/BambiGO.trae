'use client';

import React, { useState } from 'react';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { L1_CATEGORIES_DATA } from './constants';
import type { L1Category } from '@/types/tagging';

interface HierarchySelectorProps {
  onSelect: (tag: { main: L1Category; sub: string; label: string }) => void;
  className?: string;
}

export const HierarchySelector: React.FC<HierarchySelectorProps> = ({ onSelect, className }) => {
  const [viewState, setViewState] = useState<'main' | 'sub'>('main');
  const [selectedMain, setSelectedMain] = useState<typeof L1_CATEGORIES_DATA[0] | null>(null);

  const handleMainSelect = (category: typeof L1_CATEGORIES_DATA[0]) => {
    setSelectedMain(category);
    setViewState('sub');
  };

  const handleSubSelect = (subId: string, subLabel: string) => {
    if (selectedMain) {
      onSelect({
        main: selectedMain.id,
        sub: subId,
        label: `${selectedMain.label.split(' ')[0]} > ${subLabel}`
      });
      // Reset view
      setViewState('main');
      setSelectedMain(null);
    }
  };

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden w-full', className)}>
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">Add Life Function (L1)</h3>
        {viewState === 'sub' && (
          <button 
            onClick={() => setViewState('main')}
            className="text-xs text-blue-600 hover:underline flex items-center"
          >
            <ChevronLeftIcon className="w-3 h-3 mr-1" /> Back
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {viewState === 'main' ? (
          <div className="divide-y divide-gray-100">
            {L1_CATEGORIES_DATA.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleMainSelect(cat)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-gray-700 font-medium text-sm">{cat.label}</span>
                </span>
                <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 animate-in slide-in-from-right-4 fade-in duration-200">
            <div className="px-4 py-2 bg-blue-50/50 text-xs text-blue-600 font-semibold uppercase tracking-wider">
              {selectedMain?.label} Sub-categories
            </div>
            {selectedMain?.subCategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleSubSelect(sub.id, sub.label)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
              >
                <span className="text-gray-600 text-sm">{sub.label}</span>
                <span className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs font-medium">Select</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
