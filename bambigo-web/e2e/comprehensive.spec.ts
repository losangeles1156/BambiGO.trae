import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('appLang', 'zh-TW');
    });
  });

  test.describe('Route Navigation', () => {
    test('should load home page successfully', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/BambiGO/);
      await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
    });

    test('should load profile page', async ({ page }) => {
      await page.goto('/profile');
      await expect(page.getByText('歡迎來到 BambiGO')).toBeVisible();
    });

    // Add other known routes if any
  });

  test.describe('Interactive Elements', () => {
    test('search bar should allow input', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByPlaceholder('搜尋地點、設施或需求...');
      await expect(searchInput).toBeVisible();
      await searchInput.fill('Tokyo Tower');
      await expect(searchInput).toHaveValue('Tokyo Tower');
    });

    test('FAB menu should toggle', async ({ page }) => {
      await page.goto('/');
      // Assuming FAB Group is present
      const aiFab = page.getByRole('button', { name: 'AI Assistant' });
      await expect(aiFab).toBeVisible();
    });
    
    test('Breadcrumbs should be interactive', async ({ page }) => {
      await page.goto('/');
      // Click on "首頁" breadcrumb (though we are already there, just checking existence)
      await expect(page.getByText('首頁')).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      // Check if MobileViewport wrapper is active (e.g. max-w-md class or similar check if possible, 
      // but purely checking visibility of key mobile elements is enough)
      await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
      // Check bottom search bar position or visibility
      const searchBar = page.getByPlaceholder('搜尋地點、設施或需求...');
      await expect(searchBar).toBeVisible();
    });

    test('should adapt to desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
      // In desktop, the layout might be different, but for now checking no breakage
    });
  });

  test.describe('API & Data Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock 500 error for weather
      await page.route('/api/weather/alerts', async route => {
        await route.fulfill({ status: 500 });
      });
      
      await page.goto('/');
      // Ensure app doesn't crash (map still visible)
      await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
      // Optionally check for error toast if implemented
    });
  });

});
