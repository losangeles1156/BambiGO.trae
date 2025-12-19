import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchJmaAlerts } from '../src/lib/weather/jma_rss'

// Mock XML Response
const MOCK_XML_EXTRA = `
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>JMA Extra Feed</title>
  <updated>2023-10-01T12:00:00Z</updated>
  <entry>
    <title>気象特別警報報（東京都）</title>
    <link href="https://example.com/1" />
    <id>urn:uuid:1</id>
    <updated>2023-10-01T12:00:00Z</updated>
    <content type="text">東京都に大雨特別警報発表</content>
  </entry>
  <entry>
    <title>気象警報（大阪府）</title>
    <link href="https://example.com/2" />
    <id>urn:uuid:2</id>
    <updated>2023-10-01T11:00:00Z</updated>
    <content type="text">大阪府に洪水警報</content>
  </entry>
  <entry>
    <title>気象注意報（東京都）</title>
    <link href="https://example.com/3" />
    <id>urn:uuid:3</id>
    <updated>2023-10-01T10:00:00Z</updated>
    <content type="text">東京都に雷注意報</content>
  </entry>
</feed>
`

const MOCK_XML_EQVOL = `
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>震源・震度情報</title>
    <content>東京都で震度４</content>
    <updated>2023-10-01T13:00:00Z</updated>
  </entry>
</feed>
`

global.fetch = vi.fn()

describe('JMA RSS Parser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters for Tokyo and High/Medium severity', async () => {
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('extra.xml')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_XML_EXTRA)
        })
      }
      if (url.includes('eqvol.xml')) {
         return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_XML_EQVOL)
        })
      }
      return Promise.reject('Unknown URL')
    })

    const alerts = await fetchJmaAlerts()
    
    // Expectations:
    // 1. "気象特別警報報（東京都）" -> Tokyo & High Severity -> KEPT
    // 2. "気象警報（大阪府）" -> Osaka -> REJECTED
    // 3. "気象注意報（東京都）" -> Tokyo & Low Severity & Not Earthquake -> REJECTED
    // 4. "震源・震度情報" (content: 東京都で震度４) -> Tokyo & Earthquake -> KEPT

    expect(alerts.length).toBe(2)
    
    const titles = alerts.map(a => a.title)
    expect(titles).toContain('気象特別警報報（東京都）')
    expect(titles).toContain('震源・震度情報')
    expect(titles).not.toContain('気象警報（大阪府）')
    expect(titles).not.toContain('気象注意報（東京都）')

    // Check sorting (newest first)
    // Earthquake: 13:00
    // Extra: 12:00
    expect(alerts[0].title).toBe('震源・震度情報')
  })
})
