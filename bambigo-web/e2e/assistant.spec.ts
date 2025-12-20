import { test, expect } from '@playwright/test';

async function installMockEventSource(
  page: any,
  config: {
    messages?: Array<{ type: string; content?: string }>
    error?: boolean
    delayMs?: number
  }
) {
  await page.addInitScript(
    ({ messages, error, delayMs }: { messages?: Array<{ type: string; content?: string }>; error?: boolean; delayMs?: number }) => {
      class MockEventSource {
        url: string
        readyState: number
        onmessage: ((event: any) => void) | null
        onerror: ((event: any) => void) | null

        constructor(url: string) {
          this.url = url
          this.readyState = 0
          this.onmessage = null
          this.onerror = null

          const ms = typeof delayMs === 'number' ? delayMs : 10
          setTimeout(() => {
            if (error) {
              this.readyState = 2
              this.onerror?.(new Event('error'))
              return
            }

            for (const msg of messages || []) {
              this.onmessage?.({ data: JSON.stringify(msg) })
            }
          }, ms)
        }

        close() {
          this.readyState = 2
        }
      }

      ;(window as any).EventSource = MockEventSource
    },
    config
  )
}

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
    await installMockEventSource(page, {
      messages: [
        { type: 'message', content: '好的，' },
        { type: 'message', content: '我幫您查找回家的路線。' },
        { type: 'done' },
      ],
    })

    await page.goto('/');

    const fabButton = page.getByRole('button', { name: 'AI Assistant' });
    
    // Wait for map to load roughly (or just check if FAB is there)
    await expect(fabButton).toBeVisible({ timeout: 10000 });
    await fabButton.click();

    const dialog = page.getByRole('dialog', { name: 'AI Assistant' });

    // 4. Verify Assistant Modal is Open
    await expect(dialog.getByRole('heading', { level: 3, name: /AI (Guide|嚮導)|城市 AI 助理/ })).toBeVisible();
    await expect(dialog.getByText(/How can I help you\?|有什麼我可以幫你的嗎？/)).toBeVisible();

    const homeButton = dialog.getByRole('button', { name: /Home|我要回家/ });
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
    await installMockEventSource(page, { error: true })

    await page.goto('/');
    await page.getByRole('button', { name: 'AI Assistant' }).click();

    const dialog = page.getByRole('dialog', { name: 'AI Assistant' });
    
    // Send a message manually
    await dialog.getByLabel('Assistant Input').fill('Hello');
    await dialog.getByRole('button', { name: 'Send Message' }).click();

    // Wait for error message
    // In FullScreenAssistant.tsx: setError('連線中斷，請稍後重試') or '無法連接到 AI 服務'
    // Since we aborted, it might be 'Stream error' -> '連線中斷...' or fetch error -> '無法連接...'
    // Note: EventSource error handling is tricky to mock perfectly with abort, but let's try.
    await expect(page.getByText(/連線中斷|無法連接/)).toBeVisible();
  });
});
