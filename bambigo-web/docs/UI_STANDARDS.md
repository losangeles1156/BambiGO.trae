# BambiGO UI Consistency & Version Control Standards

## 1. Overview
This document defines the standards for UI development, version control, and consistency checks to prevent residual design elements (e.g., "捷運101") from appearing in production.

## 2. Localization (i18n)
- **Mandatory**: All user-facing strings MUST be defined in `src/i18n/locales/*.ts`.
- **Prohibited**: Hardcoded strings in TSX files are strictly forbidden.
- **Dynamic Content**: Use the `useLanguage` hook and `t()` function for all labels.
- **Fallbacks**: Always provide a default locale (zh-TW) and handle missing keys gracefully.

## 3. Component Standards
- **Standardized Buttons**: All interactive buttons must have a minimum hit area of **48dp x 48dp** (ISO 7000 compliant).
- **Icons**: Use `lucide-react` for standard UI icons.
- **Design Tokens**: Use `src/lib/designTokens.ts` for colors and spacing.

## 4. Environment Isolation
- **Mock vs. Production**: Use `process.env.NEXT_PUBLIC_APP_ENV` to switch between mock data and real API integrations.
- **Design Specifications**: Production builds must use the final approved design assets only.
- **Feature Flags**: New UI features should be hidden behind feature flags until fully validated.

## 5. UI Version Control Process
1. **Design Approval**: All UI changes must match the approved Figma/Design file.
2. **Review**: PRs must include screenshots/videos demonstrating UI consistency.
3. **Automated Checks**:
   - `npm run lint` to check for code style.
   - `npx playwright test tests/ui_consistency.spec.ts` to verify critical UI elements.
4. **Residue Cleanup**: Before every release, run `grep -r "捷運101" .` (or other known residue patterns) to ensure no legacy data remains.

## 6. Automated Testing
- **Visual Regression**: Use Playwright to capture screenshots and compare against baselines.
- **Text Validation**: Verify that the correct station names (e.g., "上野", "東京") are rendered in all supported languages.
- **Interaction Tests**: Ensure buttons and search bars function as expected across devices.

## 7. Map Layers & Node Icons
- **Map Style Presets**: Use the in-app layer picker to switch between 3 approved basemap presets (Voyager Warm / Positron Clean / Muted Light).
- **Viewport Stability**: Switching map styles must preserve `center` and `zoom` and keep node marker positions stable (target: ≤ 5px perceived shift).
- **Node Icon System**:
  - Station: Blue rounded-square marker with white glyph.
  - Bus Stop: Emerald rounded-square marker with white glyph.
  - POI: Violet rounded-square marker with white glyph.
- **Important Node Highlight**: The currently selected node uses a pulse halo to improve recognition.
