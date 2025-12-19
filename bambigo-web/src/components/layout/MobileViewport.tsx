import React from 'react'

interface MobileViewportProps {
  children: React.ReactNode
  className?: string
}

/**
 * MobileViewport
 * 
 * Enforces a mobile-first viewport structure.
 * - Handles 100dvh for mobile browsers
 * - Manages safe areas
 * - Prevents scrolling on the body (app-like feel)
 */
export default function MobileViewport({ children, className }: MobileViewportProps) {
  return (
    <div 
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 ${className || ''}`}
      style={{ touchAction: 'none' }} // Prevent browser gestures like pull-to-refresh if needed
    >
      <main className="relative w-full h-full">
        {children}
      </main>
    </div>
  )
}
