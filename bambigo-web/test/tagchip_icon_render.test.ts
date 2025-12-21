import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Building2 } from 'lucide-react'
import TagChip from '../src/components/ui/TagChip'
import { LanguageProvider } from '../src/contexts/LanguageContext'

describe('TagChip', () => {
  it('renders lucide-react icon without crashing', () => {
    expect(() => {
      const html = renderToStaticMarkup(
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(TagChip, { label: 'Test', layer: 'L1', icon: Building2 })
        )
      )
      expect(html).toContain('svg')
    }).not.toThrow()
  })
})
