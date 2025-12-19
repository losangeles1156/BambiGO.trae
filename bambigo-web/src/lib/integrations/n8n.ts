import { L4ActionCard } from '../../types/tagging'

export type N8nConfig = {
  webhookUrl: string
}

export type N8nWebhookPayload = {
  query: string
  nodeId?: string
  context?: string
  trapAlerts?: string[]
  userId?: string
  timestamp?: number
  metadata?: Record<string, unknown>
}

// Expected response from n8n (can be flexible, but we define our contract)
export type N8nWebhookResponse = {
  cards?: L4ActionCard[] // n8n can return UI cards directly
  text?: string         // Simple text response
  message?: string      // Alternative text field
  fallback?: {          // Legacy/Fallback structure
    primary: unknown
    secondary?: unknown[]
    cards?: unknown[]
  }
}

export class N8nClient {
  constructor(private config: N8nConfig) {}

  /**
   * Triggers an n8n webhook and returns the typed response.
   */
  async trigger(payload: N8nWebhookPayload): Promise<N8nWebhookResponse> {
    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BambiGO-Source': 'web-client',
        'X-BambiGO-Node-ID': payload.nodeId || '',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: Date.now()
      }),
    })

    if (!response.ok) {
      throw new Error(`n8n Webhook Error (${response.status})`)
    }

    return await response.json()
  }
}
