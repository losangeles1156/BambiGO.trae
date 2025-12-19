import { NextResponse } from 'next/server';
import { fetchJmaAlerts, WeatherAlert } from '@/lib/weather/jma_rss';

// N8N Sentry Response Schema
type N8nSentryResponse = {
  active: boolean;
  match?: boolean;
  severity?: 'high' | 'medium' | 'low';
  type?: 'weather' | 'earthquake' | 'other';
  title?: string;
  description?: string;
  timestamp?: string;
  tags?: {
    l1?: string[];
    l3?: string[];
    l4?: string;
  };
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const simulate = searchParams.get('simulate') === 'true';
    const n8nWebhook = process.env.N8N_WEATHER_WEBHOOK;
    let alerts: WeatherAlert[] = [];
    let source = 'JMA RSS (Local Parse)';

    // 0. Simulation Mode
    if (simulate) {
      return NextResponse.json({
        alerts: [{
          id: `sim-${Date.now()}`,
          title: '【訓練】緊急地震速報 (Test Alert)',
          updated: new Date().toISOString(),
          link: 'https://www.jma.go.jp/bosai/map.html',
          summary: '這是一個測試警報。震度 5 強 - 東京千代田區。請立即避難。',
          type: 'earthquake',
          severity: 'high',
          tags: { l1: ['park', 'open_space'], l3: ['evacuation_site', 'medical_center'], l4: 'seek_shelter' }
        }],
        meta: { source: 'Simulation Mode', timestamp: new Date().toISOString() }
      });
    }

    // 1. Try n8n Sentry
    if (n8nWebhook) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for webhook

        const res = await fetch(n8nWebhook, { 
          method: 'GET',
          headers: { 'X-Source': 'BambiGO-Web' },
          signal: controller.signal,
          next: { revalidate: 60 }
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json() as N8nSentryResponse;
          if (data.active && data.title) {
            alerts.push({
              id: `n8n-${Date.now()}`,
              title: data.title,
              updated: data.timestamp || new Date().toISOString(),
              link: 'https://www.jma.go.jp/bosai/map.html',
              summary: data.description || '',
              type: data.type || 'other',
              severity: data.severity || 'medium',
              tags: data.tags
            });
            source = 'n8n Sentry (Core)';
          }
        }
      } catch (error) {
        console.warn('n8n Sentry unreachable or timed out:', error);
      }
    }

    // 2. Fallback to Local RSS
    if (alerts.length === 0) {
      try {
        const jmaAlerts = await fetchJmaAlerts();
        if (Array.isArray(jmaAlerts)) {
          alerts = jmaAlerts;
        }
      } catch (error) {
        console.error('Local RSS Fallback Failed:', error);
      }
    }

    return NextResponse.json({ 
      alerts,
      meta: { source, timestamp: new Date().toISOString() }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    });
  } catch (error) {
    console.error('API weather/alerts critical error:', error);
    return NextResponse.json({ alerts: [], meta: { error: 'Internal Error', timestamp: new Date().toISOString() } }, { status: 500 });
  }
}
