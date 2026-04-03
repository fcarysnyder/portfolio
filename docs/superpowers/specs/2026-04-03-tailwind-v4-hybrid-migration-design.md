# Tailwind v4 Hybrid Migration — Design Spec

## Goal

Systematize spacing, typography, and layout across the portfolio using Tailwind CSS v4, while retaining all existing visual behavior and complex component styles. The result should look identical to today but have a consistent, scalable token system underneath.

## Approach: Tailwind v4 with CSS Variable Bridge

Tailwind v4's `@theme` directive generates utility classes from CSS-based config. We bridge it to the existing `:root` / `:root.theme-dark` custom properties so that:

- Tailwind utilities resolve to CSS vars → dark mode works automatically via the existing `.theme-dark` class swap
- No Tailwind `dark:` prefix needed
- Single source of truth for design tokens (the CSS vars)

## Token Mapping

### Colors

Existing CSS vars map into `@theme` with the `--color-` prefix:

| CSS Variable | `@theme` Variable | Utility Examples |
|---|---|---|
| `--gray-0` | `--color-gray-0` | `bg-gray-0`, `text-gray-0` |
| `--gray-50` through `--gray-999` | `--color-gray-50` through `--color-gray-999` | `bg-gray-900`, `text-gray-200` |
| `--accent-light` | `--color-accent-light` | `bg-accent-light` |
| `--accent-regular` | `--color-accent` | `bg-accent`, `text-accent` |
| `--accent-dark` | `--color-accent-dark` | `text-accent-dark` |
| `--accent-overlay` | `--color-accent-overlay` | `bg-accent-overlay` |
| `--accent-overlay-hover` | `--color-accent-overlay-hover` | `bg-accent-overlay-hover` |
| `--link-color` | `--color-link` | `text-link` |

### Typography

Font sizes keep the existing values, renamed to Tailwind's `--font-size-*` convention:

| Current Variable | Value | `@theme` Variable | Utility |
|---|---|---|---|
| `--text-xs` | `0.750rem` | `--font-size-xs` | `text-xs` |
| `--text-sm` | `0.875rem` | `--font-size-sm` | `text-sm` |
| `--text-base` | `1rem` | `--font-size-base` | `text-base` |
| `--text-md` | `1.125rem` | `--font-size-md` | `text-md` |
| `--text-lg` | `1.25rem` | `--font-size-lg` | `text-lg` |
| `--text-xl` | `1.625rem` | `--font-size-xl` | `text-xl` |
| `--text-2xl` | `2.125rem` | `--font-size-2xl` | `text-2xl` |
| `--text-3xl` | `2.625rem` | `--font-size-3xl` | `text-3xl` |
| `--text-4xl` | `3.5rem` | `--font-size-4xl` | `text-4xl` |
| `--text-5xl` | `4.5rem` | `--font-size-5xl` | `text-5xl` |

These are **not** Tailwind defaults — they are the project's existing values.

Font families:

| Current Variable | `@theme` Variable | Utility |
|---|---|---|
| `--font-body` | `--font-family-body` | `font-body` |
| `--font-brand` | `--font-family-brand` | `font-brand` |
| `--font-mono` | `--font-family-mono` | `font-mono` |

### Spacing (4px base grid)

The existing gap utilities already mostly align to a 4px grid. The `@theme` spacing scale formalizes this and fills gaps:

| `@theme` Variable | Value | px | Notes |
|---|---|---|---|
| `--spacing-0` | `0` | 0 | |
| `--spacing-1` | `0.25rem` | 4 | New |
| `--spacing-2` | `0.5rem` | 8 | Matches existing `.gap-2` |
| `--spacing-3` | `0.75rem` | 12 | New |
| `--spacing-4` | `1rem` | 16 | Matches existing `.gap-4` |
| `--spacing-5` | `1.25rem` | 20 | New |
| `--spacing-6` | `1.5rem` | 24 | New (matches `.wrapper` padding) |
| `--spacing-8` | `2rem` | 32 | Matches existing `.gap-8` |
| `--spacing-10` | `2.5rem` | 40 | Matches existing `.gap-10` |
| `--spacing-12` | `3rem` | 48 | New |
| `--spacing-15` | `3.75rem` | 60 | Matches existing `.gap-15` |
| `--spacing-16` | `4rem` | 64 | New |
| `--spacing-20` | `5rem` | 80 | Matches existing `.gap-20` |
| `--spacing-24` | `6rem` | 96 | New |
| `--spacing-30` | `7.5rem` | 120 | Matches existing `.gap-30` |
| `--spacing-48` | `12rem` | 192 | Matches existing `.gap-48` |

### Shadows

| Current Variable | `@theme` Variable | Utility |
|---|---|---|
| `--shadow-sm` | `--shadow-sm` | `shadow-sm` |
| `--shadow-md` | `--shadow-md` | `shadow-md` |
| `--shadow-lg` | `--shadow-lg` | `shadow-lg` |

Note: The `@theme` shadow entries register the shadow names in Tailwind's namespace. The actual values come from the `:root` CSS vars (which swap in dark mode), so the `@theme` block uses `var(--shadow-sm)` etc.

### Breakpoint

| `@theme` Variable | Value | Utility Prefix |
|---|---|---|
| `--breakpoint-lg` | `60em` | `lg:` |

## What Gets Migrated

### Replaced by Tailwind utilities

These are **deleted** from global.css and replaced with Tailwind classes in markup:

| Current | Replacement |
|---|---|
| `.gap-2` through `.gap-48` (and `lg:` variants) | Tailwind `gap-2` through `gap-48` / `lg:gap-*` |
| `.stack` | `flex flex-col` |
| `.sr-only` | Tailwind built-in `sr-only` |
| `.wrapper` | Custom `@utility wrapper` (see below) |

The `.wrapper` utility is reused across many templates so we define it once as a Tailwind `@utility`:

```css
@utility wrapper {
  width: 100%;
  max-width: 83rem;
  margin-inline: auto;
  padding-inline: 1.5rem;
}
```

### Component spacing moved to Tailwind classes

For each component, spacing properties (padding, margin, gap) in `<style>` blocks and inline React styles are replaced with Tailwind utility classes in the markup. The scoped `<style>` block is kept for non-spacing styles; if it becomes empty, it's deleted.

Examples of what changes:

- `Hero.astro`: `.title { margin-bottom: 0.75rem }` → `class="mb-3"` on the element
- `AboutHero.astro`: `.about-hero { gap: 2rem; padding-bottom: 3rem }` → `class="gap-8 pb-12"`
- `Footer.astro`: `footer { padding: 2.5rem 1.5rem }` → `class="py-10 px-6"`
- `HeroTyper.tsx`: `style={{ marginTop: '20px', gap: '1rem' }}` → `className="mt-5 gap-4"`
- `FooterSocials.tsx`: `style={{ marginRight: '6px' }}` → snapped to `className="mr-2"` (8px)

### Kept as scoped CSS (not migrated)

- **All animations**: carousel, ScrambleText cursor, Three.js canvas, Nav fade-in, theme toggle transitions
- **All pseudo-elements**: `::before` / `::after` decorative borders, button effects, grid nth-child selectors
- **Radix UI integration**: `.menu-button`, `.menu-content`, `.link` with `[data-state]`, `[data-highlighted]`, `[aria-current]` attribute selectors
- **Button component** (`.button`, `.button.secondary`): complex hover states, pseudo-elements
- **BackgroundEffect.astro**: entire debug panel
- **Photography page**: 10px gaps stay hardcoded
- **ThemeToggle.astro**: web component styles
- **Grid.astro**: `:global(> :nth-child())` selectors
- **Blog post page** (`[...slug].astro`): MDX content typography styles (prose-like styling for rendered markdown)
- **Complex hover effects**: card overlays, gradient strokes in PortfolioPreview

## Global CSS Retained Rules

These stay in `global.css` unchanged (except variable name updates where referenced):

- `@font-face` declarations (Aktiv Grotesk 400/500/600/700)
- `:root` and `:root.theme-dark` custom property blocks
- `html, body` base styles
- `*, *::after, *::before` box-sizing reset
- `img` max-width reset
- `a` link color
- `*:focus-visible` and interactive element focus ring styles
- `h1`–`h5` element styles (sizes, line-height 1.1, font-weight 600, color, font-family)
- `body` typography (font-family, line-height 1.5, color, font-smoothing)
- NavDropdown / Radix styles (`.menu-button` through `.link[aria-current]`)
- `.button` / `.button.secondary` styles
- `html body[data-scroll-locked]` fix

The h1–h5 rules update their `font-size` references from `var(--text-*)` to `var(--font-size-*)` to match the renamed tokens. Values don't change.

## File Changes Summary

| File | Change |
|---|---|
| `package.json` | Add `@astrojs/tailwind`, `tailwindcss` |
| `astro.config.mjs` | Add Tailwind integration |
| `src/styles/global.css` | Add `@import "tailwindcss"`, `@theme` block, `@utility wrapper`. Delete `.gap-*`, `.lg:gap-*`, `.stack`, `.sr-only`, `.wrapper`. Rename `--text-*` → `--font-size-*` and `--font-*` → `--font-family-*` in `:root` blocks. Update h1–h5 refs. |
| `src/components/Hero.astro` | Spacing props → Tailwind classes. Keep animation/pseudo CSS. |
| `src/components/AboutHero.astro` | Spacing props → Tailwind classes. Keep carousel CSS. |
| `src/components/Footer.astro` | Spacing props → Tailwind classes. Keep `:global()` styles. |
| `src/components/PortfolioPreview.astro` | Spacing props → Tailwind classes. Keep hover/pseudo CSS. |
| `src/components/Divider.astro` | Spacing → Tailwind. May delete `<style>` entirely. |
| `src/components/Nav.astro` | Spacing → Tailwind where simple. Keep complex responsive/Radix styles. |
| `src/components/Grid.astro` | Evaluate case-by-case. Keep `:global()` nth-child selectors. |
| `src/components/Pill.astro` | Minimal — maybe just font-size. |
| `src/components/HeroTyper.tsx` | Inline styles → Tailwind `className`. |
| `src/components/FooterTyper.tsx` | Inline styles → Tailwind `className`. |
| `src/components/FooterSocials.tsx` | Inline styles → Tailwind `className`. Snap 6px to grid. |
| `src/components/ScrambleText.tsx` | Keep inline styles (cursor animation). |
| `src/pages/index.astro` | `.gap-*` / `.stack` class refs → Tailwind equivalents. |
| `src/pages/about.astro` | Spacing → Tailwind. Keep complex cursor/carousel CSS. |
| `src/pages/work/index.astro` | `.gap-*` / `.stack` refs → Tailwind. |
| `src/pages/writing/index.astro` | Spacing → Tailwind. Keep sort UI styles. |
| `src/pages/writing/[...slug].astro` | Spacing → Tailwind. Keep MDX prose styles. |
| `src/layouts/BaseLayout.astro` | Spacing → Tailwind. Keep animation/background CSS. |
| `src/components/BackgroundEffect.astro` | **No changes.** |
| `src/components/ThemeToggle.astro` | **No changes.** |
| `src/components/NavDropdown.tsx` | **No changes** (uses global Radix classes). |
| `src/components/Tweet.tsx` | **No changes.** |
| Photography page(s) | **No changes** to 10px gaps. |

## Success Criteria

1. Site looks visually identical before and after migration (manual comparison of all pages in light + dark mode)
2. All hand-rolled gap/stack/sr-only/wrapper utilities deleted from global.css
3. Spacing across all components uses Tailwind classes on a consistent 4px grid
4. Typography values preserved exactly — no Tailwind defaults leaking in
5. Dark/light theme switching works unchanged
6. No regressions in animations, hover effects, or accessibility (focus rings, screen reader support)
7. Build succeeds with no CSS warnings
