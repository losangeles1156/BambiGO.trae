import { test, expect } from '@playwright/test';

test('guest user should see login button', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('/profile');
  
  // Wait for potential loading
  await page.waitForLoadState('networkidle');

  // Check if loader is present
  const loader = page.locator('.animate-spin');
  if (await loader.isVisible()) {
    console.log('Loader is visible');
  }

  await expect(page.getByRole('button', { name: /Google/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('歡迎來到 BambiGO')).toBeVisible();
});

test('guest user can navigate back to home', async ({ page }) => {
  await page.goto('/profile');
  await page.click('text=返回首頁');
  await expect(page).toHaveURL('/');
});
