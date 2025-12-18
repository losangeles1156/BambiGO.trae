'use client';

import React, { useState, useEffect } from 'react';
import { HierarchySelector } from '@/components/tagging/HierarchySelector';
import { FacilityEditor } from '@/components/tagging/FacilityEditor';
import { TagChip } from '@/components/tagging/TagChip';
import { LAYER_CONFIG, TagLayer } from '@/components/tagging/constants';
import { TaggingService } from '@/lib/api/tagging';
import { L1Tag, L3ServiceFacility, L4ActionCard, L1Category, L3Category } from '@/types/tagging';
import { MapPinIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

// Unified Tag Interface for UI Display
interface TagItem {
  id: string;
  label: string;
  layer: TagLayer;
  meta?: Record<string, unknown>;
  originalTypeId?: string;
}

interface SimpleNode {
  id: string;
  name: string; // Simplified for UI
}

export default function TaggingSystemDemo() {
  const [nodes, setNodes] = useState<SimpleNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState<L4ActionCard | null>(null);

  // 1. Fetch Nodes on Mount
  useEffect(() => {
    async function fetchNodes() {
      try {
        const res = await fetch('/api/nodes?limit=5');
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const mappedNodes = data.features.map((f: any) => ({
            id: f.properties.id,
            name: f.properties.name?.en || f.properties.name?.ja || f.properties.id
          }));
          setNodes(mappedNodes);
          setActiveNodeId(mappedNodes[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch nodes', err);
      }
    }
    fetchNodes();
  }, []);

  // 2. Fetch Tags when Active Node Changes
  useEffect(() => {
    if (!activeNodeId) return;
    loadTags(activeNodeId);
  }, [activeNodeId]);

  const loadTags = async (nodeId: string) => {
    setLoading(true);
    try {
      const [l1, l3] = await Promise.all([
        TaggingService.getL1Tags(nodeId),
        TaggingService.getL3Facilities(nodeId)
      ]);

      const mappedTags: TagItem[] = [
        ...l1.map(t => ({
          id: t.id,
          label: t.name?.en || t.subCategory,
          layer: 'L1' as TagLayer,
          originalTypeId: t.mainCategory,
          meta: { sub: t.subCategory }
        })),
        ...l3.map(f => ({
          id: f.id,
          label: f.provider?.name || f.subCategory,
          layer: 'L3' as TagLayer,
          originalTypeId: f.category,
          meta: f.attributes
        }))
      ];
      setTags(mappedTags);
      setGeneratedStrategy(null); // Reset strategy
    } catch (err) {
      console.error('Failed to load tags', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddL1 = async (selection: { main: L1Category; sub: string; label: string }) => {
    if (!activeNodeId) return;
    try {
      await TaggingService.addL1Tag({
        nodeId: activeNodeId,
        mainCategory: selection.main,
        subCategory: selection.sub,
        name: { en: selection.label }
      });
      loadTags(activeNodeId);
    } catch (err) {
      alert('Failed to add tag');
    }
  };

  const handleAddL3 = async (facility: { type: L3Category; label: string; icon: string; attributes: Record<string, any> }) => {
    if (!activeNodeId) return;
    try {
      await TaggingService.addL3Facility({
        nodeId: activeNodeId,
        category: facility.type,
        subCategory: facility.attributes.subCategory || 'facility',
        provider: { type: 'public', name: facility.label },
        attributes: facility.attributes
      });
      loadTags(activeNodeId);
    } catch (err) {
      alert('Failed to add facility');
    }
  };

  const removeTag = async (tagId: string, layer: TagLayer) => {
    if (!activeNodeId) return;
    try {
      if (layer === 'L1') {
        await TaggingService.removeL1Tag(activeNodeId, tagId);
      } else if (layer === 'L3') {
        await TaggingService.removeL3Facility(activeNodeId, tagId);
      }
      loadTags(activeNodeId);
    } catch (err) {
      alert('Failed to remove tag');
    }
  };

  const generateL4Strategy = async () => {
    if (!activeNodeId) return;
    try {
      // Mock context for now, could be real later
      const strategy = await TaggingService.generateStrategy(activeNodeId, {
        weather: 'rain', // Hardcoded for demo to trigger "Rainy" logic if applicable
        time: 'lunch'
      });
      setGeneratedStrategy(strategy);
    } catch (err) {
      console.error('Failed to generate strategy', err);
    }
  };

  const activeNodeName = nodes.find(n => n.id === activeNodeId)?.name || 'Unknown Node';

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-gray-200 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BambiGO Tagging System</h1>
            <p className="text-gray-500 mt-2">
              Live DB Integration (L1-L4)
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              className="border rounded p-2"
              value={activeNodeId || ''}
              onChange={(e) => setActiveNodeId(e.target.value)}
              disabled={nodes.length === 0}
            >
              {nodes.length === 0 && <option>No Nodes Found</option>}
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button onClick={() => activeNodeId && loadTags(activeNodeId)} className="p-2 bg-white border rounded hover:bg-gray-50">
              <ArrowPathIcon className={clsx("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Editors */}
          <div className="lg:col-span-4 space-y-6">
            <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                1. Define Structure (L1)
              </h2>
              <HierarchySelector 
                onSelect={handleAddL1} 
              />
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                3. Add Facilities (L3)
              </h2>
              <FacilityEditor 
                onAdd={handleAddL3}
              />
            </section>
          </div>

          {/* Right Column: Visualization & Strategy */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Visualizer */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5 text-gray-500" />
                    {activeNodeName}
                  </h2>
                  <p className="text-sm text-gray-500">Node ID: {activeNodeId}</p>
                </div>
                <div className="text-xs font-mono text-gray-400">
                  {tags.length} Active Tags
                </div>
              </div>

              {/* Tags Grid */}
              <div className="min-h-[200px] p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                {tags.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 italic">
                    No tags applied. Select categories on the left to add.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <TagChip 
                        key={tag.id}
                        label={tag.label}
                        layer={tag.layer}
                        onDelete={() => removeTag(tag.id, tag.layer)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* L4 Strategy Generator */}
            <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-indigo-900">
                  4. Strategy Engine (L4)
                </h2>
                <button 
                  onClick={generateL4Strategy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  Generate Insights
                </button>
              </div>

              {generatedStrategy ? (
                <div className="bg-white rounded-lg p-5 border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="font-bold text-gray-900">{generatedStrategy.title}</h3>
                  </div>
                  <p className="text-gray-600 mb-4">
                    {generatedStrategy.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium bg-indigo-50 px-3 py-1.5 rounded-full w-fit">
                    <span>💡 Rationale:</span>
                    {generatedStrategy.rationale}
                  </div>
                  {generatedStrategy.actions && generatedStrategy.actions.length > 0 && (
                     <div className="mt-4 pt-3 border-t border-gray-100">
                        <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800">
                           Action: {generatedStrategy.actions[0].label} &rarr;
                        </button>
                     </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-indigo-300 text-sm">
                  Click generate to analyze current tags and context...
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
