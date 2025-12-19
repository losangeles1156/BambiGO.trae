'use client'

import React, { useState, useRef } from 'react'

interface LongPressButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onLongPress: () => void
  onShortPress: () => void
  duration?: number
}

export function LongPressButton({ 
  onLongPress, 
  onShortPress, 
  duration = 500, 
  children, 
  ...props 
}: LongPressButtonProps) {
  const [pressing, setPressing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)

  const startPress = () => {
    isLongPress.current = false
    setPressing(true)
    timerRef.current = setTimeout(() => {
      isLongPress.current = true
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50) // Stronger feedback for long press
      }
      onLongPress()
    }, duration)
  }

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (pressing && !isLongPress.current) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10) // Light tap
      }
      onShortPress()
    }
    setPressing(false)
  }

  return (
    <button
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      {...props}
    >
      {children}
    </button>
  )
}
