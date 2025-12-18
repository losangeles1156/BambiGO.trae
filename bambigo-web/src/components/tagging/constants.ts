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
    name: 'Life Function',
    description: 'Structural/Static Categories',
    color: 'blue',
    icon: BuildingStorefrontIcon,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    hoverColor: 'hover:bg-blue-100'
  },
  L2: {
    name: 'Spatial Aggregation',
    description: 'Area/Atmosphere',
    color: 'violet',
    icon: MapIcon,
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700',
    hoverColor: 'hover:bg-violet-100'
  },
  L3: {
    name: 'Service Facility',
    description: 'Utilities/Amenities',
    color: 'emerald',
    icon: WifiIcon,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    hoverColor: 'hover:bg-emerald-100'
  },
  L4: {
    name: 'Mobility Strategy',
    description: 'AI Suggestions',
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
  label: string; 
  icon: string; 
  subCategories: { id: string; label: string }[] 
}[] = [
  {
    id: 'dining',
    label: 'Dining (餐飲)',
    icon: '🍜',
    subCategories: [
      { id: 'izakaya', label: 'Izakaya' },
      { id: 'ramen', label: 'Ramen' },
      { id: 'cafe', label: 'Cafe' },
      { id: 'restaurant', label: 'Restaurant' },
      { id: 'fast_food', label: 'Fast Food' }
    ]
  },
  {
    id: 'shopping',
    label: 'Shopping (購物)',
    icon: '🛍️',
    subCategories: [
      { id: 'drugstore', label: 'Drugstore' },
      { id: 'convenience_store', label: 'Convenience Store' },
      { id: 'electronics', label: 'Electronics' },
      { id: 'supermarket', label: 'Supermarket' }
    ]
  },
  {
    id: 'medical',
    label: 'Medical (醫療)',
    icon: '🏥',
    subCategories: [
      { id: 'clinic', label: 'Clinic' },
      { id: 'pharmacy', label: 'Pharmacy' },
      { id: 'hospital', label: 'Hospital' },
      { id: 'dentist', label: 'Dentist' }
    ]
  },
  {
    id: 'leisure',
    label: 'Leisure (休閒)',
    icon: '🎭',
    subCategories: [
      { id: 'park', label: 'Park' },
      { id: 'museum', label: 'Museum' },
      { id: 'karaoke', label: 'Karaoke' },
      { id: 'cinema', label: 'Cinema' }
    ]
  },
  {
    id: 'education',
    label: 'Education (教育)',
    icon: '🎓',
    subCategories: [
      { id: 'school', label: 'School' },
      { id: 'library', label: 'Library' },
      { id: 'cram_school', label: 'Cram School' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance (金融)',
    icon: '🏦',
    subCategories: [
      { id: 'bank', label: 'Bank' },
      { id: 'atm', label: 'ATM' },
      { id: 'currency_exchange', label: 'Currency Exchange' }
    ]
  }
];

export const L3_FACILITIES_DATA: { 
  id: L3Category; 
  label: string; 
  icon: string 
}[] = [
  { id: 'wifi', label: 'WiFi', icon: '📶' },
  { id: 'toilet', label: 'Toilet', icon: '🚻' },
  { id: 'charging', label: 'Charging', icon: '🔌' },
  { id: 'locker', label: 'Locker', icon: '🛅' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'rest_area', label: 'Rest Area', icon: '🪑' },
  { id: 'other', label: 'Other', icon: '➕' }
];
