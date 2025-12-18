import { L1Tag, L3ServiceFacility, L1Category, L3Category } from '@/types/tagging';

// --- API Service for Tagging System ---

const API_BASE = '/api/nodes';

export const TaggingService = {
  
  // --- L1 Operations ---
  
  async getL1Tags(nodeId: string): Promise<L1Tag[]> {
    const res = await fetch(`${API_BASE}/${nodeId}/tags`);
    if (!res.ok) throw new Error('Failed to fetch tags');
    const data = await res.json();
    return data.l1 || [];
  },

  async addL1Tag(tag: Omit<L1Tag, 'id'>): Promise<L1Tag> {
    const res = await fetch(`${API_BASE}/${tag.nodeId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: 'L1', data: tag })
    });
    
    if (!res.ok) throw new Error('Failed to add L1 tag');
    
    // The API returns the raw DB row. We might need to map it back to L1Tag if the UI expects strict typing immediately.
    // However, for simplicity, let's assume the UI re-fetches or we map it here.
    // Since mapping is complex and shared, we ideally share the mapper. 
    // For now, let's rely on re-fetching or a simplified optimistic return.
    
    // Actually, let's map the response properly if possible, or just return what we sent + id.
    const saved = await res.json();
    return {
      ...tag,
      id: saved.id
    };
  },

  async removeL1Tag(nodeId: string, tagId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${nodeId}/tags?id=${tagId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete tag');
  },

  // --- L3 Operations ---

  async getL3Facilities(nodeId: string): Promise<L3ServiceFacility[]> {
    const res = await fetch(`${API_BASE}/${nodeId}/tags`);
    if (!res.ok) throw new Error('Failed to fetch facilities');
    const data = await res.json();
    return data.l3 || [];
  },

  async addL3Facility(facility: Omit<L3ServiceFacility, 'id'>): Promise<L3ServiceFacility> {
    const res = await fetch(`${API_BASE}/${facility.nodeId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: 'L3', data: facility })
    });

    if (!res.ok) throw new Error('Failed to add L3 facility');
    const saved = await res.json();
    
    return {
      ...facility,
      id: saved.id
    };
  },

  async removeL3Facility(nodeId: string, facilityId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${nodeId}/tags?id=${facilityId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete facility');
  },

  // --- Aggregation (L4) ---
  
  async generateStrategy(nodeId: string, context: { weather?: string, time?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/${nodeId}/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    
    if (!res.ok) {
       // Fallback or throw
       console.warn('Strategy generation failed, returning fallback');
       return {
         type: 'secondary',
         title: 'Explore',
         description: 'Discover the area manually.',
         tags: [],
         actions: []
       };
    }
    
    return res.json();
  }
};
