# BambiGO Tagging System UI/UX Specifications

## 1. Design Philosophy
The Four-Layer Tagging System requires a visual language that distinguishes between **Static/Structural Data** (L1), **Aggregated Data** (L2), **Functional Data** (L3), and **Actionable Insights** (L4).

### Color Coding (Semantic)
- **L1 Life Function (Gene):** `Blue-500` to `Indigo-600`. Represents structure, stability, and categorization.
- **L2 Spatial Aggregation (Atmosphere):** `Violet-500` to `Purple-600`. Represents areas, heatmaps, and density.
- **L3 Service Facilities (Utility):** `Emerald-500` to `Teal-600`. Represents amenities, helpfulness, and "green light" to proceed.
- **L4 Mobility Strategy (Action):** `Rose-500` to `Orange-500`. Represents human-centric advice, urgency, and warm suggestions.

## 2. Component Architecture

### 2.1 Visual Hierarchy (TagChip)
Each layer uses a distinct visual style for its tags:

| Layer | Style | Border | Background | Text | Icon |
|-------|-------|--------|------------|------|------|
| **L1** | Outlined | `border-blue-200` | `bg-blue-50` | `text-blue-700` | Category Icon |
| **L2** | Soft Fill | None | `bg-violet-100` | `text-violet-800` | Heatmap/Area Icon |
| **L3** | Pill/Capsule | `border-emerald-200` | `bg-emerald-50` | `text-emerald-700` | Facility Icon (e.g., Wifi) |
| **L4** | Gradient | None | `bg-gradient-to-r from-rose-50 to-orange-50` | `text-rose-700` | Sparkle/AI Icon |

### 2.2 Hierarchical Selector (L1)
- **Pattern:** Cascading Menu or Tree View.
- **Interaction:**
    1. Select Main Category (e.g., Medical) -> Triggers slide-in or expansion of Sub-categories.
    2. Select Sub Category (e.g., Clinic) -> Reveals Detail Categories.
    3. Final selection is added as a "Chip" to the active filter area.
- **Feedback:** Breadcrumb visualization `Medical > Clinic > Dental`.

### 2.3 Facility Attribute Editor (L3)
- **Pattern:** Dynamic Form Card.
- **Structure:**
    - Header: Facility Type (e.g., Toilet).
    - Body: Dynamic Key-Value pairs based on schema (e.g., `accessible: boolean`, `payment: array`).
    - Footer: "Verified" status toggle.

### 2.4 L4 Action Card (Strategy)
- **Pattern:** Actionable Insight Card.
- **Structure:**
    - **Header:** Icon (Contextual) + Title (e.g., "Family Easy Access").
    - **Body:** Description text (e.g., "Baby care and accessible facilities available.").
    - **Rationale:** Small text explaining *why* this card appeared (e.g., "Detected via Persona").
    - **Action Area:** Primary button (e.g., "View Family Facilities").
- **Variants:**
    - **Family Easy Access:** Pink/Rose gradient. Icon: Stroller/Family.
    - **Night Safety Tips:** Indigo/Dark gradient. Icon: Moon/Shield.
    - **Beat the Heat:** Orange/Red gradient. Icon: Sun/Water Drop.
    - **Time to Eat:** Dynamic time badge. Icon: Utensils.

### 2.5 Persona Badge (L2)
- **Pattern:** User Context Indicator.
- **Visual:**
    - Small, pill-shaped badge appearing near the Node Title.
    - **Style:** `bg-purple-100` text `purple-700` border `purple-200`.
    - **Examples:** "Family Friendly", "Maze Node", "Digital Nomad Ready".

## 3. Interaction Flows

### 3.1 Adding a New Tag (L1)
1. User clicks "+ Add Tag".
2. Popover opens with Level 1 Categories (Grid View).
3. User clicks "Dining".
4. View transitions to "Dining" sub-categories (List View).
5. User clicks "Ramen".
6. Tag is applied.

### 3.2 Filtering by Multiple Layers
1. **L1 Filter:** "Show me `Shopping` + `Drugstore`".
2. **L3 Refinement:** "...that has `Tax Free` service".
3. **Result:** Map updates to show nodes matching BOTH structural type AND service capability.

## 4. Responsive Behavior
- **Desktop:** Split pane. Left: Tag Management Tree. Right: Detail/Map View.
- **Mobile:** Bottom Sheet for Tag Selection. Horizontal scrolling chips for active filters.

## 5. Accessibility (A11y)
- **Contrast:** All text colors must pass WCAG AA against their backgrounds.
- **Keyboard:** Hierarchical trees must be navigable via Arrow Keys.
- **ARIA:**
    - `aria-expanded` for category expansion.
    - `aria-selected` for active tags.
    - `role="tree"` for the hierarchy view.
