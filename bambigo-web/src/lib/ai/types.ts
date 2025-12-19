export type AICommandType = 'NAVIGATE' | 'SEARCH' | 'ZOOM' | 'FILTER' | 'RESET'

export interface AICommand {
  id: string
  type: AICommandType
  payload: Record<string, unknown>
  timestamp: number
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  command?: AICommand
}

export interface AIState {
  connected: boolean
  processing: boolean
  lastCommand: AICommand | null
  messages: AIMessage[]
}
