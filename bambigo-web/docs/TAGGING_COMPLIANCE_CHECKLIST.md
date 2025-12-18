# BambiGO Tagging System Compliance Checklist
> For Frontend & UI Agents

## 📱 Mobile First (Mandatory)
- [ ] **Viewport**: Ensure `viewport` is set to `width=device-width, initial-scale=1, maximum-scale=1` (Fixed in `layout.tsx`).
- [ ] **Touch Targets**: All clickable elements must be at least 44x44px.
- [ ] **Overflow**: Use `overflow-auto` for scrollable lists; avoid body scroll locking unless necessary.
- [ ] **Inputs**: Input fields font size should be >= 16px to prevent iOS zoom.

## 🏷️ Tagging System (L1-L4)
- [ ] **Types**: MUST import types from `@/types/tagging.ts`. Do NOT define loose types like `type Facility = { name: string }`.
- [ ] **L1 Categories**: Use `L1Category` enum ('medical', 'shopping', etc.).
- [ ] **L3 Facilities**:
    - [ ] Handle `attributes` dynamic object (e.g., check `requires_purchase` for charging).
    - [ ] Display `openingHours` if available.
    - [ ] Use `subCategory` for specific icon selection.
- [ ] **Validation**: Use `validateL3Facility(data)` from `@/lib/validators/tagging` when receiving API data.

## 🧪 Testing
- [ ] Run `npm test tests/tagging_compliance.spec.ts` before pushing.
- [ ] Ensure no regressions in `scripts/check_mobile_readiness.ts`.

## 🚨 Monitoring
- **CI/CD**: The `tagging_compliance` test suite is now part of the build pipeline.
- **Reporting**: Non-compliant API responses will be flagged in the test logs.
