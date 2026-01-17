---
name: Animated Background Wave (Homepage Only)
overview: Implement a Canvas-based animated wave background component and integrate it conditionally into the BaseLayout so it only appears on the homepage, preserving the static background for other pages.
todos:
  - id: create-component
    content: Create src/components/BackgroundEffect.astro with canvas animation logic
    status: pending
  - id: update-layout
    content: Update src/layouts/BaseLayout.astro to support conditional background rendering
    status: pending
    dependencies:
      - create-component
  - id: update-index
    content: Enable animated background in src/pages/index.astro
    status: pending
    dependencies:
      - update-layout
---

# Animated Background Wave Plan (Homepage Only)

I will implement a responsive, theme-aware procedural wave animation using HTML5 Canvas. This will replace the static background images **only on the homepage**, while other pages retain the existing static background.

## 1. Create `BackgroundEffect.astro` Component

- **Location**: `src/components/BackgroundEffect.astro`
- **Technology**: HTML5 Canvas + Vanilla JavaScript.
- **Functionality**:
- **Procedural Waves**: Draw multiple overlapping sine waves (simulating the "mesh" look of the current images/video ref) that slowly oscillate.
- **Theme Integration**: Read `--accent-regular`, `--accent-dark`, etc. from CSS variables. Listen for theme changes (light/dark mode) to update colors dynamically.
- **Performance**: Use `requestAnimationFrame` for smooth rendering.
- **Styling**:
- **Positioning**: Fixed to viewport (`z-index: -1`).
- **Fade Effect**: Apply a vertical gradient mask (opacity fade) so it's high contrast at the top and fades out near the bottom/foreground.
- **Responsiveness**: Handle window resize events.

## 2. Update `BaseLayout.astro`

- **Location**: `src/layouts/BaseLayout.astro`
- **Changes**:
- Accept a new optional prop: `useAnimatedBackground` (boolean, default `false`).
- **Conditional Logic**:
- If `useAnimatedBackground` is `true`: Render `<BackgroundEffect />` and disable the default static background image styles on the `.backgrounds` container.
- If `false` (default): Keep the existing behavior (static images).

## 3. Update `index.astro`

- **Location**: `src/pages/index.astro`
- **Changes**:
- Pass `useAnimatedBackground={true}` to the `<BaseLayout>` component to enable the effect on the homepage.

## 4. Verification

- Verify homepage has the animated wave.
- Verify other pages (e.g., About, Work) still have the static background.
- Verify theme toggling updates the animation colors.
- Check performance and "fading" visual requirement.