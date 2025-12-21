import { L4ActionCard } from '@/types/tagging';

type Context = {
  weather?: string;
  time?: string;
  now?: Date;
  personaArchetype?: string;
  personaLabels?: string[];
  temperatureC?: number;
  odptStation?: {
    station_code?: string
    railway?: string
    operator?: string
    connecting_railways?: string[]
    exits?: string[]
    raw?: unknown
  }
  userStates?: string[]
  knowledgeMap?: Record<string, string>
};

type Facility = {
  type: string;
  attributes?: {
    subCategory?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
    const oh = (f.attributes?.openingHours || f.openingHours) as string | undefined;
    const ranges = parseOpeningHours(oh);
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
          id: 'rain-shop',
          type: 'primary',
          title: 'Stay Dry & Shop',
          description: 'Indoor options available for rainy weather.',
          rationale: 'Rainy weather with indoor facilities present.',
          tags: ['shopping', 'dining'],
          actions: [{ label: 'Find Shelter', action: 'filter', params: { indoor: true } }]
        });
      }
    }

    if ((hasWifi && hasCharging) || personaLabels.has('數位遊牧友好')) {
      strategy.push({
        id: 'remote-work',
        type: 'secondary',
        title: 'Remote Work Spot',
        description: 'WiFi and power available for work.',
        rationale: 'Connectivity and power readiness detected.',
        tags: ['wifi', 'charging'],
        actions: [{ label: 'View Workspaces', action: 'filter', params: { tag: 'wifi' } }]
      });
    }

    const slot = context.time ? (context.time as string) : getTimeSlot(context);
    if ((slot === 'lunch' || slot === 'dinner') && hasDining && isOpenNowDining(facilities, context.now ?? new Date())) {
      strategy.push({
        id: 'dining-now',
        type: 'primary',
        title: 'Time to Eat',
        description: 'Dining options available now.',
        rationale: 'Meal time window detected with dining nearby.',
        tags: ['dining'],
        actions: [{ label: 'See Restaurants', action: 'filter', params: { tag: 'dining', status: 'open_now' } }]
      });
    }

    if ((hasBabyCare && hasAccessibility) || personaLabels.has('親子友善')) {
      strategy.push({
        id: 'family-access',
        type: 'primary',
        title: 'Family Easy Access',
        description: 'Baby care and accessible facilities available.',
        rationale: 'Family-friendly and accessibility signals detected.',
        tags: ['baby_care', 'accessible'],
        actions: [{ label: 'View Family Facilities', action: 'filter', params: { tag: 'family' } }]
      });
    }

    if (personaArchetype.includes('maze')) {
      strategy.push({
        id: 'complex-node',
        type: 'secondary',
        title: 'Complex Node Assistance',
        description: 'This node is complex. Plan extra transfer time.',
        rationale: 'Persona indicates high complexity.',
        tags: ['transfer', 'planning'],
        actions: [{ label: 'Plan Transfer', action: 'guide', params: { mode: 'transfer' } }]
      });
    }

    if (slot === 'night' && !hasAccessibility) {
      strategy.push({
        id: 'night-safety',
        type: 'secondary',
        title: 'Night Safety Tips',
        description: 'Route via accessible paths and well-lit areas.',
        rationale: 'Night time without strong accessibility signals.',
        tags: ['safety', 'accessible'],
        actions: [
          { label: 'Locate Accessible Path', action: 'filter', params: { tag: 'accessible' } },
          { label: 'Find Helpdesk', action: 'filter', params: { tag: 'service_counter' } }
        ]
      });
    }

    if ((context.weather === 'hot' || (context.temperatureC ?? 0) >= 30)) {
      if (hasWaterRefill || hasDining || tags.has('shopping')) {
        strategy.push({
          id: 'heat-relief',
          type: 'secondary',
          title: 'Beat the Heat',
          description: 'Stay indoors and hydrate when temperatures are high.',
          rationale: 'Heatwave conditions detected.',
          tags: ['indoor', 'water'],
          actions: [
            { label: 'Find Indoor Spots', action: 'filter', params: { indoor: true } },
            { label: 'Water Refill', action: 'filter', params: { tag: 'water_refill' } }
          ]
        });
      }
    }

    // User State Strategies
    const userStates = new Set(context.userStates || []);
    const knowledge = context.knowledgeMap || {};

    if (userStates.has('large_luggage')) {
      strategy.unshift({
        id: 'luggage-assist',
        type: 'primary',
        title: '電梯優先路徑',
        description: '檢測到大型行李。建議使用電梯或手扶梯，避免樓梯。',
        rationale: 'Large luggage detected.',
        knowledge: knowledge['large_luggage'],
        tags: ['accessibility', 'elevator'],
        actions: [{ label: '尋找電梯', action: 'filter', params: { tag: 'elevator' } }]
      });
    }

    if (userStates.has('stroller')) {
      strategy.unshift({
        id: 'stroller-assist',
        type: 'primary',
        title: '無障礙與育嬰指引',
        description: '已為您篩選寬閘門出口與育嬰室位置。',
        rationale: 'Stroller detected.',
        knowledge: knowledge['stroller'],
        tags: ['accessibility', 'baby_care'],
        actions: [{ label: '育嬰設施', action: 'filter', params: { tag: 'baby_care' } }]
      });
    }

    if (userStates.has('mobility_impaired')) {
      strategy.unshift({
        id: 'mobility-assist',
        type: 'alert',
        title: '無障礙動線確認',
        description: '已標記所有無障礙坡道與多功能廁所。',
        rationale: 'Mobility impairment detected.',
        knowledge: knowledge['mobility_impaired'],
        tags: ['accessibility', 'toilet'],
        actions: [{ label: '無障礙地圖', action: 'map', params: { mode: 'accessible' } }]
      });
    }

    if (userStates.has('rush')) {
      strategy.unshift({
        id: 'rush-mode',
        type: 'primary',
        title: '極速轉乘建議',
        description: '建議搭乘第 3 或第 7 車廂，下車即達手扶梯。',
        rationale: 'User is in a rush.',
        knowledge: knowledge['rush'],
        tags: ['transport', 'speed'],
        actions: [{ label: '查看最佳車廂', action: 'guide', params: { mode: 'fast' } }]
      });
    }

    if (strategy.length === 0) {
      strategy.push({
        id: 'explore-area',
        type: 'secondary',
        title: 'Explore Area',
        description: `Discover ${facilities.length} spots in this area.`,
        rationale: 'General exploration.',
        tags: Array.from(tags).slice(0, 3),
        actions: [{ label: 'Explore', action: 'map' }]
      });
    }

    if (context.odptStation) {
      const lineName = context.odptStation.railway?.split(':').pop()?.split('.').pop() || 'Transit'
      strategy.push({
        id: 'odpt-nav',
        type: 'primary',
        title: `${lineName} 站內導航`,
        description: `包含 ${context.odptStation.exits?.length || 0} 個出口與 ${context.odptStation.connecting_railways?.length || 0} 條轉乘路線資訊。`,
        rationale: 'Transport node with ODPT data',
        tags: ['transport', 'navigation'],
        actions: [{ label: '查看出口地圖', action: 'exits' }]
      })
    }

    return strategy;
  }
}
