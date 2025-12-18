import { L4ActionCard } from '@/types/tagging';

type Context = {
  weather?: string;
  time?: string;
};

type Facility = {
  type: string;
  attributes?: {
    subCategory?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export class StrategyEngine {
  static generate(facilities: Facility[], context: Context): L4ActionCard[] {
    const tags = new Set(facilities.map((f) => f.type));
    const subTags = new Set(facilities.map((f) => f.attributes?.subCategory));
    
    const strategy: L4ActionCard[] = [];
  
    // Rule 1: Rainy Day
    if (context.weather === 'rain') {
      if (tags.has('shopping') || tags.has('dining')) {
        strategy.push({
          type: 'primary',
          title: 'Stay Dry & Shop',
          description: 'This location has indoor facilities suitable for rainy days.',
          rationale: 'Weather is rainy and indoor facilities are available.',
          tags: ['shopping', 'dining'],
          actions: [{ label: 'Find Shelter', uri: 'app:filter?indoor=true' }]
        });
      }
    }
  
    // Rule 2: Work Friendly
    if (tags.has('wifi') && tags.has('charging')) {
      strategy.push({
        type: 'secondary',
        title: 'Remote Work Spot',
        description: 'Good for catching up on work with WiFi and Power.',
        rationale: 'Presence of WiFi and Charging facilities.',
        tags: ['wifi', 'charging'],
        actions: [{ label: 'View Workspaces', uri: 'app:filter?tag=wifi' }]
      });
    }
  
    // Rule 3: Dining Time
    if (context.time === 'lunch' || context.time === 'dinner') {
      if (tags.has('dining')) {
        strategy.push({
          type: 'primary',
          title: 'Time to Eat',
          description: 'Great dining options nearby.',
          rationale: 'It is meal time and dining is available.',
          tags: ['dining'],
          actions: [{ label: 'See Restaurants', uri: 'app:filter?tag=dining' }]
        });
      }
    }
  
    // Fallback if empty
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
