# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-12-19

### Added
- **UI Version Control**: Established `docs/UI_STANDARDS.md` to define consistency rules and hit area requirements.
- **Automated UI Testing**: Added `e2e/ui_consistency.spec.ts` for residue check and hit area validation.
- **WebSocket AI Integration**: Upgraded AI Control to real WebSocket bidirectional communication with exponential backoff in `AIClient.ts`.
- **Map Fallback System**: Implemented 3-tier fallback styles in `MapCanvas.tsx` for enhanced stability.
- **Internationalization (i18n)**:
  - Expanded dictionary for Japanese (`ja.ts`), English (`en.ts`), and Traditional Chinese (`zh-TW.ts`).
  - Added `test/i18n.test.ts` for automated locale coverage verification.
- **Test Reports**: Added detailed stability and test reports for today's work in `docs/`.

### Changed
- **UI Standardization**: All interactive buttons now strictly follow the **48dp x 48dp** hit area standard (ISO 7000).
- **Header Refactoring**: Replaced legacy hardcoded location strings with dynamic `locationName` support.
- **NodeDashboard Optimization**: Implemented `AbortController` to prevent duplicate API calls and race conditions.
- **TaskMode UI**: Improved z-index and interaction layering to prevent freezing and ensure button responsiveness.
- **Next.js HMR**: Simplified configuration in `next.config.ts` to resolve full-reload issues during development.
- **Map Labels**: Standardized multilingual labels for "Ueno", "Tokyo Station", etc.

### Fixed
- **UI Residue**: Completely removed all "捷運101" and "世貿站" references from the codebase.
- **TaskMode Responsiveness**: Fixed z-index conflict that caused buttons to be unclickable.
- **API Error Handling**: Added retry logic and fail-safes for `Assistant`, `Facilities`, and `Weather` routes.
- **i18n Mixed State**: Fixed issues where some UI components displayed mixed languages after switching.
- **HMR Performance**: Resolved the issue causing the dev server to trigger full page reloads instead of HMR.

### Removed
- Legacy "CityAIAssistant" component in favor of the new `FullScreenAssistant`.
- Hardcoded weather values in the Header.
- Outdated "信義商圈" references in translation files.
