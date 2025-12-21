'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { L1_CATEGORIES_DATA } from './constants';
import type { L1Category } from '@/types/tagging';
import { useLanguage } from '@/contexts/LanguageContext';

interface HierarchySelectorProps {
  onSelect: (tag: { main: L1Category; sub: string; label: string }) => void;
  className?: string;
}

export const HierarchySelector: React.FC<HierarchySelectorProps> = ({ onSelect, className }) => {
  const { t } = useLanguage();
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
      const mainLabel = t(`tagging.l1.${selectedMain.id}.label`);
      onSelect({
        main: selectedMain.id,
        sub: subId,
        label: `${mainLabel} > ${subLabel}`
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
        if (item && selectedMain) {
           const label = t(`tagging.l1.${selectedMain.id}.${item.id}`);
           handleSubSelect(item.id, label);
        }
      } else if (e.key === 'Escape') {
        setViewState('main');
        setFocusIndex(0);
      }
    }
  };

  const selectedMainLabel = selectedMain ? t(`tagging.l1.${selectedMain.id}.label`) : '';

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden w-full', className)} role="tree" aria-label="L1 Hierarchy">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">{t('tagging.addL1')}</h3>
        {viewState === 'sub' && (
          <button 
            onClick={() => setViewState('main')}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center font-medium"
            aria-expanded={viewState === 'sub'}
          >
            <ChevronLeft className="w-3 h-3 mr-1" /> {t('tagging.back')}
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {viewState === 'main' ? (
          <div className="grid grid-cols-3 gap-2">
            {L1_CATEGORIES_DATA.map((cat, i) => {
              const label = t(`tagging.l1.${cat.id}.label`);
              return (
                <button
                  key={cat.id}
                  ref={(el) => { itemsRef.current[i] = el }}
                  onClick={() => handleMainSelect(cat)}
                  onKeyDown={(e) => handleKeyNav(e, i)}
                  tabIndex={i === focusIndex ? 0 : -1}
                  role="treeitem"
                  aria-selected={i === focusIndex}
                  aria-expanded={selectedMain?.id === cat.id ? true : false}
                  className="flex flex-col items-center justify-center gap-2 px-2 py-4 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-100 hover:border-blue-200 text-blue-700 transition-all active:scale-[0.98]"
                >
                  <span className="text-2xl filter drop-shadow-sm">{cat.icon}</span>
                  <span className="text-xs font-medium text-center line-clamp-2">{label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1 animate-in slide-in-from-right-4 fade-in duration-200">
            <div className="px-2 py-1.5 mb-2 bg-blue-50 text-xs text-blue-600 font-semibold uppercase tracking-wider rounded border border-blue-100">
              {t('tagging.subCategories').replace('{{label}}', selectedMainLabel)}
            </div>
            {selectedMain?.subCategories.map((sub, i) => {
              const subLabel = t(`tagging.l1.${selectedMain.id}.${sub.id}`);
              return (
                <button
                  key={sub.id}
                  ref={(el) => { itemsRef.current[i] = el }}
                  onClick={() => handleSubSelect(sub.id, subLabel)}
                  onKeyDown={(e) => handleKeyNav(e, i)}
                  tabIndex={i === focusIndex ? 0 : -1}
                  role="treeitem"
                  aria-selected={i === focusIndex}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-gray-50 focus:bg-blue-50 focus:text-blue-700 transition-colors flex items-center justify-between group border border-transparent hover:border-gray-200 focus:border-blue-200 outline-none"
                >
                  <span className="text-gray-700 text-sm font-medium group-focus:text-blue-700">{subLabel}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-focus:text-blue-500" />
                </button>
              );
            })}
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
  const { t } = useLanguage();
  return (
    <div className={clsx('relative', className)}>
      <button
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm hover:bg-gray-50"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        + {t('tagging.addTag')}
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
