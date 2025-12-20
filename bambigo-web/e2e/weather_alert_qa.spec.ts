import { test, expect } from '@playwright/test';

test.describe('Weather Alert QA', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    // Mock Supabase calls or other APIs that might block rendering
    await page.route('**/api/nodes/live/facilities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facilities: { items: [] },
          live: { mobility: { stations: [] }, transit: { status: 'normal' } }
        })
      });
    });

    await page.route('**/api/nodes/*/strategy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock the weather alerts API
    await page.route('**/api/weather/alerts', async (route) => {
      console.log('Mocking /api/weather/alerts');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alerts: [
            {
              id: 'test-alert-1',
              title: 'Test High Severity Alert',
              summary: 'This is a high severity test alert for QA.',
              severity: 'high',
              type: 'earthquake',
              tags: { l4: 'seek_shelter' }
            },
            {
              id: 'test-alert-2',
              title: 'Test Medium Severity Alert',
              summary: 'This is a medium severity test alert for QA.',
              severity: 'medium',
              type: 'weather',
              tags: { l4: 'bring_umbrella' }
            }
          ]
        })
      });
    });

    // Navigate directly to the dashboard using query params
    await page.goto('/?nodeId=mock-ueno-station');
    
    // Wait for the dashboard to load - looking for a node card
    await page.waitForSelector('[data-testid="node-detail-card"]', { timeout: 15000 });
  });

  test('Weather alert L2 display and design compliance', async ({ page }) => {
    // Check L2 display - wait for the alerts to be rendered
    await page.waitForSelector('[data-testid="weather-alerts-section"]', { timeout: 15000 });
    const alertLocator = page.locator('[data-testid="alert-title"]');
    await expect(alertLocator.first()).toBeVisible();
    
    // Debug: Print all alert titles found
    const titles = await alertLocator.allInnerTexts();
    console.log('Detected Alert Titles:', titles);

    const highAlert = page.locator('div[role="alert"]').filter({ has: page.locator('[data-testid="alert-title"]:text("Test High Severity Alert")') });
    await expect(highAlert).toBeVisible();
    await expect(highAlert).toHaveClass(/bg-red-50/); // High severity style

    const mediumAlert = page.locator('div[role="alert"]').filter({ has: page.locator('[data-testid="alert-title"]:text("Test Medium Severity Alert")') });
    await expect(mediumAlert).toBeVisible();
    await expect(mediumAlert).toHaveClass(/bg-yellow-50/); // Medium severity style

    // 2. Check Design Compliance (Icons, Tags)
    // The earthquake icon is Zap with pulse animation
    await expect(highAlert.locator('svg.animate-pulse')).toBeVisible(); 
    
    // Check L4 tag translation - depends on locale, but since we're in default (zh-TW)
    // Using regex to be more flexible with exact text matches
    await expect(highAlert.locator('text=/立即避難|Seek Shelter|避難/')).toBeVisible();

    // 3. Accessibility Compliance
    await expect(highAlert).toHaveAttribute('role', 'alert');
    await expect(highAlert).toHaveAttribute('aria-live', 'assertive');
  });

  test('Responsive design - Mobile View', async ({ page }) => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/?nodeId=mock-ueno-station');
    await page.waitForSelector('[data-testid="weather-alerts-section"]', { timeout: 15000 });
    
    const alert = page.locator('div[role="alert"]').first();
    await expect(alert).toBeVisible();
    
    // Check if it fits within the viewport width
    const box = await alert.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
});
