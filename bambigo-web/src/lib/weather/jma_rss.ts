import { XMLParser } from 'fast-xml-parser';

export type WeatherAlert = {
  id: string;
  title: string;
  updated: string;
  link: string;
  summary: string;
  type: 'weather' | 'earthquake' | 'other';
  severity: 'high' | 'medium' | 'low';
  tags?: {
    l1?: string[]; // Impacted areas (e.g., 'park', 'river')
    l3?: string[]; // Suggested facilities (e.g., 'evacuation_site')
    l4?: string;   // Immediate action (e.g., 'seek_shelter')
  };
};

const FEEDS = [
  { url: 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml', type: 'weather' },
  { url: 'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml', type: 'earthquake' }
] as const;

// Keywords to filter for Tokyo area
// 130000: Tokyo Prefecture code roughly
const TARGET_AREAS = ['東京都', '東京地方', '伊豆諸島', '小笠原諸島'];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

function isAbortError(e: unknown): boolean {
  const err = e as { name?: unknown; message?: unknown } | null
  const name = err && typeof err === 'object' ? String(err.name || '') : ''
  const message = err && typeof err === 'object' ? String(err.message || '') : ''
  if (name === 'AbortError') return true
  const m = message.toLowerCase()
  return m.includes('abort') || m.includes('aborted') || m.includes('canceled') || m.includes('cancelled')
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { next: { revalidate: 300 }, signal: controller.signal })
    if (!res.ok) throw new Error(`Failed to fetch ${url}`)
    return await res.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchJmaAlerts(): Promise<WeatherAlert[]> {
  const alerts: WeatherAlert[] = [];
  
  // Use Promise.allSettle to avoid one feed failure blocking others
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const xml = await fetchTextWithTimeout(feed.url, 2500)
        const parsed = parser.parse(xml);
        
        // Atom feed structure: feed -> entry[]
        const entries = Array.isArray(parsed.feed.entry) 
          ? parsed.feed.entry 
          : [parsed.feed.entry].filter(Boolean);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return entries.map((entry: any) => {
            const titleObj = entry.title;
            const title = typeof titleObj === 'string' ? titleObj : (titleObj?.['#text'] || '');
            const contentObj = entry.content || entry.summary;
            const content = typeof contentObj === 'string' ? contentObj : (contentObj?.['#text'] || '');
            
            // Filter Logic:
            // 1. Check if it involves Target Areas
            const isTargetArea = TARGET_AREAS.some(area => 
              title.includes(area) || content.includes(area)
            );
            
            if (!isTargetArea) return null;

            // 2. Determine Severity/Type
            // JMA titles usually look like "気象警報・注意報（東京都）"
            let severity: WeatherAlert['severity'] = 'low';
            if (title.includes('特別警報') || title.includes('震度５') || title.includes('震度６') || title.includes('震度７')) {
                severity = 'high';
            } else if (title.includes('警報') || title.includes('震度４')) {
                severity = 'medium';
            }

            // Only return if it's at least a warning (medium) or specifically requested
            // User asked for "Warning/Alerts" (警報). simple advisories (注意報) might be too noisy?
            // Let's include Medium/High for now.
            // Also include any Earthquake info that passed the Area check
            const isEarthquake = title.includes('地震') || title.includes('震度') || title.includes('震源');
            if (severity === 'low' && !isEarthquake) return null; 

            // 3. Assign Suggested Tags (L4 Action)
            const tags: WeatherAlert['tags'] = {};
            if (severity === 'high') {
                tags.l4 = 'seek_shelter';
            } else if (title.includes('大雨') || title.includes('暴風')) {
                tags.l4 = 'avoid_underground';
            } else if (title.includes('雨')) {
                tags.l4 = 'bring_umbrella';
            }

            return {
              id: entry.id,
              title: title,
              updated: entry.updated,
              link: entry.link?.['@_href'] || '',
              summary: content.substring(0, 200) + '...', // Truncate for safety
              type: feed.type,
              severity,
              tags
            } as WeatherAlert;
        }).filter(Boolean) as WeatherAlert[];

      } catch (error) {
        if (!isAbortError(error)) {
          console.error(`Error fetching JMA feed ${feed.url}:`, error);
        }
        return [];
      }
    })
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      alerts.push(...result.value);
    }
  });

  // Sort by date desc
  return alerts.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
}
