import { 
  BuildingStorefrontIcon, 
  MapIcon, 
  WifiIcon, 
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { L1Category, L3Category } from '@/types/tagging';

export type TagLayer = 'L1' | 'L2' | 'L3' | 'L4';

export const LAYER_CONFIG = {
  L1: {
    color: 'blue',
    icon: BuildingStorefrontIcon,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    hoverColor: 'hover:bg-blue-100'
  },
  L2: {
    color: 'violet',
    icon: MapIcon,
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700',
    hoverColor: 'hover:bg-violet-100'
  },
  L3: {
    color: 'emerald',
    icon: WifiIcon,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    hoverColor: 'hover:bg-emerald-100'
  },
  L4: {
    color: 'rose',
    icon: SparklesIcon,
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
    hoverColor: 'hover:bg-rose-100'
  }
};

// Mapped from TAGGING_SYSTEM.md + Types
export const L1_CATEGORIES_DATA: { 
  id: L1Category; 
  icon: string; 
  subCategories: { id: string }[] 
}[] = [
  {
    id: 'dining',
    icon: '🍜',
    subCategories: [
      { id: 'izakaya' },
      { id: 'ramen' },
      { id: 'cafe' },
      { id: 'restaurant' },
      { id: 'fast_food' }
    ]
  },
  {
    id: 'shopping',
    icon: '🛍️',
    subCategories: [
      { id: 'drugstore' },
      { id: 'convenience_store' },
      { id: 'electronics' },
      { id: 'supermarket' }
    ]
  },
  {
    id: 'medical',
    icon: '🏥',
    subCategories: [
      { id: 'clinic' },
      { id: 'pharmacy' },
      { id: 'hospital' },
      { id: 'dentist' }
    ]
  },
  {
    id: 'leisure',
    icon: '🎭',
    subCategories: [
      { id: 'park' },
      { id: 'museum' },
      { id: 'gym' },
      { id: 'cinema' },
      { id: 'karaoke' }
    ]
  },
  {
    id: 'education',
    icon: '🎓',
    subCategories: [
      { id: 'school' },
      { id: 'university' },
      { id: 'library' }
    ]
  },
  {
    id: 'finance',
    icon: '💰',
    subCategories: [
      { id: 'bank' },
      { id: 'atm' },
      { id: 'currency_exchange' }
    ]
  },
  // Extended Categories based on real-world geo data
  {
    id: 'accommodation',
    icon: '🏨',
    subCategories: [
      { id: 'hotel' },
      { id: 'hostel' },
      { id: 'apartment' }
    ]
  },
  {
    id: 'business',
    icon: '💼',
    subCategories: [
      { id: 'office' },
      { id: 'coworking' },
      { id: 'factory' }
    ]
  },
  {
    id: 'religion',
    icon: '⛩️',
    subCategories: [
      { id: 'shrine' },
      { id: 'temple' },
      { id: 'church' }
    ]
  },
  {
    id: 'nature',
    icon: '🌳',
    subCategories: [
      { id: 'scenic_spot' },
      { id: 'garden' },
      { id: 'mountain' }
    ]
  },
  {
    id: 'transport',
    icon: '🚉',
    subCategories: [
      { id: 'station' },
      { id: 'bus_stop' },
      { id: 'parking' }
    ]
  },
  {
    id: 'public',
    icon: '🏛️',
    subCategories: [
      { id: 'police' },
      { id: 'post_office' },
      { id: 'government' }
    ]
  },
  {
    id: 'residential',
    icon: '🏠',
    subCategories: [
      { id: 'apartment_complex' },
      { id: 'housing' }
    ]
  }
];

export const L3_FACILITIES_DATA: { 
  id: L3Category; 
  icon: string 
}[] = [
  { id: 'wifi', icon: '📶' },
  { id: 'toilet', icon: '🚻' },
  { id: 'charging', icon: '🔌' },
  { id: 'locker', icon: '🛅' },
  { id: 'accessibility', icon: '♿' },
  { id: 'rest_area', icon: '🪑' },
  { id: 'other', icon: '➕' }
];
