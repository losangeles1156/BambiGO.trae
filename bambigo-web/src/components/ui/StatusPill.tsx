'use client'

import React from 'react'
import { clsx } from 'clsx'

export type StatusSeverity = 'info' | 'warning' | 'error' | 'success'

interface StatusPillProps {
  icon?: React.ReactNode
  text: string
  severity?: StatusSeverity
  className?: string
}

const severityStyles: Record<StatusSeverity, { bg: string, text: string, border: string }> = {
  info: { 
    bg: 'bg-indigo-50', 
    text: 'text-indigo-700',
    border: 'border-indigo-100'
  },
  warning: { 
    bg: 'bg-amber-50', 
    text: 'text-amber-700',
    border: 'border-amber-100'
  },
  error: { 
    bg: 'bg-red-50', 
    text: 'text-red-700',
    border: 'border-red-100'
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100'
  }
}

export default function StatusPill({ icon, text, severity = 'info', className }: StatusPillProps) {
  const styles = severityStyles[severity]

  return (
    <div 
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
      role="status"
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{text}</span>
    </div>
  )
}
