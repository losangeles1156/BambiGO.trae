'use client';

import React, { useState, useMemo } from 'react';
import { HierarchicalPopover } from '@/components/tagging/HierarchySelector';
import TagChip from '@/components/ui/TagChip';
import { L3_FACILITIES_DATA } from '@/components/tagging/constants';
import type { L1Category, L3Category } from '@/types/tagging';
import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// --- Mock Data ---
interface MockNode {
  id: string;
  name: string;
  image: string;
  l1: { main: L1Category; sub: string; label: string };
  l3: L3Category[];
}

const MOCK_NODES: MockNode[] = [
  {
    id: '1',
    name: 'Ichiran Ramen',
    image: '🍜',
    l1: { main: 'dining', sub: 'ramen', label: 'Dining > Ramen' },
    l3: ['toilet', 'wifi']
  },
  {
    id: '2',
    name: 'Starbucks Reserve',
    image: '☕',
    l1: { main: 'dining', sub: 'cafe', label: 'Dining > Cafe' },
    l3: ['wifi', 'charging', 'toilet', 'accessibility']
  },
  {
    id: '3',
    name: 'Matsumoto Kiyoshi',
    image: '💊',
    l1: { main: 'shopping', sub: 'drugstore', label: 'Shopping > Drugstore' },
    l3: ['accessibility'] // No Tax Free tag in L3 constants yet, using accessibility as proxy
  },
  {
    id: '4',
    name: 'Yodobashi Camera',
    image: '📷',
    l1: { main: 'shopping', sub: 'electronics', label: 'Shopping > Electronics' },
    l3: ['toilet', 'accessibility', 'wifi', 'charging']
  },
  {
    id: '5',
    name: 'FamilyMart',
    image: '🏪',
    l1: { main: 'shopping', sub: 'convenience_store', label: 'Shopping > Convenience Store' },
    l3: ['toilet', 'wifi']
  },
  {
    id: '6',
    name: 'City Library',
    image: '📚',
    l1: { main: 'education', sub: 'library', label: 'Education > Library' },
    l3: ['wifi', 'accessibility', 'toilet', 'rest_area']
  }
];

// --- Types ---
type FilterTag = {
  id: string;
  layer: 'L1' | 'L3';
  label: string;
  value: string; // "main:sub" for L1, "category" for L3
};

export default function FilteringDemo() {
  const [filters, setFilters] = useState<FilterTag[]>([]);

  // --- Handlers ---
  const addL1Filter = (selection: { main: L1Category; sub: string; label: string }) => {
    const id = `L1-${selection.main}-${selection.sub}`;
    if (filters.some(f => f.id === id)) return;
    
    setFilters(prev => [...prev, {
      id,
      layer: 'L1',
      label: selection.label,
      value: `${selection.main}:${selection.sub}`
    }]);
  };

  const addL3Filter = (l3Id: string) => {
    const def = L3_FACILITIES_DATA.find(f => f.id === l3Id);
    if (!def) return;
    
    const id = `L3-${l3Id}`;
    if (filters.some(f => f.id === id)) return;

    setFilters(prev => [...prev, {
      id,
      layer: 'L3',
      label: def.label,
      value: l3Id
    }]);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  // --- Filtering Logic (Specs 3.2) ---
  const filteredNodes = useMemo(() => {
    if (filters.length === 0) return MOCK_NODES;

    const l1Filters = filters.filter(f => f.layer === 'L1');
    const l3Filters = filters.filter(f => f.layer === 'L3');

    return MOCK_NODES.filter(node => {
      // 1. L1 Check (OR logic within L1: "Shopping OR Dining")
      // Usually users want "Show me Shopping AND Dining" is rare, but let's assume OR for L1 categories if multiple are selected
      // Wait, spec says "Shopping + Drugstore".
      // If I select "Dining > Ramen" and "Dining > Cafe", I probably want both.
      // So OR logic for L1 makes sense.
      const matchL1 = l1Filters.length === 0 || l1Filters.some(f => {
        const [main, sub] = f.value.split(':');
        return node.l1.main === main && node.l1.sub === sub;
      });

      // 2. L3 Check (AND logic: "Must have Wifi AND Toilet")
      // Spec: "...that has Tax Free service". Usually refinements are additive constraints.
      const matchL3 = l3Filters.every(f => {
        return node.l3.includes(f.value as L3Category);
      });

      return matchL1 && matchL3;
    });
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Multi-Layer Filtering (Specs 3.2)</h1>
          <p className="text-gray-500 mt-2">
            Combine L1 Structure Filters with L3 Service Constraints.
          </p>
        </header>

        {/* Filter Controls */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FunnelIcon className="w-5 h-5" />
              <span>Filters:</span>
            </div>
            
            {/* L1 Selector */}
            <HierarchicalPopover onSelect={addL1Filter} />

            {/* L3 Selector (Simple Dropdown) */}
            <div className="relative group">
              <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm hover:bg-gray-50 text-emerald-700">
                + Add Service (L3)
              </button>
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 hidden group-hover:block z-10 p-2">
                {L3_FACILITIES_DATA.map(f => (
                  <button
                    key={f.id}
                    onClick={() => addL3Filter(f.id)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-md text-sm text-gray-700 flex items-center gap-2"
                  >
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Filters */}
          <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100 min-h-[3rem]">
            {filters.length === 0 ? (
              <span className="text-gray-400 text-sm italic">No active filters. Showing all nodes.</span>
            ) : (
              filters.map(f => (
                <TagChip
                  key={f.id}
                  label={f.label}
                  layer={f.layer}
                  onRemove={() => removeFilter(f.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Results */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MagnifyingGlassIcon className="w-5 h-5" />
            Results ({filteredNodes.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNodes.map(node => (
              <div key={node.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-6xl">
                  {node.image}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 text-lg">{node.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {/* L1 Tag */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {node.l1.label}
                    </span>
                    {/* L3 Tags */}
                    {node.l3.map(l3Id => {
                      const def = L3_FACILITIES_DATA.find(d => d.id === l3Id);
                      return def ? (
                        <span key={l3Id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
                          {def.icon} {def.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredNodes.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No nodes match your filters.</p>
              <button 
                onClick={() => setFilters([])}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
