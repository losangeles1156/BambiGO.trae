import { ReadableStream } from 'stream/web'

export type DifyConfig = {
  apiKey: string
  apiUrl: string
}

export type DifyChatMessageRequest = {
  inputs: Record<string, unknown>
  query: string
  response_mode: 'streaming' | 'blocking'
  user: string
  conversation_id?: string
  files?: Array<{
    type: 'image'
    transfer_method: 'remote_url' | 'local_file'
    url?: string
    upload_file_id?: string
  }>
  auto_generate_name?: boolean
}

// Dify Streaming Event Types
export type DifyEvent = 
  | { event: 'message'; task_id: string; id: string; answer: string; conversation_id: string; created_at: number }
  | { event: 'agent_message'; task_id: string; id: string; answer: string; conversation_id: string; created_at: number }
  | { event: 'workflow_started'; workflow_run_id: string; task_id: string; data: unknown }
  | { event: 'workflow_finished'; workflow_run_id: string; task_id: string; data: unknown }
  | { event: 'message_end'; task_id: string; id: string; conversation_id: string; metadata: unknown }
  | { event: 'message_replace'; task_id: string; id: string; answer: string; conversation_id: string; created_at: number }
  | { event: 'error'; code: string; message: string; status: number }
  | { event: 'ping' }

export class DifyClient {
  constructor(private config: DifyConfig) {}

  /**
   * Sends a chat message to Dify and returns a ReadableStream of formatted Server-Sent Events (SSE).
   * The stream yields strings in the format `data: <json>\n\n`.
   */
  async chatMessageStream(payload: DifyChatMessageRequest): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dify API Error (${response.status}): ${errorText}`)
    }

    if (!response.body) {
      throw new Error('Dify API returned no response body')
    }

    // We return the raw stream from fetch directly, letting the caller handle the SSE parsing if they want,
    // OR we could wrap it to normalize the events.
    // For BambiGO's current route handler, passing the raw stream (or a transformed one) is best.
    // However, the current route handler does manual parsing.
    // Let's return the raw stream for now, but ensure it's compatible with Web ReadableStream.
    return response.body as unknown as ReadableStream<Uint8Array>
  }

  /**
   * Sends a blocking chat message and returns the final result.
   */
  async chatMessage(payload: Omit<DifyChatMessageRequest, 'response_mode'>): Promise<{ answer: string; conversation_id: string }> {
    const response = await fetch(`${this.config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, response_mode: 'blocking' }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dify API Error (${response.status}): ${errorText}`)
    }

    return await response.json()
  }
}
