# Tailwind Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every `!important` and every styling inline style, and move component and page styling to Tailwind utilities as far as is reasonable, without changing how any page looks. Whatever CSS remains outside Tailwind's layers is documented, with the reason it has to be unlayered.

**Architecture:** Styling moves from Astro scoped `<style>` blocks, React `style={{…}}` objects and injected `<style>` tags into Tailwind utility classes in the markup. The design tokens (`:root` variables) and the shared systems (`type.css` roles, `prose.css`) stay as CSS. A guard test enforces the result.

**Tech Stack:** Astro 6, Tailwind CSS v4, React 19, Radix DropdownMenu, Vitest.

**Spec:** the owner's request (2026-10-20): "yeet all !important and inline style if possible. I want tailwind as much as is possible, with the unlayered CSS explained", plus "keep swiss.css working alongside it". The owner already approved the visual design in `docs/superpowers/specs/2026-10-18-reading-typography-design.md`, which must not change.

## Global Constraints

- **No visual change.** After each task the controller re-runs a computed-style snapshot of 9 pages × 2 widths (375, 1400) × 2 themes, with Swiss off and with Swiss on, against the baselines. Expect zero differences, apart from the About page's moving photo carousel. Hover, focus, active and open states aren't in the snapshot, so preserve them with the matching Tailwind variants.
- **No `!important` anywhere in `src/`.**
- **Inline `style` only sets CSS custom properties from data**, e.g. `style={{ '--aspect': aspect }}` or ``style={`--pill-color: ${color}`}``, with a Tailwind class consuming the variable (`aspect-(--aspect)`, `bg-(--pill-color)`). No other inline declarations, and no `<style>` tags rendered from React.
- **Use Tailwind utilities and the project tokens:**
  - Colors: `text-gray-200`, `bg-gray-999`, `border-gray-800`, `text-accent-text`, `bg-accent-fill`, `text-on-accent`, `text-brand`, `bg-accent-overlay-hover`. If a token is missing from `@theme`, add it: `--color-accent-text-hover`, `--color-accent-fill-hover`.
  - Type: `text-xs`…`text-5xl`, `font-sans` / `font-mono`, and the existing `.t-*` role classes.
  - Shadows: `shadow-sm` / `shadow-md` / `shadow-lg`. These resolve to the site's `--shadow-*`, so confirm with the snapshot.
- **Preserve exact values.** Use scale utilities when they equal the current value (`p-10` = 2.5rem). Otherwise use an arbitrary value for that one property (`rounded-[20px]`, `gap-[10px]`). Never round a value to a nearby step.
- **Breakpoints.**
  - `lg:` is 60em (min-width) and `max-lg:` is below 60em.
  - One-offs use arbitrary variants: `min-[50em]:` (Nav), `min-[64em]:` (Footer's 1024px), `min-[70em]:` (PortfolioPreview card).
  - Don't redefine Tailwind's named `sm`/`md`/`xl` breakpoints.
- **Keep hook classes.** These classes are used by `src/styles/swiss.css`, by scripts, or by tests, so they stay on their elements even when their CSS moves into utilities: `post-layout`, `page-header`, `back-link`, `summary`, `meta-line`, `post-list`, `post-content`, `gated-content`, `gated-placeholder`, `prose`, `card`, `button`, `pill`, `lock-pill`, `menu-content`, `menu-button`, `reader-content`, `filter-option`, `filter-dot`, `carousel-container`, `carousel-track`, `carousel-trigger`, `carousel-badge`, `company-link`, `social-link`, `title`, `tagline`, `headshot`, `theme-toggle`, plus any class a `<script>`, `.tsx` or test file queries. Before removing any class, grep `src/` and `tests/` for it.
- **Stays as CSS** (document why in Task E):
  - the `@theme` and `:root` / `:root.theme-dark` tokens;
  - `@layer base` element defaults;
  - `type.css` roles and `prose.css`, which style CMS and decrypted HTML Tailwind can't reach;
  - `swiss.css`, which must stay unlayered to override;
  - `@keyframes` (register them as `--animate-*` in `@theme` so the `animate-*` utilities work);
  - the About page's emoji cursor data URIs.
- **Unlayered scoped CSS beats utilities.** When converting an element, delete all of its scoped rules, or its new utilities won't apply.
- **Write complete class strings.** Tailwind only sees classes written out in full in source, so don't build class names by concatenating strings.
- `npx vitest run tests` and `npx astro build` must pass after every task. Don't commit `.astro/content-modules.mjs`.

## Review Focus

1. **Hover, focus-visible, active, `aria-current` and Radix `data-state` / `data-highlighted` states** on the nav dropdown, buttons, links, filters, theme toggle and Aa panel. These are the parts the snapshot can't see. Check each in the browser.
2. **Styles for markup a component doesn't render itself:** slotted content, React islands inside Astro, and decrypted case-study HTML. Use `[&_selector]:` variants or keep a documented rule; don't silently drop them.
3. **Lightboxes (PhotoModal, CaseStudyCarousel) and the PasswordModal** open state and keyboard behavior: Escape closes, arrows navigate, focus is visible. Open each one in the browser.
4. **Swiss mode** (`localStorage['dev-swiss']='1'` in dev) must still produce the same result. The controller compares against the Swiss-on baseline.
5. **Dark mode** colors on every converted element. The snapshot covers both themes.

---

### Task A: Global CSS, nav dropdown, footer and debug panel: remove every `!important`

**Files:** `src/styles/global.css`, `src/components/NavDropdown.tsx`, `src/components/Nav.astro`, `src/components/Footer.astro`, `src/components/FooterSocials.tsx`, `src/components/FooterTyper.tsx`, `src/components/BackgroundEffect.astro`, `src/components/ReaderSettings.tsx`

- [ ] Move the nav dropdown's global rules (`.menu-button`, `.menu-content`, `.nav-items`, `.link`, all states) out of `global.css` and into Tailwind classes in `NavDropdown.tsx`. Use `data-[state=open]:`, `data-[highlighted]:`, `aria-[current]:`, `hover:` and `focus-visible:`.
- [ ] Delete the dead dropdown and socials rules in `Nav.astro`'s `<style>` (they target markup that NavDropdown renders, which Astro scoping can't reach), and convert Nav's live rules to utilities.
- [ ] Delete the dead `[data-theme='light'] .menu-button[data-state='open']` rule.
- [ ] Set `modal={false}` on the Radix `DropdownMenu.Root` in `NavDropdown.tsx` and `ReaderSettings.tsx`. That removes Radix's scroll lock, so delete `html body[data-scroll-locked] { margin-right: 0px !important }`. This is the owner-visible behavior change: the page can scroll while a menu is open.
- [ ] Turn `.button` and `.button.secondary` into Tailwind classes where they're used (Hero, and anywhere else `class="button"` appears). Keep the `button` / `secondary` hook classes and drop every `!important`.
- [ ] Rewrite `Footer.astro`'s styles as utilities with no `!important` (7 today). Its desktop row layout is at `min-[64em]:`. The links inside the React `FooterSocials` get their classes in the `.tsx`, not through `:global`.
- [ ] Convert `FooterSocials.tsx` and `FooterTyper.tsx` inline styles to utilities.
- [ ] `BackgroundEffect.astro`'s debug panel: the panel's `display: block !important` and `.hidden { display: none !important }` fight Tailwind's `.hidden` utility. Convert the panel to utilities, toggle visibility with a non-conflicting mechanism (the `hidden` attribute, or Tailwind's own `hidden` class with no custom rule), and drop both `!important`s. Keep the debug controls working; that easter egg must not be deleted.
- [ ] **Done when:** `grep -rn "!important" src` returns nothing. Tests and build pass. The controller's snapshot shows zero differences. In the browser: the nav dropdown opens, hover and highlight work, the current page is bold and red, Escape closes it, and the page scrolls while it's open.

### Task B: React components: inline styles and injected `<style>` to utilities

**Files:** `src/components/work/PasswordModal.tsx`, `src/components/work/GatedContent.tsx`, `src/components/work/CaseStudyCarousel.tsx`, `src/components/photography/PhotoModal.tsx`, `src/components/photography/PhotoGallery.tsx`, `src/components/ScrambleText.tsx`; delete `src/components/HeroTyper.tsx` (unused; confirm nothing imports it).

- [ ] Replace every `style={{…}}` with `className` utilities. Dynamic values become CSS variables, e.g. PhotoGallery's per-photo flex and aspect: `style={{ '--aspect': aspect } as React.CSSProperties}` with `className="flex-(--aspect) aspect-(--aspect) …"`.
- [ ] Delete the injected `<style>{…}</style>` tags (PhotoModal, CaseStudyCarousel, PhotoGallery) and express their hover/focus rules as variants.
- [ ] The two lightboxes share the same chrome: backdrop, close button, prev/next, caption. Use the same utility strings for both, either as a tiny shared component or a shared constant of class strings. Don't duplicate the strings.
- [ ] Rules in `pages/work/[...slug].astro` that style `.carousel-trigger` / `.carousel-badge` through `:global` move onto those elements' classes in the `.tsx`.
- [ ] **Done when:** no `style=` remains in these files except custom-property-only ones, and no `<style>` is left in any `.tsx`. Snapshot shows zero differences. In the browser: open a photo (arrows, Escape, the 0.9 backdrop), open the case-study carousel, and open the password modal (focus ring on the input, error text color).

### Task C: Astro components: scoped `<style>` to utilities

**Files:** `src/components/Hero.astro`, `AboutHero.astro`, `PortfolioPreview.astro`, `SectionHeader.astro`, `Pill.astro`, `Grid.astro`, `Divider.astro`, `ThemeToggle.astro`, `PageHeader.astro`, `dev/SwissToggle.astro`

- [ ] Convert each `<style>` to utilities on the elements and delete the block. Notes:
  - **Slotted or child-component content:** SectionHeader's `.filter-option` and `.filter-dot` are page markup passed in through a slot. Use `[&_.filter-option]:` variants on the container, or move the classes onto the page's markup.
  - **Pill:** keep the `--pill-color` custom property set via `style`, and consume it as `bg-(--pill-color) border-(--pill-color)`, falling back to `--accent-fill`.
  - **ThemeToggle:** the knob is a `::before` pseudo-element. Use `before:` utilities. `:global(.theme-dark)` states become a `dark` custom variant or `in-[.theme-dark]:`; use `@custom-variant dark (&:where(.theme-dark, .theme-dark *));` in `global.css` if needed. Keep `motion-safe:` and `forced-colors:`.
  - **Grid:** the nth-child offset rules use `[&>*:nth-child(odd)]:` style variants.
  - **AboutHero:** the carousel's mask-image, using Tailwind's mask utilities or an arbitrary property.
- [ ] **Done when:** none of these files has a `<style>`, unless a rule truly can't be a utility. In that case it stays with a `/* Why not Tailwind: … */` comment. Snapshot shows zero differences. In the browser: theme toggle hover, its knob slide, and both states.

### Task D: Pages and layout: scoped `<style>` to utilities

**Files:** `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `about.astro`, `404.astro`, `work/index.astro`, `writing/index.astro`, `writing/[...slug].astro`, `work/[...slug].astro`, `photography/index.astro`, `src/components/Divider.astro` (if not done in C)

- [ ] Convert each page's `<style>` to utilities and delete the block.
- [ ] **BaseLayout:** the `.backgrounds` multi-background and blend mode is effectively dead code: `use-animated-bg` replaces it with a solid background. Simplify it to what renders, and confirm with the snapshot.
- [ ] **BaseLayout:** register the intro `fadeInFromTop` keyframes as `--animate-fade-in-from-top` in `@theme`, and `slideDownAndFade` too if it's still used.
- [ ] **about.astro:** the emoji cursor data URIs stay as CSS, with a `/* Why not Tailwind: … */` comment.
- [ ] **writing/[...slug].astro:** the `.react-tweet-theme` margin uses a `[&_.react-tweet-theme]:` variant on the `.post-content` wrapper.
- [ ] **Done when:** pages have no `<style>` except documented exceptions. Snapshot shows zero differences, with Swiss off and Swiss on.

### Task E: Explain the unlayered CSS and lock the rules in

**Files:** create `docs/css-architecture.md`; modify `src/styles/global.css`, `src/styles/type.css`, `src/styles/prose.css`, `src/styles/swiss.css`, `docs/style-guide.html` ("How styles assemble" section), and `tests/styles/type-guard.test.ts` (or a new `tests/styles/css-rules.test.ts`)

- [ ] Write `docs/css-architecture.md`:
  - the cascade order (Tailwind `theme` → `base` → `components` → `utilities` → unlayered → inline);
  - what lives in each layer and file;
  - every remaining unlayered rule and why it must be unlayered;
  - the inline-style rule (custom properties only);
  - how to add a style ("utility first; a role or prose rule if it's shared text styling; unlayered only to override");
  - how the Swiss experiment works.
- [ ] Add a short header comment to each CSS file saying which layer it's in and why.
- [ ] Add guard tests:
  - no `!important` in `src/`;
  - every inline `style` in `.astro`/`.tsx` only sets `--custom-properties`;
  - no `<style>` in `.tsx`;
  - any `.astro` file with a `<style>` block must contain a `Why not Tailwind:` comment.
- [ ] Update the style guide's "How styles assemble" section to match the new layer diagram.
- [ ] **Done when:** tests and build pass, and the doc accurately lists what's in the codebase.
