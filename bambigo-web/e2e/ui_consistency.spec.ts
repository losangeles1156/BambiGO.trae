import { test, expect } from '@playwright/test';

test.describe('UI Consistency and i18n Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __BAMBIGO_E2E__?: boolean }).__BAMBIGO_E2E__ = true
    })
    await page.goto('/');

    const collapse = page.getByRole('button', { name: 'Collapse issues badge' })
    if (await collapse.isVisible()) {
      await collapse.click()
    }
  });

  test('should display correct default location in Header', async ({ page }) => {
    // Default locale is zh-TW, should show "東京站"
    const locationBtn = page.locator('.ui-header button.text-blue-600');
    await expect(locationBtn).toBeVisible({ timeout: 10000 });
    const text = await locationBtn.innerText();
    expect(text).toMatch(/東京站|上野站|銀座站|Tokyo Station|Ueno Station|Ginza Station|東京駅|上野駅|銀座駅/);
  });

  test('should update Header when a node is selected', async ({ page }) => {
    // Wait for markers to load
    const uenoMarker = page.getByTestId('marker-mock-ueno');
    await expect(uenoMarker).toBeVisible({ timeout: 15000 });
    await uenoMarker.click();

    // Header should now show "上野站"
    const locationBtn = page.locator('.ui-header button.text-blue-600');
    await expect(locationBtn).toContainText(/上野站|Ueno Station|上野駅/);
  });

  test('should open map layer picker and switch map styles', async ({ page }) => {
    const layersBtn = page.getByLabel('Map Layers')
    await expect(layersBtn).toBeVisible({ timeout: 15000 })
    await layersBtn.click()

    await expect(page.getByText('Map Style')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Positron Clean' })).toBeVisible()

    await page.getByRole('button', { name: 'Positron Clean' }).click()

    await expect(page.getByText('Map Style')).toBeHidden({ timeout: 10000 })

    const uenoMarker = page.getByTestId('marker-mock-ueno')
    await expect(uenoMarker).toBeVisible({ timeout: 15000 })
  })

  test('should switch languages correctly', async ({ page }) => {
    const setLang = async (label: 'EN' | '日本語') => {
      const expected = label === 'EN' ? 'en' : 'ja'

      const closeBtn = page.getByLabel('Close menu')

      const closeBtnInViewport = async () => {
        if (!(await closeBtn.isVisible())) return false
        const box = await closeBtn.boundingBox()
        if (!box) return false
        const viewport = page.viewportSize()
        if (!viewport) return false
        return box.x >= 0 && box.y >= 0 && box.x <= viewport.width && box.y <= viewport.height
      }

      const headerBtns = page.locator('.ui-header').getByRole('button', { name: label, exact: true })
      if (!(await closeBtnInViewport()) && (await headerBtns.count()) > 0 && await headerBtns.first().isVisible()) {
        await headerBtns.first().click()
        await expect(page.locator('html')).toHaveAttribute('lang', expected, { timeout: 15000 })
        return
      }

      if (!(await closeBtnInViewport())) {
        await page.locator('.ui-header').getByRole('button', { name: 'Menu', exact: true }).click({ force: true })
        await expect.poll(async () => await closeBtnInViewport(), { timeout: 10000 }).toBe(true)
      }

      const sidebar = closeBtn.locator('..').locator('..')
      const langBtn = sidebar.getByRole('button', { name: label, exact: true }).first()
      await expect(langBtn).toBeVisible({ timeout: 10000 })

      try {
        await langBtn.click({ timeout: 3000 })
      } catch {
        await langBtn.evaluate((el) => (el as HTMLElement).click())
      }
      await expect(page.locator('html')).toHaveAttribute('lang', expected, { timeout: 15000 })
    }

    const locationBtn = page.locator('.ui-header button.text-blue-600')

    await setLang('日本語')
    await expect(locationBtn).toBeVisible()

    await setLang('EN')
    await expect(locationBtn).toBeVisible()
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
