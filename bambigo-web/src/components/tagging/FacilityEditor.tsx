'use client';

import React, { useState } from 'react';
import { L3_FACILITIES_DATA } from './constants';
import { clsx } from 'clsx';
import type { L3Category } from '@/types/tagging';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

// Field Definitions
type FieldType = 'boolean' | 'text' | 'select' | 'number';
interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select
  placeholder?: string;
}

const FACILITY_SCHEMAS: Record<L3Category, FieldDef[]> = {
  wifi: [
    { key: 'ssid', label: 'SSID Name', type: 'text', placeholder: 'e.g. FreeWiFi' },
    { key: 'password', label: 'Password', type: 'text', placeholder: 'Optional' },
    { key: 'speed', label: 'Speed', type: 'select', options: ['Standard', 'High Speed', '5G'] }
  ],
  toilet: [
    { key: 'accessible', label: 'Wheelchair Accessible', type: 'boolean' },
    { key: 'baby_care', label: 'Baby Changing Station', type: 'boolean' },
    { key: 'gender', label: 'Type', type: 'select', options: ['Unisex', 'Male/Female Separated', 'Female Only'] }
  ],
  charging: [
    { key: 'type', label: 'Socket Type', type: 'select', options: ['AC Outlet', 'USB-A', 'USB-C', 'Wireless'] },
    { key: 'fast_charge', label: 'Fast Charging Support', type: 'boolean' },
    { key: 'count', label: 'Number of Ports', type: 'number' }
  ],
  locker: [
    { key: 'size', label: 'Max Size', type: 'select', options: ['Small (Carry-on)', 'Medium', 'Large (Suitcase)', 'Extra Large'] },
    { key: 'payment', label: 'Payment Method', type: 'select', options: ['Coin', 'IC Card', 'QR Code', 'Free'] }
  ],
  accessibility: [
    { key: 'elevator', label: 'Elevator Available', type: 'boolean' },
    { key: 'ramp', label: 'Ramp Access', type: 'boolean' },
    { key: 'staff_assist', label: 'Staff Assistance', type: 'boolean' }
  ],
  rest_area: [
    { key: 'indoor', label: 'Indoor', type: 'boolean' },
    { key: 'seats', label: 'Approx. Seats', type: 'number' }
  ],
  shelter: [
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'supplies', label: 'Emergency Supplies', type: 'boolean' }
  ],
  medical_aid: [
    { key: 'aed', label: 'AED Available', type: 'boolean' },
    { key: 'staff', label: 'Medical Staff', type: 'boolean' }
  ],
  other: [
    { key: 'description', label: 'Description', type: 'text' }
  ]
};

// Simple Toggle Component
const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      )}
      aria-pressed={checked}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

interface FacilityEditorProps {
  onAdd: (facility: { 
    type: L3Category; 
    label: string; 
    icon: string; 
    attributes: Record<string, unknown>;
    verified: boolean;
  }) => void;
  className?: string;
}

export const FacilityEditor: React.FC<FacilityEditorProps> = (props) => {
  const { onAdd, className } = props;
  const [selectedType, setSelectedType] = useState<L3Category>(L3_FACILITIES_DATA[0].id);
  const [attributes, setAttributes] = useState<Record<string, string | number | boolean | undefined>>({});
  const [verified, setVerified] = useState(false);

  

  const handleAdd = () => {
    const facilityDef = L3_FACILITIES_DATA.find(f => f.id === selectedType);
    if (!facilityDef) return;

    onAdd({
      type: selectedType,
      label: facilityDef.id,
      icon: facilityDef.icon,
      attributes,
      verified
    });
    
    // Reset form
    setAttributes({});
    setVerified(false);
  };

  const renderField = (field: FieldDef) => {
    const value = attributes[field.key];

    switch (field.type) {
      case 'boolean':
        return (
          <Toggle
            key={field.key}
            label={field.label}
            checked={!!value}
            onChange={(v) => setAttributes(prev => ({ ...prev, [field.key]: v }))}
          />
        );
      case 'text':
        return (
          <div key={field.key} className="py-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
              placeholder={field.placeholder}
              value={String(value ?? '')}
              onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        );
      case 'number':
        return (
          <div key={field.key} className="py-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
            <input
              type="number"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
              value={typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : '')}
              onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.key} className="py-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border bg-white"
              value={String(value ?? '')}
              onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: e.target.value }))}
            >
              <option value="">Select...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  const currentSchema = FACILITY_SCHEMAS[selectedType] || [];

  return (
    <div className={clsx("bg-white rounded-xl border border-gray-200 shadow-card w-full overflow-hidden flex flex-col", className)}>
      {/* Header */}
      <div className="bg-emerald-50/50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
        <h3 className="font-semibold text-emerald-900 text-sm flex items-center gap-2">
          <span>🛠️</span> Add Facility (L3)
        </h3>
        <span className="text-xs text-emerald-600 font-medium px-2 py-0.5 rounded-full bg-emerald-100/50 border border-emerald-200">
          Dynamic Form
        </span>
      </div>
      
      <div className="p-4 space-y-5 flex-1 overflow-y-auto max-h-[60vh]">
        {/* Type Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Facility Type</label>
          <div className="grid grid-cols-3 gap-2">
            {L3_FACILITIES_DATA.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedType(f.id)
                  setAttributes({})
                }}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border text-xs transition-all h-16',
                  selectedType === f.id 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 shadow-sm' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600 hover:border-emerald-200'
                )}
              >
                <span className="text-lg">{f.icon}</span>
                <span className="font-medium truncate w-full text-center">{f.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Attributes Form */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {L3_FACILITIES_DATA.find(f => f.id === selectedType)?.id} Details
          </label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-1">
            {currentSchema.length > 0 ? (
              currentSchema.map(renderField)
            ) : (
              <div className="text-sm text-gray-400 italic py-2 text-center">No specific attributes</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => setVerified(!verified)}
        >
          <div className={clsx(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            verified ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300 group-hover:border-blue-400"
          )}>
            {verified && <CheckBadgeIcon className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className="text-sm text-gray-600 group-hover:text-gray-900 select-none">Verified</span>
        </div>

        <button
          onClick={handleAdd}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
        >
          Add Facility
        </button>
      </div>
    </div>
  );
};
