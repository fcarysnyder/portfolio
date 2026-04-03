# Tailwind v4 Hybrid Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the portfolio's CSS to a hybrid Tailwind v4 + scoped CSS approach, systematizing spacing, typography tokens, and layout utilities while preserving all existing visual behavior.

**Architecture:** Install Tailwind v4 via the Astro integration. Bridge existing CSS custom properties into Tailwind's `@theme` system so utilities resolve to the project's design tokens. Replace hand-rolled utility classes and component spacing with Tailwind utilities. Keep complex component styles (animations, pseudo-elements, Radix integration) in scoped `<style>` blocks.

**Tech Stack:** Astro 6, Tailwind CSS v4, `@astrojs/tailwind`

---

### Task 1: Install Tailwind v4 and Configure the Astro Integration

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npx astro add tailwindcss
```

This installs `@astrojs/tailwind` and `tailwindcss` v4, and updates `astro.config.mjs` automatically. If it asks to modify files, accept.

Expected: `package.json` gains `@astrojs/tailwind` and `tailwindcss` dependencies. `astro.config.mjs` gains the tailwind integration import.

- [ ] **Step 2: Verify astro.config.mjs has the integration**

`astro.config.mjs` should look like:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://www.fcarysnyder.com',
  integrations: [react(), mdx(), tailwindcss()],
  vite: {
    resolve: {
      noExternal: ['react-tweet'],
    },
    ssr: {
      noExternal: ['react-tweet'],
    },
  },
});
```

If `npx astro add` didn't set it up correctly, manually edit to match.

- [ ] **Step 3: Add `@import "tailwindcss"` to global.css**

At the very top of `src/styles/global.css` (before the `@font-face` declarations), add:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Dev server starts without errors. The site should still render (possibly with visual differences from Tailwind's preflight — that's fine, we'll fix in the next task).

- [ ] **Step 5: Commit**

```bash
git add package.json astro.config.mjs src/styles/global.css package-lock.json
git commit -m "chore: install Tailwind v4 with Astro integration"
```

---

### Task 2: Configure `@theme` Token Bridge and Disable Tailwind Preflight Conflicts

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add `@theme` block after `@import "tailwindcss"`**

In `src/styles/global.css`, immediately after `@import "tailwindcss";`, add:

```css
@theme {
  /* Colors — bridge to existing CSS vars */
  --color-gray-0: var(--gray-0);
  --color-gray-50: var(--gray-50);
  --color-gray-100: var(--gray-100);
  --color-gray-200: var(--gray-200);
  --color-gray-300: var(--gray-300);
  --color-gray-400: var(--gray-400);
  --color-gray-500: var(--gray-500);
  --color-gray-600: var(--gray-600);
  --color-gray-700: var(--gray-700);
  --color-gray-800: var(--gray-800);
  --color-gray-900: var(--gray-900);
  --color-gray-999: var(--gray-999);

  --color-accent-light: var(--accent-light);
  --color-accent: var(--accent-regular);
  --color-accent-dark: var(--accent-dark);
  --color-accent-overlay: var(--accent-overlay);
  --color-accent-overlay-hover: var(--accent-overlay-hover);
  --color-accent-text-over: var(--accent-text-over);
  --color-link: var(--link-color);

  /* Typography — project's actual values, NOT Tailwind defaults */
  --font-size-xs: 0.750rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.625rem;
  --font-size-2xl: 2.125rem;
  --font-size-3xl: 2.625rem;
  --font-size-4xl: 3.5rem;
  --font-size-5xl: 4.5rem;

  /* Font families */
  --font-family-body: 'Aktiv Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  --font-family-brand: 'Aktiv Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  --font-family-mono: 'Roboto Mono', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;

  /* Spacing — 4px base grid */
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  --spacing-15: 3.75rem;
  --spacing-16: 4rem;
  --spacing-20: 5rem;
  --spacing-24: 6rem;
  --spacing-30: 7.5rem;
  --spacing-48: 12rem;

  /* Shadows — use actual values from :root, these swap via theme-dark overrides */
  /* Note: We cannot reference var(--shadow-sm) here as it would be circular.
     Instead, Tailwind will pick up the --shadow-* vars from :root automatically
     since they already use the correct naming convention. Remove this section
     if Tailwind v4 auto-discovers them, or define with inline values if needed.
     Test during Task 1 step 4 — if shadow-sm/md/lg utilities work without
     explicit @theme entries, skip these lines. */

  /* Breakpoint */
  --breakpoint-lg: 60em;
}
```

**Important:** Font sizes in `@theme` use literal values (not `var()` references) because `@theme` defines the canonical Tailwind tokens. The `:root` block still defines the same vars for use in scoped CSS via `var(--font-size-*)`. Colors use `var()` to bridge to `:root` so dark mode theme swapping works.

- [ ] **Step 2: Rename typography CSS vars in `:root` and `:root.theme-dark` blocks**

In the `:root` block, rename the text size variables:

Replace:
```css
--text-xs: 0.750rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-md: 1.125rem;
--text-lg: 1.25rem;
--text-xl: 1.625rem;
--text-2xl: 2.125rem;
--text-3xl: 2.625rem;
--text-4xl: 3.5rem;
--text-5xl: 4.5rem;
```

With:
```css
--font-size-xs: 0.750rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-md: 1.125rem;
--font-size-lg: 1.25rem;
--font-size-xl: 1.625rem;
--font-size-2xl: 2.125rem;
--font-size-3xl: 2.625rem;
--font-size-4xl: 3.5rem;
--font-size-5xl: 4.5rem;
```

And rename font family variables:
```css
--font-system: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
--font-family-body: 'Aktiv Grotesk', var(--font-system);
--font-family-brand: 'Aktiv Grotesk', var(--font-system);
--font-family-mono: 'Roboto Mono', var(--font-system);
```

- [ ] **Step 3: Update all `var(--text-*)` references to `var(--font-size-*)`**

This is a project-wide find-and-replace. Every file that references `var(--text-xs)`, `var(--text-sm)`, etc. needs updating. The affected files are:

- `src/styles/global.css` — h1-h5 selectors, `.nav-items`, `.button`
- `src/components/Hero.astro` — `.hero`, `.title` (lines 28, 34, 72, 88)
- `src/components/AboutHero.astro` — `.title`, `.tagline` (lines 33, 38)
- `src/components/Nav.astro` — `.nav-items`, `.site-title`, `.menu-footer` (lines 138, 157, 203)
- `src/components/PortfolioPreview.astro` — `.card`, `.faux-button` (lines 39, 58)
- `src/components/Footer.astro` — `footer`, `.footer-text` (lines 34, 64)
- `src/pages/index.astro` — `.section-header`, `.header-content` (lines 172, 189)
- `src/pages/about.astro` — `.section-title` (line 136)
- `src/pages/writing/index.astro` — `.section-header`, `h1`, `h3`, `.sort-option`, `.post-list a`, `.post-list time` (lines 98, 104, 109, 127, 145, 177, 189)
- `src/pages/writing/[...slug].astro` — `.back-link`, `.post-header h1`, `.post-header time`, `.post-content` headings, `.post-content p`, `.post-content ul/ol`, `.meta-row`, `.post-nav a` (many lines)

In each file, replace `var(--text-` with `var(--font-size-` everywhere.

Also update all `var(--font-body)` → `var(--font-family-body)`, `var(--font-brand)` → `var(--font-family-brand)`, `var(--font-mono)` → `var(--font-family-mono)`.

- [ ] **Step 4: Verify dev server and visual appearance**

Run:
```bash
npm run dev
```

Check: Homepage, /about, /writing, /work in both light and dark mode. Typography should look identical.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind v4 @theme token bridge, rename CSS vars to Tailwind convention"
```

---

### Task 3: Remove Hand-Rolled Utility Classes from global.css

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Delete `.sr-only` utility class (lines 231-241)**

Delete:
```css
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border-width: 0;
}
```

Tailwind provides `sr-only` as a built-in utility.

- [ ] **Step 2: Replace `.wrapper` with `@utility wrapper`**

Delete the old `.wrapper` block:
```css
.wrapper {
	width: 100%;
	max-width: 83rem;
	margin-inline: auto;
	padding-inline: 1.5rem;
}
```

Add after the `@theme` block:
```css
@utility wrapper {
  width: 100%;
  max-width: 83rem;
  margin-inline: auto;
  padding-inline: 1.5rem;
}
```

This preserves the `.wrapper` class name but registers it as a Tailwind utility.

- [ ] **Step 3: Delete `.stack` utility class (lines 250-253)**

Delete:
```css
.stack {
	display: flex;
	flex-direction: column;
}
```

This will be replaced with `flex flex-col` in markup.

- [ ] **Step 4: Delete all `.gap-*` and `.lg\:gap-*` utility classes (lines 255-305)**

Delete the entire block from `.gap-2` through the closing `}` of the `@media (min-width: 60em)` responsive gap block.

- [ ] **Step 5: Delete the heading font-size rules that duplicate `@theme` values**

The h1-h5 rules in global.css currently set font-sizes. Keep these rules but update them to use the renamed vars:

```css
h1 {
	font-size: var(--font-size-5xl);
}

h2 {
	font-size: var(--font-size-4xl);
}

h3 {
	font-size: var(--font-size-3xl);
}

h4 {
	font-size: var(--font-size-2xl);
}

h5 {
	font-size: var(--font-size-xl);
}
```

Also update the heading shared rule:
```css
h1,
h2,
h3,
h4,
h5 {
	line-height: 1.1;
	font-family: var(--font-family-brand);
	font-weight: 600;
	color: var(--gray-100);
}
```

And the body rule:
```css
body {
	background-color: var(--gray-999);
	color: var(--gray-200);
	font-family: var(--font-family-body);
	-webkit-font-smoothing: antialiased;
	line-height: 1.5;
}
```

- [ ] **Step 6: Verify dev server starts (expect broken layouts — `.stack` class is gone)**

Run:
```bash
npm run dev
```

Expected: Server starts but pages look broken because `.stack` and `.gap-*` classes no longer resolve from global.css. That's fine — we'll fix in the next tasks.

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css
git commit -m "refactor: remove hand-rolled utilities, add @utility wrapper, rename typography vars"
```

---

### Task 4: Migrate BaseLayout.astro

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Replace `stack` classes in markup**

Line 28 — change:
```html
<div class:list={['stack', 'backgrounds', 'use-animated-bg']}>
```
to:
```html
<div class:list={['flex', 'flex-col', 'backgrounds', 'use-animated-bg']}>
```

Line 35 — change:
```html
<div class="stack animated-fade-in main-content-wrapper">
```
to:
```html
<div class="animated-fade-in main-content-wrapper">
```

Note: `.main-content-wrapper` already has `display: flex; flex-direction: column;` in its scoped style, so the `stack` class was redundant here.

- [ ] **Step 2: Verify dev server**

Run `npm run dev` and check that the layout still renders correctly — nav at top, footer at bottom, content in between.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "refactor: migrate BaseLayout to Tailwind flex utilities"
```

---

### Task 5: Migrate Hero.astro

**Files:**
- Modify: `src/components/Hero.astro`

- [ ] **Step 1: Replace utility classes in markup**

Line 13 — change:
```html
<div class:list={['hero stack gap-2', align]}>
```
to:
```html
<div class:list={['hero flex flex-col gap-2', align]}>
```

Line 14 — change:
```html
<div class="stack gap-2">
```
to:
```html
<div class="flex flex-col gap-2">
```

- [ ] **Step 2: Migrate spacing from scoped `<style>` to Tailwind classes**

Line 36 has `.title { margin-bottom: 0.75rem; }`. Change the markup on line 15 from:
```html
{title && <h1 class="title">
```
to:
```html
{title && <h1 class="title mb-3">
```

Then remove `margin-bottom: 0.75rem;` from the `.title` style rule (but keep the rest of the `.title` rule — `max-width`, `font-size`, `color`).

- [ ] **Step 3: Update `var(--text-*)` references in `<style>` block**

Replace all `var(--text-` with `var(--font-size-` in the `<style>` block:
- Line 28: `var(--text-lg)` → `var(--font-size-lg)`
- Line 34: `var(--text-2xl)` → `var(--font-size-2xl)`
- Line 72: `var(--text-2xl)` → `var(--font-size-2xl)`
- Line 88: `var(--text-3xl)` → `var(--font-size-3xl)`

Also update `var(--font-brand)` → `var(--font-family-brand)` if present.

- [ ] **Step 4: Verify**

Run `npm run dev`, check hero on homepage and /work page in both themes.

- [ ] **Step 5: Commit**

```bash
git add src/components/Hero.astro
git commit -m "refactor: migrate Hero.astro to Tailwind utilities"
```

---

### Task 6: Migrate Homepage (index.astro)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace utility classes in markup**

Line 22 — change:
```html
<div class="stack full-height-container gap-20 lg:gap-20">
```
to:
```html
<div class="flex flex-col full-height-container gap-20 lg:gap-20">
```

Line 40 — change:
```html
<main class="wrapper stack gap-20 lg:gap-48">
```
to:
```html
<main class="wrapper flex flex-col gap-20 lg:gap-48">
```

Line 42 — change:
```html
<header class="section-header stack gap-2 lg:gap-4">
```
to:
```html
<header class="section-header flex flex-col gap-2 lg:gap-4">
```

- [ ] **Step 2: Update `var(--text-*)` references in `<style>` block**

Replace all `var(--text-` with `var(--font-size-` in the `<style>` block (lines 64-222).

- [ ] **Step 3: Remove the redundant `.section-header.stack` rule at the bottom**

Delete lines 218-221:
```css
.section-header.stack {
	display: flex;
	flex-direction: column;
}
```

This is no longer needed since we're using `flex flex-col` classes directly.

- [ ] **Step 4: Verify**

Run `npm run dev`, check homepage layout, headshot, selected projects section.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "refactor: migrate homepage to Tailwind utilities"
```

---

### Task 7: Migrate Work Index Page (work/index.astro)

**Files:**
- Modify: `src/pages/work/index.astro`

- [ ] **Step 1: Replace utility classes in markup**

Line 17 — change:
```html
<div class="stack gap-20">
```
to:
```html
<div class="flex flex-col gap-20">
```

Line 18 — change:
```html
<main class="wrapper stack gap-8">
```
to:
```html
<main class="wrapper flex flex-col gap-8">
```

- [ ] **Step 2: Verify**

Run `npm run dev`, check /work page.

- [ ] **Step 3: Commit**

```bash
git add src/pages/work/index.astro
git commit -m "refactor: migrate work index to Tailwind utilities"
```

---

### Task 8: Migrate About Page (about.astro) and AboutHero.astro

**Files:**
- Modify: `src/pages/about.astro`
- Modify: `src/components/AboutHero.astro`

- [ ] **Step 1: Replace `stack` in about.astro markup**

Line 7 — change:
```html
<div class="stack">
```
to:
```html
<div class="flex flex-col">
```

- [ ] **Step 2: Update `var(--text-*)` references in about.astro `<style>`**

Replace all `var(--text-` with `var(--font-size-` in the `<style>` block:
- Line 136: `var(--text-xl)` → `var(--font-size-xl)`
- Line 171: `var(--text-lg)` → `var(--font-size-lg)`

- [ ] **Step 3: Replace utility classes in AboutHero.astro markup**

Line 11 — change:
```html
<div class="wrapper stack gap-2">
```
to:
```html
<div class="wrapper flex flex-col gap-2">
```

- [ ] **Step 4: Update `var(--text-*)` references in AboutHero.astro `<style>`**

Replace:
- Line 33: `var(--text-2xl)` → `var(--font-size-2xl)`
- Line 81: `var(--text-3xl)` → `var(--font-size-3xl)`

- [ ] **Step 5: Verify**

Run `npm run dev`, check /about page — carousel, sections, responsive layout.

- [ ] **Step 6: Commit**

```bash
git add src/pages/about.astro src/components/AboutHero.astro
git commit -m "refactor: migrate about page and AboutHero to Tailwind utilities"
```

---

### Task 9: Migrate Writing Pages

**Files:**
- Modify: `src/pages/writing/index.astro`
- Modify: `src/pages/writing/[...slug].astro`

- [ ] **Step 1: Update `var(--text-*)` references in writing/index.astro `<style>`**

Replace all `var(--text-` with `var(--font-size-` in the `<style>` block. Affected properties:
- `.writing h1` font-size references
- `.section-header` font-size
- `h3` font-size
- `.sort-option` font-size
- `.post-list a` font-size
- `.post-list time` font-size

Also update `var(--font-mono)` → `var(--font-family-mono)` in `.post-list time`.

- [ ] **Step 2: Update `var(--text-*)` references in [...slug].astro `<style>`**

Replace all `var(--text-` with `var(--font-size-` and `var(--font-mono)` with `var(--font-family-mono)` in the `<style>` block. There are many references in the MDX prose styles — update every occurrence.

- [ ] **Step 3: Verify**

Run `npm run dev`, check /writing index and a blog post page. Verify typography, spacing, sort options, prev/next nav.

- [ ] **Step 4: Commit**

```bash
git add src/pages/writing/
git commit -m "refactor: migrate writing pages to renamed typography vars"
```

---

### Task 10: Migrate Footer.astro

**Files:**
- Modify: `src/components/Footer.astro`

- [ ] **Step 1: Update `var(--text-*)` and `var(--font-*)` references in `<style>`**

Replace in the `<style>` block:
- Line 34: `var(--text-sm)` → `var(--font-size-sm)`
- Line 39: `var(--font-mono)` → `var(--font-family-mono)`
- Line 64: `var(--text-sm)` → `var(--font-size-sm)`

- [ ] **Step 2: Verify**

Run `npm run dev`, check footer on any page in both themes.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro
git commit -m "refactor: migrate Footer to renamed typography vars"
```

---

### Task 11: Migrate Nav.astro

**Files:**
- Modify: `src/components/Nav.astro`

- [ ] **Step 1: Update `var(--text-*)` and `var(--font-*)` references in `<style>`**

Replace in the `<style>` block:
- Line 52: `var(--font-brand)` → `var(--font-family-brand)`
- Line 138: `var(--text-md)` → `var(--font-size-md)`
- Line 157: `var(--text-xl)` → `var(--font-size-xl)`
- Line 203: `var(--text-lg)` → `var(--font-size-lg)`

- [ ] **Step 2: Verify**

Run `npm run dev`, check nav dropdown, theme toggle, resume link.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "refactor: migrate Nav to renamed typography vars"
```

---

### Task 12: Migrate PortfolioPreview.astro and Pill.astro

**Files:**
- Modify: `src/components/PortfolioPreview.astro`
- Modify: `src/components/Pill.astro`

- [ ] **Step 1: Update `var(--text-*)` references in PortfolioPreview.astro `<style>`**

Replace:
- Line 39: `var(--text-lg)` → `var(--font-size-lg)`
- Line 58: `var(--text-xs)` → `var(--font-size-xs)`

Also update `var(--font-brand)` → `var(--font-family-brand)` on line 38.

- [ ] **Step 2: Pill.astro — no var renames needed (uses hardcoded `10px` font-size), leave as-is**

- [ ] **Step 3: Verify**

Run `npm run dev`, check portfolio cards on homepage and /work.

- [ ] **Step 4: Commit**

```bash
git add src/components/PortfolioPreview.astro src/components/Pill.astro
git commit -m "refactor: migrate PortfolioPreview to renamed typography vars"
```

---

### Task 13: Migrate Divider.astro

**Files:**
- Modify: `src/components/Divider.astro`

- [ ] **Step 1: Replace spacing with Tailwind classes**

Change the markup from:
```html
<hr class="divider" />
```
to:
```html
<hr class="divider my-5" />
```

Update the `<style>` block — remove the margin properties, keep the border styling:
```css
.divider {
	border: none;
	border-top: 1px solid var(--gray-800);
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`, check dividers on pages that use them.

- [ ] **Step 3: Commit**

```bash
git add src/components/Divider.astro
git commit -m "refactor: migrate Divider spacing to Tailwind"
```

---

### Task 14: Migrate HeroTyper.tsx

**Files:**
- Modify: `src/components/HeroTyper.tsx`

- [ ] **Step 1: Replace `stack gap-2` class references**

Line 57 — change:
```tsx
<div style={ghostStyle} aria-hidden="true" className="stack gap-2">
```
to:
```tsx
<div style={ghostStyle} aria-hidden="true" className="flex flex-col gap-2">
```

Line 74 — change:
```tsx
<div style={activeStyle} className="stack gap-2">
```
to:
```tsx
<div style={activeStyle} className="flex flex-col gap-2">
```

- [ ] **Step 2: Replace `buttonContainerStyle` inline spacing with Tailwind**

Change the `buttonContainerStyle` definition (lines 47-52) from:
```tsx
const buttonContainerStyle: React.CSSProperties = {
    marginTop: '20px',
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap'
};
```
to:
```tsx
const buttonContainerStyle: React.CSSProperties = {
    flexWrap: 'wrap'
};
```

Update the ghost layer div (line 63) from:
```tsx
<div style={buttonContainerStyle}>
```
to:
```tsx
<div style={buttonContainerStyle} className="mt-5 flex gap-4">
```

Update the active layer div (lines 100-105) from:
```tsx
<div style={{
    ...buttonContainerStyle,
    opacity: showButtons ? 1 : 0,
    transition: 'opacity 0.8s ease',
    visibility: step >= 3 ? 'visible' : 'hidden'
}}>
```
to:
```tsx
<div className="mt-5 flex gap-4" style={{
    ...buttonContainerStyle,
    opacity: showButtons ? 1 : 0,
    transition: 'opacity 0.8s ease',
    visibility: step >= 3 ? 'visible' : 'hidden'
}}>
```

- [ ] **Step 3: Verify**

Run `npm run dev`, check homepage hero animation — title types, tagline types, buttons fade in.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroTyper.tsx
git commit -m "refactor: migrate HeroTyper spacing to Tailwind"
```

---

### Task 15: Migrate FooterSocials.tsx

**Files:**
- Modify: `src/components/FooterSocials.tsx`

- [ ] **Step 1: Replace inline spacing styles with Tailwind classes**

In the `renderContent` function (line 40-50), change the container span from:
```tsx
<span
  className="socials-container"
  style={{
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.25rem',
    visibility: isGhost ? 'hidden' : 'visible',
    pointerEvents: isGhost ? 'none' : 'auto'
  }}
>
```
to:
```tsx
<span
  className="socials-container inline-flex flex-wrap items-center gap-1"
  style={{
    visibility: isGhost ? 'hidden' : 'visible',
    pointerEvents: isGhost ? 'none' : 'auto'
  }}
>
```

Line 51 — change `marginRight: '6px'` to Tailwind. Change from:
```tsx
<span className="socials-label" style={{ marginRight: '6px' }}>
```
to:
```tsx
<span className="socials-label mr-2">
```

(Snapping 6px → 8px / `mr-2` to align to the 4px grid.)

Line 71 — change `margin: '0 0.25rem'` to Tailwind. Change from:
```tsx
<span className="separator" style={{ margin: '0 0.25rem', userSelect: 'none' }}>
```
to:
```tsx
<span className="separator mx-1 select-none">
```

- [ ] **Step 2: Verify**

Run `npm run dev`, scroll to footer, check social links animation and spacing.

- [ ] **Step 3: Commit**

```bash
git add src/components/FooterSocials.tsx
git commit -m "refactor: migrate FooterSocials spacing to Tailwind"
```

---

### Task 16: Update global.css NavDropdown and Button Styles

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update `var(--text-*)` and `var(--font-*)` in NavDropdown styles**

In the `.nav-items` rule, replace:
```css
font-size: var(--text-sm);
```
with:
```css
font-size: var(--font-size-sm);
```

- [ ] **Step 2: Verify**

Run `npm run dev`, check nav dropdown opens/closes, links highlight correctly.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "refactor: update global NavDropdown/Button styles to renamed typography vars"
```

---

### Task 17: Full Visual Regression Check and Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build completes with no errors or CSS warnings.

- [ ] **Step 2: Run preview server**

```bash
npm run preview
```

- [ ] **Step 3: Visual check all pages in light mode**

Navigate to each page and verify visual appearance matches pre-migration:
- `/` — homepage with hero, headshot, selected projects
- `/work/` — work index with project cards
- `/about/` — about page with carousel, sections
- `/writing/` — writing index with sort options
- `/writing/[any-post]/` — blog post with MDX content
- `/404` — error page (though may need direct URL entry)

- [ ] **Step 4: Visual check all pages in dark mode**

Toggle theme and repeat the same check for all pages.

- [ ] **Step 5: Check interactive elements**

- Nav dropdown opens/closes
- Theme toggle switches correctly
- Carousel animates and pauses on hover
- Hero text animation plays on homepage
- Footer social links animate
- Sort options work on /writing
- Focus rings visible on tab navigation

- [ ] **Step 6: Final commit if any fixes were needed**

If any visual fixes were required during this step, commit them:
```bash
git add -A
git commit -m "fix: visual regression fixes from Tailwind migration"
```
