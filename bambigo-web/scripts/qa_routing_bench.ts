import { fetchWalkingRoute } from '../src/lib/sop/engine';

/**
 * QA Test Suite for Routing
 * Validates 100+ O-D pairs and performance benchmarks
 */

interface QATestCase {
  id: string;
  start: [number, number];
  end: [number, number];
  description: string;
  expectedSafe?: boolean;
}

const TOKYO_STATIONS: [number, number][] = [
  [139.7671, 35.6812], // Tokyo
  [139.7774, 35.7141], // Ueno
  [139.7003, 35.6895], // Shinjuku
  [139.7013, 35.6581], // Shibuya
  [139.7282, 35.6667], // Roppongi
];

const generateTestCases = (): QATestCase[] => {
  const cases: QATestCase[] = [];
  let id = 1;

  // Generate 100 pairs from various points in Tokyo
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      if (i === j) continue;
      
      const p1 = TOKYO_STATIONS[i % TOKYO_STATIONS.length];
      const p2 = TOKYO_STATIONS[j % TOKYO_STATIONS.length];
      
      // Add slight jitter to create unique pairs
      const start: [number, number] = [p1[0] + (i * 0.001), p1[1] + (j * 0.001)];
      const end: [number, number] = [p2[0] - (j * 0.001), p2[1] - (i * 0.001)];
      
      cases.push({
        id: `qa-${id++}`,
        start,
        end,
        description: `Route from ${id} point A to point B`
      });
    }
  }
  return cases.slice(0, 100);
};

export async function runQABenchmark() {
  const cases = generateTestCases();
  const results = {
    total: cases.length,
    success: 0,
    failed: 0,
    avgLatency: 0,
    safetyCheckPassed: 0,
    compromisedCount: 0
  };

  const startTime = Date.now();
  
  // We'll run them in batches to avoid overwhelming the public API
  const BATCH_SIZE = 5;
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (c) => {
      const start = Date.now();
      try {
        const route = await fetchWalkingRoute(c.start, c.end, { useCache: false });
        const latency = Date.now() - start;
        results.success++;
        if (route && route.features?.[0]?.properties?.safety_status === 'safe') {
          results.safetyCheckPassed++;
        } else {
          results.compromisedCount++;
        }
        return latency;
      } catch {
        results.failed++;
        return 0;
      }
    });

    const latencies = await Promise.all(promises);
    results.avgLatency += latencies.reduce((a, b) => a + b, 0);
    
    // Sleep a bit between batches
    await new Promise(r => setTimeout(r, 500));
  }

  results.avgLatency /= results.success;
  const totalTime = Date.now() - startTime;

  console.log('📊 QA Benchmark Results:', {
    ...results,
    totalTimeMs: totalTime
  });

  return results;
}
