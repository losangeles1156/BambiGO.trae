import { L4ActionCard } from '@/types/tagging';

type Context = {
  weather?: string;
  time?: string;
  now?: Date;
  personaArchetype?: string;
  personaLabels?: string[];
  temperatureC?: number;
};

type Facility = {
  type: string;
  attributes?: {
    subCategory?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

function getTimeSlot(ctx: Context): 'breakfast' | 'lunch' | 'dinner' | 'night' | 'other' {
  const reference = ctx.now ?? new Date();
  const utc = reference.getUTCHours();
  const jstHour = (utc + 9) % 24;
  if (jstHour >= 7 && jstHour <= 9) return 'breakfast';
  if (jstHour >= 11 && jstHour <= 14) return 'lunch';
  if (jstHour >= 17 && jstHour <= 21) return 'dinner';
  if (jstHour >= 22 || jstHour <= 5) return 'night';
  return 'other';
}

function parseOpeningHours(oh?: string): Array<{ start: number; end: number }> {
  if (!oh) return [];
  const ranges: Array<{ start: number; end: number }> = [];
  const parts = oh.split(',');
  for (const p of parts) {
    const m = p.trim().match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (m) {
      const sh = parseInt(m[1], 10);
      const sm = parseInt(m[2], 10);
      const eh = parseInt(m[3], 10);
      const em = parseInt(m[4], 10);
      ranges.push({ start: sh * 60 + sm, end: eh * 60 + em });
    }
  }
  return ranges;
}

function isOpenNowDining(facilities: Facility[], now: Date): boolean {
  const jstMinutes = (((now.getUTCHours() + 9) % 24) * 60) + now.getUTCMinutes();
  for (const f of facilities) {
    const sub = String(f.attributes?.subCategory || '').toLowerCase();
    const isDining = f.type.toLowerCase() === 'dining' || sub === 'restaurant' || sub === 'cafe';
    if (!isDining) continue;
    const ranges = parseOpeningHours(f.attributes?.openingHours || f.openingHours);
    if (ranges.length === 0) return true;
    if (ranges.some(r => jstMinutes >= r.start && jstMinutes <= r.end)) return true;
  }
  return false;
}

export class StrategyEngine {
  static generate(facilities: Facility[], context: Context): L4ActionCard[] {
    const tags = new Set(facilities.map((f) => String(f.type).toLowerCase()));
    const subTags = new Set(
      facilities.map((f) => String(f.attributes?.subCategory || '').toLowerCase())
    );
    const strategy: L4ActionCard[] = [];

    const hasAccessibility = facilities.some(
      (f) => f.attributes?.has_wheelchair_access === true || f.attributes?.accessible === true
    );
    const hasBabyCare = facilities.some(
      (f) => f.attributes?.has_baby_care === true || subTags.has('baby_care')
    );
    const hasWifi = tags.has('wifi') || subTags.has('wifi');
    const hasCharging = tags.has('charging') || subTags.has('charging') || subTags.has('power_outlet');
    const hasDining = tags.has('dining') || subTags.has('dining') || subTags.has('restaurant');
    const hasWaterRefill = subTags.has('water_refill') || subTags.has('drinking_fountain');

    const personaLabels = new Set((context.personaLabels || []).map((s) => s.toLowerCase()));
    const personaArchetype = (context.personaArchetype || '').toLowerCase();

    if (context.weather === 'rain') {
      if (tags.has('shopping') || hasDining) {
        strategy.push({
          type: 'primary',
          title: 'Stay Dry & Shop',
          description: 'Indoor options available for rainy weather.',
          rationale: 'Rainy weather with indoor facilities present.',
          tags: ['shopping', 'dining'],
          actions: [{ label: 'Find Shelter', uri: 'app:filter?indoor=true' }]
        });
      }
    }

    if ((hasWifi && hasCharging) || personaLabels.has('數位遊牧友好')) {
      strategy.push({
        type: 'secondary',
        title: 'Remote Work Spot',
        description: 'WiFi and power available for work.',
        rationale: 'Connectivity and power readiness detected.',
        tags: ['wifi', 'charging'],
        actions: [{ label: 'View Workspaces', uri: 'app:filter?tag=wifi' }]
      });
    }

    const slot = context.time ? (context.time as any) : getTimeSlot(context);
    if ((slot === 'lunch' || slot === 'dinner') && hasDining && isOpenNowDining(facilities, context.now ?? new Date())) {
      strategy.push({
        type: 'primary',
        title: 'Time to Eat',
        description: 'Dining options available now.',
        rationale: 'Meal time window detected with dining nearby.',
        tags: ['dining'],
        actions: [{ label: 'See Restaurants', uri: 'app:filter?tag=dining' }]
      });
    }

    if ((hasBabyCare && hasAccessibility) || personaLabels.has('親子友善')) {
      strategy.push({
        type: 'primary',
        title: 'Family Easy Access',
        description: 'Baby care and accessible facilities available.',
        rationale: 'Family-friendly and accessibility signals detected.',
        tags: ['baby_care', 'accessible'],
        actions: [{ label: 'View Family Facilities', uri: 'app:filter?tag=family' }]
      });
    }

    if (personaArchetype.includes('maze')) {
      strategy.push({
        type: 'secondary',
        title: 'Complex Node Assistance',
        description: 'This node is complex. Plan extra transfer time.',
        rationale: 'Persona indicates high complexity.',
        tags: ['transfer', 'planning'],
        actions: [{ label: 'Plan Transfer', uri: 'app:guide?mode=transfer' }]
      });
    }

    if (slot === 'night' && !hasAccessibility) {
      strategy.push({
        type: 'secondary',
        title: 'Night Safety Tips',
        description: 'Route via accessible paths and well-lit areas.',
        rationale: 'Night time without strong accessibility signals.',
        tags: ['safety', 'accessible'],
        actions: [
          { label: 'Locate Accessible Path', uri: 'app:filter?tag=accessible' },
          { label: 'Find Helpdesk', uri: 'app:filter?tag=service_counter' }
        ]
      });
    }

    if ((context.weather === 'hot' || (context.temperatureC ?? 0) >= 30)) {
      if (hasWaterRefill || hasDining || tags.has('shopping')) {
        strategy.push({
          type: 'secondary',
          title: 'Beat the Heat',
          description: 'Stay indoors and hydrate when temperatures are high.',
          rationale: 'Heatwave conditions detected.',
          tags: ['indoor', 'water'],
          actions: [
            { label: 'Find Indoor Spots', uri: 'app:filter?indoor=true' },
            { label: 'Water Refill', uri: 'app:filter?tag=water_refill' }
          ]
        });
      }
    }

    if (strategy.length === 0) {
      strategy.push({
        type: 'secondary',
        title: 'Explore Area',
        description: `Discover ${facilities.length} spots in this area.`,
        rationale: 'General exploration.',
        tags: Array.from(tags).slice(0, 3),
        actions: [{ label: 'Explore', uri: 'app:map' }]
      });
    }

    return strategy;
  }
}
