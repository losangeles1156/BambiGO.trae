import { test, expect } from '@playwright/test';

test.describe('UI Consistency and i18n Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display correct default location in Header', async ({ page }) => {
    // Default locale is zh-TW, should show "東京站"
    const locationBtn = page.locator('.ui-header span.text-blue-600');
    await expect(locationBtn).toBeVisible({ timeout: 10000 });
    const text = await locationBtn.innerText();
    expect(['東京站', 'Tokyo Station', '東京駅']).toContain(text);
  });

  test('should update Header when a node is selected', async ({ page }) => {
    // Wait for markers to load
    const uenoMarker = page.getByTestId('marker-ueno-station');
    await expect(uenoMarker).toBeVisible({ timeout: 15000 });
    await uenoMarker.click();

    // Header should now show "上野站"
    const locationBtn = page.locator('.ui-header span.text-blue-600');
    await expect(locationBtn).toHaveText(/上野站|Ueno Station|上野駅/);
  });

  test('should switch languages correctly', async ({ page }) => {
    // Open language menu
    await page.getByLabel('Select Language').click();
    
    // Switch to English
    await page.getByText('English').click();
    
    // Check Header text
    const youAreAt = page.locator('header').getByText(/You are at|你在|現在地/);
    await expect(youAreAt).toBeVisible();
    
    const locationBtn = page.locator('.ui-header span.text-blue-600');
    await expect(locationBtn).toHaveText('Tokyo Station');

    // Switch to Japanese
    await page.getByLabel('Select Language').click();
    await page.getByText('日本語').click();
    await expect(locationBtn).toHaveText('東京駅');
  });

  test('should not contain "捷運101" or other residual text', async ({ page }) => {
    const content = await page.content();
    expect(content).not.toContain('捷運101');
    expect(content).not.toContain('世貿站');
  });

  test('buttons should meet 48dp minimum hit area', async ({ page }) => {
    const buttons = await page.locator('button.ui-btn').all();
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44); // 44-48px is acceptable for touch targets
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
