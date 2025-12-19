export type NavigationStep = {
  id: string
  instruction: string
  distance: number // meters
  type: 'straight' | 'turn-left' | 'turn-right' | 'turn-slight-left' | 'turn-slight-right' | 'u-turn' | 'arrive' | 'start'
  secondaryText?: string
}
