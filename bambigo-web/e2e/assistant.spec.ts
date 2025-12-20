import { test, expect } from '@playwright/test';

test.describe('AI Assistant E2E', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log('BROWSER CONSOLE:', msg.type(), msg.text());
    });
    page.on('request', request => {
      console.log('BROWSER REQUEST:', request.method(), request.url());
    });
    page.on('response', response => {
      console.log('BROWSER RESPONSE:', response.status(), response.url());
    });
  });
  test('should open assistant, send quick question, and receive response', async ({ page }) => {
    // 1. Mock the SSE endpoint
    await page.route('/api/assistant*', async route => {
      const responseBody = [
        'data: {"type": "message", "content": "好的，"}',
        'data: {"type": "message", "content": "我幫您查找回家的路線。"}',
        'data: {"type": "done"}'
      ].join('\n\n');

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: responseBody
      });
    });

    await page.goto('/');

    const fabButton = page.getByRole('button', { name: 'AI Assistant' });
    
    // Wait for map to load roughly (or just check if FAB is there)
    await expect(fabButton).toBeVisible({ timeout: 10000 });
    await fabButton.click();

    // 4. Verify Assistant Modal is Open
    await expect(page.getByRole('heading', { name: '城市 AI 助理' })).toBeVisible();
    await expect(page.getByText('你好！我是你的城市 AI 助理')).toBeVisible();

    const homeButton = page.getByRole('button', { name: '我要回家' });
    await expect(homeButton).toBeVisible();
    await homeButton.click();

    // 6. Verify User Message
    await expect(page.getByText('我想回家，請告訴我最近的車站或交通方式')).toBeVisible();

    // 7. Verify AI Response (from mock)
    // The mock sends "好的，我幫您查找回家的路線。" in two chunks.
    // The UI concatenates them.
    await expect(page.getByText('好的，我幫您查找回家的路線。')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // 1. Mock Error
    await page.route('/api/assistant*', async route => {
      await route.abort('failed');
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'AI Assistant' }).click();
    
    // Send a message manually
    await page.getByPlaceholder('你可以問我...').fill('Hello');
    await page.getByRole('button', { name: 'Send Message' }).click();

    // Wait for error message
    // In FullScreenAssistant.tsx: setError('連線中斷，請稍後重試') or '無法連接到 AI 服務'
    // Since we aborted, it might be 'Stream error' -> '連線中斷...' or fetch error -> '無法連接...'
    // Note: EventSource error handling is tricky to mock perfectly with abort, but let's try.
    await expect(page.getByText(/連線中斷|無法連接/)).toBeVisible();
  });
});
