import { describe, it, expect } from 'vitest';
import { LAYER_CONFIG, L1_CATEGORIES_DATA } from '../src/components/tagging/constants';

describe('Tagging System Compliance', () => {
  
  it('L1 Categories match Spec', () => {
    // Verify we have the 6 main categories defined in MD
    const expectedCategories = ['dining', 'shopping', 'medical', 'leisure', 'education', 'finance'];
    const actualCategories = L1_CATEGORIES_DATA.map(c => c.id);
    
    expect(actualCategories.sort()).toEqual(expectedCategories.sort());
  });

  it('Layer Config has correct colors', () => {
    expect(LAYER_CONFIG.L1.color).toBe('blue');
    expect(LAYER_CONFIG.L2.color).toBe('violet');
    expect(LAYER_CONFIG.L3.color).toBe('emerald');
    expect(LAYER_CONFIG.L4.color).toBe('rose');
  });

});
