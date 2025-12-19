import { NavigationStep } from '@/types/navigation'

export type AICommand = 
  | { type: 'NAVIGATE'; payload: { to: string; lat?: number; lon?: number } }
  | { type: 'VIEW_MODE'; payload: { mode: 'explore' | 'dashboard' | 'task' } }
  | { type: 'SHOW_ALERT'; payload: { message: string; severity: 'info' | 'warning' | 'error' } }
  | { type: 'SET_FILTER'; payload: { tag: string; status?: string } }
  | { type: 'HIGHLIGHT_NODE'; payload: { id: string } }
  | { type: 'TOGGLE_MENU'; payload: { open: boolean } }
  | { type: 'UPDATE_NAVIGATION'; payload: { steps: NavigationStep[] } }

export interface AIControlInterface {
  status: 'connected' | 'disconnected' | 'connecting'
  lastCommand: AICommand | null
  sendCommand: (cmd: AICommand) => void // Send back to AI
}
