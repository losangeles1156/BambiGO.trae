'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [focusIndex, setFocusIndex] = useState(0);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleMainSelect = (category: typeof L1_CATEGORIES_DATA[0]) => {
    setSelectedMain(category);
    setViewState('sub');
    setFocusIndex(0);
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
      setFocusIndex(0);
    }
  };

  useEffect(() => {
    const el = itemsRef.current[focusIndex];
    el?.focus();
  }, [focusIndex, viewState]);

  const currentItems = useMemo(() => {
    return viewState === 'main' ? L1_CATEGORIES_DATA : (selectedMain?.subCategories || []);
  }, [viewState, selectedMain]);

  const handleKeyNav = (e: React.KeyboardEvent, idx: number) => {
    if (viewState === 'main') {
      const cols = 3;
      const max = currentItems.length - 1;
      if (e.key === 'ArrowRight') setFocusIndex(Math.min(idx + 1, max));
      else if (e.key === 'ArrowLeft') setFocusIndex(Math.max(idx - 1, 0));
      else if (e.key === 'ArrowDown') setFocusIndex(Math.min(idx + cols, max));
      else if (e.key === 'ArrowUp') setFocusIndex(Math.max(idx - cols, 0));
      else if (e.key === 'Enter' || e.key === ' ') {
        const item = L1_CATEGORIES_DATA[idx];
        if (item) handleMainSelect(item);
      }
    } else {
      const max = currentItems.length - 1;
      if (e.key === 'ArrowDown') setFocusIndex(Math.min(idx + 1, max));
      else if (e.key === 'ArrowUp') setFocusIndex(Math.max(idx - 1, 0));
      else if (e.key === 'Enter' || e.key === ' ') {
        const item = selectedMain?.subCategories[idx];
        if (item) handleSubSelect(item.id, item.label);
      } else if (e.key === 'Escape') {
        setViewState('main');
        setFocusIndex(0);
      }
    }
  };

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden w-full', className)} role="tree" aria-label="L1 Hierarchy">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">Add Life Function (L1)</h3>
        {viewState === 'sub' && (
          <button 
            onClick={() => setViewState('main')}
            className="text-xs text-blue-600 hover:underline flex items-center"
            aria-expanded={viewState === 'sub'}
          >
            <ChevronLeftIcon className="w-3 h-3 mr-1" /> Back
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {viewState === 'main' ? (
          <div className="grid grid-cols-3 gap-2 p-2">
            {L1_CATEGORIES_DATA.map((cat, i) => (
              <button
                key={cat.id}
                ref={(el) => { itemsRef.current[i] = el }}
                onClick={() => handleMainSelect(cat)}
                onKeyDown={(e) => handleKeyNav(e, i)}
                tabIndex={i === focusIndex ? 0 : -1}
                role="treeitem"
                aria-expanded={selectedMain?.id === cat.id ? true : false}
                className="flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs font-medium text-center">{cat.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 animate-in slide-in-from-right-4 fade-in duration-200">
            <div className="px-4 py-2 bg-blue-50/50 text-xs text-blue-600 font-semibold uppercase tracking-wider">
              {selectedMain?.label} Sub-categories
            </div>
            {selectedMain?.subCategories.map((sub, i) => (
              <button
                key={sub.id}
                ref={(el) => { itemsRef.current[i] = el }}
                onClick={() => handleSubSelect(sub.id, sub.label)}
                onKeyDown={(e) => handleKeyNav(e, i)}
                tabIndex={i === focusIndex ? 0 : -1}
                role="treeitem"
                aria-selected={i === focusIndex}
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

interface HierarchicalPopoverProps {
  onSelect: (tag: { main: L1Category; sub: string; label: string }) => void;
  className?: string;
}

export const HierarchicalPopover: React.FC<HierarchicalPopoverProps> = ({ onSelect, className }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={clsx('relative', className)}>
      <button
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm hover:bg-gray-50"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        + Add Tag
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-[22rem] rounded-2xl border bg-white shadow-card animate-in fade-in slide-in-from-top-2">
          <div className="p-2">
            <HierarchySelector onSelect={(t) => { onSelect(t); setOpen(false); }} />
          </div>
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400" />
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-10 bg-black/10" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </div>
  );
};
