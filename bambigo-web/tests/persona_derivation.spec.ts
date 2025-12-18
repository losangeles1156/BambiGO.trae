import { describe, it, expect } from 'vitest';
import { derivePersonaFromFacilities } from '../src/lib/tagging';

describe('Persona Derivation Logic', () => {

  it('identifies Nature Healer persona', () => {
    const personas = derivePersonaFromFacilities([], { l1MainCategory: 'nature', l1SubCategory: 'mountain' });
    expect(personas).toContain('自然療癒');
    expect(personas).toContain('登山健行');
  });

  it('identifies Spiritual persona', () => {
    const personas = derivePersonaFromFacilities([], { l1MainCategory: 'religion', l1SubCategory: 'shrine' });
    expect(personas).toContain('心靈寄託');
    expect(personas).toContain('神社巡禮');
  });

  it('identifies Business Hub with Wifi/Charging', () => {
    const facilities = [
      { type: 'wifi', has_wheelchair_access: false },
      { type: 'charging', has_wheelchair_access: false }
    ];
    const personas = derivePersonaFromFacilities(facilities, { l1MainCategory: 'business', l1SubCategory: 'office' });
    expect(personas).toContain('商務核心');
    expect(personas).toContain('行動辦公室');
    // Should NOT contain Digital Nomad Friendly if it's already Business Hub (to avoid redundancy, or per logic)
    // Logic says: if (hasWifi && hasCharging && l1Main !== 'business') personas.push('數位遊牧友好')
    expect(personas).not.toContain('數位遊牧友好');
  });

  it('identifies Digital Nomad Friendly for non-business places', () => {
    const facilities = [
      { type: 'wifi', has_wheelchair_access: false },
      { type: 'charging', has_wheelchair_access: false }
    ];
    const personas = derivePersonaFromFacilities(facilities, { l1MainCategory: 'cafe' });
    expect(personas).toContain('數位遊牧友好');
  });

  it('identifies Staycation for Accommodation', () => {
    const personas = derivePersonaFromFacilities([], { l1MainCategory: 'accommodation', l1SubCategory: 'hotel' });
    expect(personas).toContain('旅途休憩');
  });

  it('identifies Local Vibe for Residential', () => {
    const personas = derivePersonaFromFacilities([], { l1MainCategory: 'residential' });
    expect(personas).toContain('在地生活');
  });

  it('identifies Transit Hub', () => {
    const personas = derivePersonaFromFacilities([], { l1MainCategory: 'transport' });
    expect(personas).toContain('交通樞紐');
  });

  it('handles mixed signals (Toilet + Accessibility)', () => {
    const facilities = [
      { type: 'toilet', has_wheelchair_access: true },
      { type: 'ramp', has_wheelchair_access: true }
    ];
    const personas = derivePersonaFromFacilities(facilities, { l1MainCategory: 'public' });
    expect(personas).toContain('無障礙友善');
  });
});
