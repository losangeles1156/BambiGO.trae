import { L3ServiceFacility } from '../../types/tagging'
import { L3CategorySchema } from '../validators/tagging'
import { FacilityItem } from '../../app/api/facilities/route'

/**
 * Adapter to convert legacy API response to L3ServiceFacility.
 * This ensures the frontend uses strict types even if the backend is lagging.
 */
export function adaptFacilityItem(item: FacilityItem): L3ServiceFacility {
  // 0. Priority: Use backend-provided L3 object if available (v4.2+)
  if (item.l3) {
    return item.l3
  }

  // 1. Map 'type' to L3Category
  // The API uses various strings, we need to normalize them to the enum
  let category: any = 'other'
  
  const typeMap: Record<string, string> = {
    'toilet': 'toilet',
    'restroom': 'toilet',
    'charging': 'charging',
    'wifi': 'wifi',
    'locker': 'locker',
    'coin_locker': 'locker',
    'elevator': 'accessibility',
    'escalator': 'accessibility',
    'ramp': 'accessibility',
    'bench': 'rest_area',
    'smoking_area': 'rest_area'
  }

  const normalizedType = item.type?.toLowerCase() || 'other'
  if (typeMap[normalizedType]) {
    category = typeMap[normalizedType]
  }
  
  // Validate against schema to be safe, fallback to 'other' if invalid
  const categoryCheck = L3CategorySchema.safeParse(category)
  if (!categoryCheck.success) {
    category = 'other'
  }

  // 2. Extract attributes
  const attributes: Record<string, unknown> = {
    ...(item.attributes as object || {}),
    is_free: item.is_free,
    is_24h: item.is_24h,
    has_wheelchair_access: item.has_wheelchair_access,
    has_baby_care: item.has_baby_care,
    booking_url: item.booking_url
  }

  // 3. Construct L3ServiceFacility
  return {
    id: item.id,
    nodeId: item.node_id || '',
    category: category,
    subCategory: normalizedType, // Keep original type as subCategory
    
    location: {
      floor: item.floor || undefined,
      direction: item.direction || undefined,
      // coordinates: not directly available in flat FacilityItem unless we parse location column, 
      // but the API doesn't expose it in 'items' array root currently (it's likely in raw DB row)
    },
    
    provider: {
      type: 'public', // Defaulting to public for now as API doesn't specify
      name: undefined 
    },
    
    attributes,
    
    openingHours: item.is_24h ? '24 Hours' : undefined,
    updatedAt: item.status_updated_at || undefined,
    source: 'official' // Assuming official data for now
  }
}
