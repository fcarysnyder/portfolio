---
name: Homepage Redesign and Work Page
overview: Refactor homepage to full-screen hero, swap button hierarchy, and create a dedicated "Selected Work" page.
todos:
  - id: create-work-page
    content: Create src/pages/work/index.astro
    status: pending
  - id: update-nav
    content: Update src/components/Nav.astro with new link
    status: pending
    dependencies:
      - create-work-page
  - id: update-styles
    content: Add secondary button styles to src/components/Hero.astro
    status: pending
  - id: update-hero-typer
    content: Update src/components/HeroTyper.tsx with new button hierarchy and icons
    status: pending
    dependencies:
      - update-styles
  - id: refactor-home
    content: Refactor src/pages/index.astro to remove gallery and fix height
    status: pending
    dependencies:
      - create-work-page
---

# Homepage Redesign & Selected Work Page

We will transform the homepage into a focused, single-screen experience with a full-height hero, swap the call-to-action buttons, and move the project gallery to a new dedicated page.

## 1. Create New "Selected Work" Page

**File:** `src/pages/work/index.astro` (New File)

- **Layout:** Use `BaseLayout` (ensures `BackgroundEffect` continuity/persistence via `transition:persist`).
- **Header:** Simple "Selected Work" title (styled like the About page header).
- **Content:** Fetch projects using `getCollection('work')` and display them using `Grid` and `PortfolioPreview`, exactly as they were on the homepage.

## 2. Update Navigation

**File:** [`src/components/Nav.astro`](src/components/Nav.astro)

- Add "Selected Work" to the `textLinks` array.
- Path: `/work/`.
- Position: Between "Home" and "About".

## 3. Update Global Styles for Secondary Button

**File:** [`src/components/Hero.astro`](src/components/Hero.astro)

- Add CSS for a `.button.secondary` (transparent) variant:
- Background: Transparent.
- Border: 1px solid `var(--accent-regular)` (or similar visual weight).
- Text Color: `var(--accent-regular)`.
- Hover: `var(--accent-overlay-hover)` background.

## 4. Update Hero Component & Buttons

**File:** [`src/components/HeroTyper.tsx`](src/components/HeroTyper.tsx)

- **Button Swap:**
- **Primary Button (Solid):** Text "See selected work" -> Links to `/work`. Icon: Arrow Right (existing).
- **Secondary Button (Transparent):** Text "Drop me a line" -> Links to `mailto:...`. Icon: Email/Envelope (will add SVG or import from `phosphor-react`).
- **Layout:** Wrap buttons in a flex container to display them side-by-side.
- **Animation:** Ensure both buttons appear together in the "modal" state after typing completes.

## 5. Refactor Homepage

**File:** [`src/pages/index.astro`](src/pages/index.astro)

- **Remove:** The "Selected Projects" section (wrapper, header, and gallery).
- **Layout:** Ensure the `Hero` section expands to fill the viewport height.
- Apply `min-height: 100vh` (minus header/footer height) or use flexbox expansion to make it full screen.

## 6. Verification

- Verify the homepage is a full-screen hero.
- Verify the particle background persists correctly.
- Verify "Selected Work" button is primary and leads to the new page.
- Verify "Drop me a line" button is secondary/transparent.
- Verify the new `/work` page loads with the project grid.