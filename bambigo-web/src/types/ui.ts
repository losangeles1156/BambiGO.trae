export type Name = { ja?: string; en?: string; zh?: string }
export type Tag = { label: string; tone?: 'purple' | 'yellow' | 'gray' | 'blue' }
export type Status = { label: string; color?: 'yellow' | 'blue' | 'gray' }
export type Recommendation = { title: string; body?: string; sources?: string[]; primary?: string; secondary?: string[] }
export type Facility = { name: string; desc?: string }

