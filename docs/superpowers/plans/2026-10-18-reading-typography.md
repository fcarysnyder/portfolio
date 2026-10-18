# Typography System, Reading Pages and Reader Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the whole site onto Tailwind's default type scale, with named type roles, a shared reading-page header and article styles, accessible accent reds, and an "Aa" reader-settings panel.

**Architecture:** Tokens live in `src/styles/global.css`. Type roles (`type.css`) and article styles (`prose.css`) are new files imported by global.css. Element defaults go in `@layer base` and roles/prose in `@layer components`, so the cascade order is explicit. Reader preferences are a pure TS module (`src/lib/reader-prefs.ts`) whose bootstrap function is inlined into `MainHead.astro` before paint, plus a React/Radix island in the Nav.

**Tech Stack:** Astro 6, Tailwind CSS v4 (`@theme`, layers), React 19, `@radix-ui/react-dropdown-menu` (already installed), `lucide-react`, Vitest 4 (node environment, no DOM library).

**Spec:** `docs/superpowers/specs/2026-10-18-reading-typography-design.md`. Visual reference: `docs/type-explorations.html` (treatment D).

## Global Constraints

- Type scale = Tailwind defaults only: `xs` .75, `sm` .875, `base` 1, `lg` 1.125, `xl` 1.25, `2xl` 1.5, `3xl` 1.875, `4xl` 2.25, `5xl` 3rem. Never redefine `--text-*` in `@theme`.
- Families: `--font-sans` (current Aktiv Grotesk stack), `--font-mono` (current Roboto Mono stack), `--font-serif: 'Literata', Georgia, serif`.
- Every `font-size` / `fontSize` in `src/` is `var(--text-*)`, a Tailwind `text-*` class, an `em` value inside `prose.css`, or `inherit`. The only exceptions are `src/components/BackgroundEffect.astro` and the cursor data URIs in `src/pages/about.astro`.
- No `!important` in any type rule you add or touch.
- Map old size tokens **by value or role, never by name** (spec §1 table): `xs/sm/base` keep their names, `md` → `--text-lg`, `lg` → `--text-xl`, `xl` → `--text-2xl`, `2xl`/`3xl` → by role, `4xl`/`5xl` deleted.
- Red text uses `--accent-text`, white-on-red fills use `--accent-fill`, and decoration and the logo use `--brand` (`#ff4949`). Values are in spec §3.
- Breakpoint for `lg:` and media queries is `60em`.
- Dark mode stays the `.theme-dark` class on `<html>`. Don't introduce Tailwind `dark:`.
- `npm test` and `npx astro build` must pass at the end of every task.

## Review Focus

1. **View Transition navigation with a persisted Nav.** Nav is `transition:persist`, so anything rendered once in Nav (the Aa button) survives navigation. Its visibility must be recomputed on every `astro:page-load`, and reader attributes re-applied on `astro:after-swap`. Pinned in Task 5 (bootstrap test) and Task 6 (browser step).
2. **Bad or old `localStorage` values** (invalid JSON, `size: 17`, `font: "comic"`, missing fields) must fall back to defaults per field, never crash, and never leave the page unstyled. Pinned in Task 5.
3. **`localStorage` that throws** (Safari private mode, blocked storage): the bootstrap and panel must still render defaults. Pinned in Task 5.
4. **Long titles and descriptions at 375px:** the header and eyebrow wrap with no horizontal scroll. Pinned in Task 4 (browser step).
5. **Hierarchy at extreme reader settings** (serif + 20px + 1.9): H2 stays 1.5× body because every prose size is `em`. Pinned in Task 4 (prose.css test) and Task 6 (browser step).

---

### Task 1: Migrate the type scale and add a source guard

**Files:**
- Create: `tests/styles/type-guard.test.ts`
- Modify: `src/styles/global.css` (`@theme` lines 26-41; `.menu-button` 292; `.nav-items` 334; `.button` 386; `h1–h5` 263-281)
- Modify (replace every `--font-size-*` / `--font-family-*` / hardcoded size): `src/components/{Nav,Footer,Hero,AboutHero,PortfolioPreview,SectionHeader,Pill,ThemeToggle}.astro`, `src/components/photography/{PhotoGallery,PhotoModal}.tsx`, `src/components/work/{PasswordModal,GatedContent,CaseStudyCarousel}.tsx`, `src/pages/{index,about}.astro`, `src/pages/photography/index.astro`, `src/pages/writing/{index,[...slug]}.astro`, `src/pages/work/[...slug].astro`

**Interfaces:**
- Produces: `--font-sans`, `--font-mono`, `--font-serif` in `@theme`; Tailwind default `--text-*` as the only size scale; the test helper `listSourceFiles(): string[]` (inside the test file) reused by later guard tests via copy, not import.

- [ ] **Step 1: Write the failing guard test** `tests/styles/type-guard.test.ts`

```ts
// walks src/ (.astro .tsx .ts .css), skipping BackgroundEffect.astro
it('uses no v3-named type tokens', () => {
  expect(grepSrc(/--font-size-|--font-family-/)).toEqual([]);
});
it('declares every font size on the Tailwind scale', () => {
  // collects `font-size: X` and `fontSize: 'X'` values; ignores about.astro data: URIs and src/styles/prose.css
  expect(offScaleFontSizes()).toEqual([]); // allowed: /^var\(--text-[0-9a-z]+\)$/, 'inherit'
});
it('does not redefine the Tailwind text scale', () => {
  expect(read('src/styles/global.css')).not.toMatch(/@theme[^}]*--text-/s);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/styles/type-guard.test.ts`. Expected: FAIL, listing about 80 `--font-size-*` hits and the px/rem sizes from spec §1.

- [ ] **Step 3: Edit `@theme`.** Delete `--font-size-*`. Rename `--font-family-body` → `--font-sans`, `--font-family-mono` → `--font-mono`, add `--font-serif`, and delete `--font-family-brand`.

- [ ] **Step 4: Replace references** across the listed files using the spec §1 mapping. For the `2xl`/`3xl` title uses, write the final role values now: home `Hero.astro` title `var(--text-4xl)` → `var(--text-5xl)` at 60em; all other page titles `var(--text-3xl)` → `var(--text-4xl)`. Task 3 consolidates these into classes. Hardcoded sizes follow the spec §1 second table (tagline `var(--text-2xl)` with line-height `2rem`; `.button` `var(--text-sm)`; card title `var(--text-2xl)` without `!important`; card description `var(--text-base)`; menu/nav `1.5rem` → `var(--text-2xl)`; ThemeToggle `var(--text-base)`; modal glyphs `var(--text-3xl)` / `var(--text-4xl)`; carousel caption `var(--text-sm)`). Global `h1–h5`: point at `--text-*` steps temporarily (`5xl/4xl/3xl/2xl/xl`); Task 3 replaces them.

- [ ] **Step 5: Run** `npm test && npx astro build`. Expected: all tests pass and the build completes.

- [ ] **Step 6: Visual check.** `preview_start` "astro-dev"; on `/`, `/writing/`, `/photography/`, `/about/` and one post, confirm in light and dark that nothing besides font sizes moved (no layout break, no unstyled text). Report the computed home title size at 1400px width: expect `48px`.

- [ ] **Step 7: Commit** `refactor(type): move site onto Tailwind default type scale`

---

### Task 2: Split brand red from accessible action reds

**Files:**
- Create: `tests/styles/color-tokens.test.ts`
- Modify: `src/styles/global.css` (`:root` 119-126, `:root.theme-dark` 176-184, `@theme` color bridge 18-24, `::selection`, `a`, focus rings, `.menu-*`, `.link`, `.button`)
- Modify (every old accent token): `Footer.astro`, `Hero.astro`, `Nav.astro`, `Pill.astro`, `PortfolioPreview.astro`, `SectionHeader.astro`, `ThemeToggle.astro`, `ScrambleText.tsx`, `work/GatedContent.tsx`, `work/PasswordModal.tsx`, `pages/work/[...slug].astro`, `pages/writing/[...slug].astro`, `pages/writing/index.astro`, `BackgroundEffect.astro:496` (reads `--accent-regular` at runtime → read `--brand`)

**Interfaces:**
- Produces: CSS vars `--brand`, `--accent-text`, `--accent-text-hover`, `--accent-fill`, `--accent-fill-hover`, `--on-accent` (plus `--accent-overlay-hover`, unchanged), bridged as `--color-brand`, `--color-accent-text`, `--color-accent-fill`, `--color-on-accent`.

- [ ] **Step 1: Write the failing test** `tests/styles/color-tokens.test.ts`. It parses hex values out of the `:root {…}` and `:root.theme-dark {…}` blocks of global.css and holds a ~10-line WCAG contrast helper.

```ts
it('removes the old accent tokens from src', () => {
  expect(grepSrc(/--accent-(regular|dark|light|overlay\b|subtle-overlay|text-over)|--link-color/)).toEqual([]);
});
it.each(['light', 'dark'])('%s: accent text passes AA on the page background', (mode) => {
  expect(contrast(tok(mode, '--accent-text'), tok(mode, '--gray-999'))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tok(mode, '--accent-text-hover'), tok(mode, '--gray-999'))).toBeGreaterThanOrEqual(4.5);
});
it.each(['light', 'dark'])('%s: text on accent fill passes AA', (mode) => {
  expect(contrast(tok(mode, '--on-accent'), tok(mode, '--accent-fill'))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tok(mode, '--on-accent'), tok(mode, '--accent-fill-hover'))).toBeGreaterThanOrEqual(4.5);
});
it('keeps the brand red', () => {
  expect(tok('light', '--brand')).toBe('#ff4949');
});
```

`tok(mode, name)` falls back to the light value when the dark block doesn't redefine `name`.

- [ ] **Step 2: Run** `npx vitest run tests/styles/color-tokens.test.ts`. Expected: FAIL (tokens missing, old tokens present).

- [ ] **Step 3: Add the tokens** with spec §3 values: light `--accent-text #d62828`, `--accent-text-hover #b71c1c`; dark `--accent-text #ff4949`, `--accent-text-hover #ff7a7a`; both themes `--brand #ff4949`, `--accent-fill #d62828`, `--accent-fill-hover #b71c1c`, `--on-accent #ffffff`. Update the `@theme` bridge.

- [ ] **Step 4: Replace every old token by what the use *is*.** Text → `--accent-text` / `-hover`. Fill behind text (`.button`, Pill default, GatedContent and PasswordModal buttons) → `--accent-fill` / `-hover` with `--on-accent`. Decoration (focus rings, ThemeToggle knob and icon, ScrambleText cursor, `::selection` text, BackgroundEffect) → `--brand`. Then delete the old tokens and the gradients that only used them (`--gradient-accent`, `--gradient-accent-orange`, `--gradient-stop-*`).

- [ ] **Step 5: Run** `npm test && npx astro build`. Expected: PASS.

- [ ] **Step 6: Visual check** in light and dark: the home "Drop me a line" button, a card CTA, Writing-index hover, the footer links and the theme toggle. Light-mode red text should look visibly deeper than the logo red. Hovers should visibly change.

- [ ] **Step 7: Commit** `feat(color): separate brand red from accessible accent text and fill`

---

### Task 3: Type roles, defined once and applied sitewide

**Files:**
- Create: `src/styles/type.css` (imported from global.css after `@import "tailwindcss"`)
- Create: `tests/styles/type-roles.test.ts`
- Modify: `src/styles/global.css`: move `body`, `h1–h5`, `a`, `img` and `::selection` into `@layer base`; set `h1–h5` to weight 600, line-height 1.1, `--gray-0`, **no font-size** (roles set size).
- Modify: `Hero.astro` (title → `.t-display`, tagline → `.t-lead`), `AboutHero.astro` (`.t-page-title`, tagline `.t-lead`), `pages/about.astro` (`.section-title` → `.t-section-heading`), `pages/photography/index.astro` (h1 → `.t-page-title`), `photography/PhotoGallery.tsx:101` (year heading → `className="t-subheading"`, drop the inline size/color), `work/PasswordModal.tsx:125` (title → `t-subheading`), `pages/writing/index.astro` (h1 → `.t-page-title`, `time` → `.t-eyebrow`), `pages/work/index.astro` and `pages/404.astro` (replace `<Hero>` with an `h1.t-page-title`; 404 keeps its tagline as `p.t-lead`), `pages/index.astro:99-102` (delete `.hero p`; the tagline is styled by `.t-lead`)

**Interfaces:**
- Produces (global classes in `@layer components`, spec §2 values): `.t-display`, `.t-page-title`, `.t-summary`, `.t-eyebrow`, `.t-lead`, `.t-section-heading`, `.t-subheading`, `.t-meta`, `.t-small-link`. Task 4 uses `.t-page-title`, `.t-summary`, `.t-eyebrow`, `.t-meta` and `.t-small-link`.

- [ ] **Step 1: Write the failing test** `tests/styles/type-roles.test.ts`

```ts
it('defines each role in type.css', () => {
  for (const c of ['t-display','t-page-title','t-summary','t-eyebrow','t-lead','t-section-heading','t-subheading','t-meta','t-small-link'])
    expect(read('src/styles/type.css')).toMatch(new RegExp(`\\.${c}\\b`));
});
it('declares title sizes only in type.css', () => {
  // no file outside src/styles/type.css sets font-size to --text-3xl, --text-4xl or --text-5xl
  expect(grepSrc(/font-?[sS]ize:\s*['"]?var\(--text-(3xl|4xl|5xl)\)/, { exclude: ['src/styles/type.css'] })).toEqual([]);
});
it('no page uses the home Hero component except the home page', () => {
  expect(grepSrc(/import Hero from/, { exclude: ['src/pages/index.astro'] })).toEqual([]);
});
```

- [ ] **Step 2: Run it.** Expected: FAIL.

- [ ] **Step 3: Write `type.css`** with spec §2 values:
  - `.t-display`: `4xl`, `lg` `5xl`, 600, lh 1.1.
  - `.t-page-title`: `3xl`, `lg` `4xl`, 700, lh 1.15, −0.01em.
  - `.t-summary`: `lg`, lh 1.5, gray-400.
  - `.t-eyebrow`: mono `xs` uppercase 0.06em gray-400.
  - `.t-lead`: `2xl`, gray-200 (Tailwind's default line-height).
  - `.t-section-heading`: `2xl` 700 lh 1.3 gray-0.
  - `.t-subheading`: `xl` 700 lh 1.35 gray-0.
  - `.t-meta`: mono `sm` gray-400.
  - `.t-small-link`: `sm` 500 `--accent-text`, hover `-hover`, no underline.

  Use `@media (min-width: 60em)` for the `lg` steps. Move the global.css element rules into `@layer base`.

- [ ] **Step 4: Apply the roles** in the listed files, and delete each file's now-redundant size/weight/color declarations.

- [ ] **Step 5: Run** `npm test && npx astro build`. Expected: PASS.

- [ ] **Step 6: Visual check** at 375px and 1400px. Confirm these all show the same title style: `/writing/`, `/photography/`, `/work/`, `/about/` and `/404`. Confirm `/` shows the larger display title. About keeps its side-heading layout and 20px desktop body.

- [ ] **Step 7: Commit** `feat(type): define type roles once and use them on every page`

---

### Task 4: Shared page header and article styles for posts and case studies

**Files:**
- Create: `src/components/PageHeader.astro`
- Create: `src/styles/prose.css` (imported from global.css, `@layer components`)
- Create: `tests/styles/prose.test.ts`
- Modify: `src/pages/writing/[...slug].astro`: header → `<PageHeader>`; `.post-content` gets `class="prose"`; delete lines 94-214 (old header and prose rules) except `.react-tweet-theme`; footer drops the Date row.
- Modify: `src/pages/work/[...slug].astro`: header → `<PageHeader>` (no `readingTime`); delete 117-143 (old header) and 205-284 (old `.gated-content` rules). **Keep** `.gated-placeholder` (196-203), `.post-meta-top` and the `.meta-row` rules; footer drops the Date row.
- Modify: `src/components/work/GatedContent.tsx:118`: `className="gated-content prose"`

**Interfaces:**
- Consumes: `.t-page-title`, `.t-summary`, `.t-eyebrow`, `.t-small-link`, `.t-meta` (Task 3); `--accent-text`, `--brand` (Task 2).
- Produces: `PageHeader.astro` props `{ title: string; description: string; date: Date; readingTime?: number; backHref: string }`, rendering, in order: `a.t-small-link` "← Back" (own line, margin-bottom 2rem); `p.t-eyebrow` with `<time>` and, if `readingTime`, ` · {n} min read`; `h1.t-page-title`; `p.t-summary` (margin-top 0.75rem). The global class `.prose` (Task 5 adds reader hooks to it). Each article wrapper gets the `data-reader-enabled` attribute (Task 5 and 6 depend on it).

- [ ] **Step 1: Write the failing test** `tests/styles/prose.test.ts`. It parses `prose.css` declarations per selector:

```ts
it('sizes every prose element in em so reader settings keep the hierarchy', () => {
  expect(decl('.prose h2', 'font-size')).toBe('1.5em');
  expect(decl('.prose h3', 'font-size')).toBe('1.25em');
  expect(decl('.prose h4', 'font-size')).toBe('1.125em');
  expect(allFontSizes(prose).filter((v) => !/em$|^var\(--reader-size/.test(v))).toEqual([]);
});
it('keeps quotes upright and lists marked', () => {
  expect(decl('.prose blockquote', 'font-style')).toBe('normal');
  expect(decl('.prose ul', 'list-style-type')).toBe('disc');
  expect(decl('.prose ol', 'list-style-type')).toBe('decimal');
});
it('both article templates use the shared styles', () => {
  expect(read('src/pages/writing/[...slug].astro')).toMatch(/class="[^"]*\bprose\b/);
  expect(read('src/components/work/GatedContent.tsx')).toMatch(/gated-content prose/);
  expect(read('src/pages/work/[...slug].astro')).not.toMatch(/\.gated-content (h2|p|ul)/);
});
```

- [ ] **Step 2: Run it.** Expected: FAIL.

- [ ] **Step 3: Write `prose.css`** from the spec §5 table, exactly:
  - Base: `font-size: var(--reader-size, 1rem)`, `line-height: var(--reader-leading, 1.7)`, color gray-100, `font-family: var(--reader-font, var(--font-sans))`.
  - `p + p` 1.4em; `strong` 600 gray-0.
  - h2: 1.5em / 700 / 1.3, margin `2.75em 0 0.75em`. h3: 1.25em / 700 / 1.35, margin `2em 0 0.5em`. h4: 1.125em / 600, margin `1.5em 0 0.5em`.
  - Links: `--accent-text`, 1px underline at 0.2em offset, `color-mix(in srgb, currentColor 40%, transparent)`, hover `--accent-text-hover` with a full underline.
  - Lists: padding 1.25em, margin-top 1.4em, `li + li` 0.4em, `ul li::marker` `--brand`.
  - Blockquote: normal style, 2px `--brand` left rule, padding 1.25em, gray-200, margin `1.75em 0`.
  - Images: 0.75rem radius, shadow-md, margin `2.5em auto`; figcaption 0.875em gray-400 centered.
  - `hr`: 1px gray-800, margin `2.5em 0`.
  - First child: margin-top 0.

- [ ] **Step 4: Build `PageHeader.astro`** per Interfaces, and wire both templates. Blog: `backHref="/writing/"`, `readingTime={getReadingTime(post.body ?? '')}`. Case study: `backHref="/"`, no `readingTime`. Body gap below the header: 3rem. Bottom meta: Tags row only, `margin-top: 4rem`, `.t-meta`.

- [ ] **Step 5: Run** `npm test && npx astro build`. Expected: PASS.

- [ ] **Step 6: Browser check** against `docs/type-explorations.html` (D) on `/writing/clarity-is-the-deliverable/`. At 1400px, computed: body `16px`/`27.2px`, h2 `24px`, title `36px`, eyebrow text `JULY 21, 2026 · 9 MIN READ`-style, back link above it on its own line. At 375px: no horizontal scroll (`scrollWidth === clientWidth`) on the longest-titled post. The case-study page renders its header, carousel and meta block (decrypted content needs a password; ask the owner to unlock locally and eyeball it, and record that this wasn't machine-checked).

- [ ] **Step 7: Commit** `feat(reading): shared page header and prose styles for posts and case studies`

---

### Task 5: Reader preferences: model, pre-paint bootstrap, CSS hooks

**Files:**
- Create: `src/lib/reader-prefs.ts`
- Create: `tests/lib/reader-prefs.test.ts`
- Modify: `src/components/MainHead.astro`: add the inline bootstrap after the theme script.
- Modify: `src/styles/prose.css`: add the hooks.

**Interfaces:**
- Produces, in `src/lib/reader-prefs.ts`:
  - `type ReaderFont = 'sans' | 'serif'; type ReaderSize = 14 | 16 | 18 | 20; type ReaderLeading = 1.5 | 1.7 | 1.9;`
  - `interface ReaderPrefs { font: ReaderFont; size: ReaderSize; leading: ReaderLeading }`
  - `const READER_DEFAULTS: ReaderPrefs = { font: 'sans', size: 16, leading: 1.7 }`
  - `const READER_STORAGE_KEY = 'reader-prefs'`
  - `const LITERATA_HREF = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap'`
  - `parseReaderPrefs(raw: string | null): ReaderPrefs`: per-field fallback to defaults, never throws.
  - `applyReaderPrefs(doc: Document, prefs: ReaderPrefs): void`: sets `data-reader-font`, `data-reader-size` and `data-reader-leading` on `doc.documentElement`, and appends `<link id="reader-serif-font" rel="stylesheet" href=LITERATA_HREF>` once when `font === 'serif'`.
  - `saveReaderPrefs(storage: Storage, prefs: ReaderPrefs): void` (swallows storage errors).
  - `readerBootstrap(doc?: Document, storage?: Storage): void`: **self-contained** (no references to module-level identifiers; it's serialized with `.toString()`). It reads the key, validates, and applies. Defaults are `document` / `localStorage`, and a throwing `localStorage` getter means defaults.

- [ ] **Step 1: Write the failing tests** `tests/lib/reader-prefs.test.ts`, with a tiny fake `doc` (`documentElement.setAttribute/getAttribute`, `head.appendChild`, `createElement`, `getElementById`) and a fake storage:

```ts
it('parses valid prefs', () => expect(parseReaderPrefs('{"font":"serif","size":20,"leading":1.9}')).toEqual({ font: 'serif', size: 20, leading: 1.9 }));
it('falls back per field', () => expect(parseReaderPrefs('{"font":"comic","size":17}')).toEqual(READER_DEFAULTS));
it('survives invalid JSON and null', () => {
  expect(parseReaderPrefs('{oops')).toEqual(READER_DEFAULTS);
  expect(parseReaderPrefs(null)).toEqual(READER_DEFAULTS);
});
it('applies attributes and loads Literata only once for serif', () => {
  applyReaderPrefs(doc, { font: 'serif', size: 18, leading: 1.5 });
  applyReaderPrefs(doc, { font: 'serif', size: 18, leading: 1.5 });
  expect(doc.attrs).toEqual({ 'data-reader-font': 'serif', 'data-reader-size': '18', 'data-reader-leading': '1.5' });
  expect(doc.links).toHaveLength(1);
});
it('bootstrap applies saved prefs', () => { readerBootstrap(doc, storeWith('{"size":14}')); expect(doc.attrs['data-reader-size']).toBe('14'); });
it('bootstrap survives a throwing storage', () => { readerBootstrap(doc, throwingStorage); expect(doc.attrs['data-reader-size']).toBe('16'); });
it('bootstrap is self-contained when serialized', () => {
  const fn = new Function('doc', 'storage', `(${readerBootstrap.toString()})(doc, storage)`);
  fn(doc, storeWith('{"font":"serif"}'));
  expect(doc.attrs['data-reader-font']).toBe('serif');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/reader-prefs.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/reader-prefs.ts`** per Interfaces.

- [ ] **Step 4: Inline it in `MainHead.astro`:** `<script is:inline set:html={`(${readerBootstrap.toString()})();document.addEventListener('astro:after-swap',function(){(${readerBootstrap.toString()})()});`} />`.

- [ ] **Step 5: Add hooks to `prose.css`**, effective only inside `[data-reader-enabled]`:

```css
[data-reader-size="14"] [data-reader-enabled] .prose { --reader-size: var(--text-sm); }
/* 16 → base (default), 18 → lg, 20 → xl; leading 1.5 / 1.9; font serif → var(--font-serif) */
```

- [ ] **Step 6: Run** `npm test && npx astro build`. Expected: PASS. In the browser, set `localStorage['reader-prefs']='{"font":"serif","size":20,"leading":1.9}'` and reload a post. The body should render in Literata at 20px with H2 at 30px, and `/about/` and `/writing/` should be unchanged.

- [ ] **Step 7: Commit** `feat(reader): persisted reader preferences applied before paint`

---

### Task 6: "Aa" reader settings panel in the nav

**Files:**
- Create: `src/components/ReaderSettings.tsx`
- Modify: `src/components/Nav.astro`: render `<ReaderSettings client:load />` immediately before the `.theme-toggle` div.
- Modify: `src/styles/global.css` (or co-locate a `ReaderSettings.css` imported by the component): panel styles, reusing the `.menu-content` look (`--gray-999`, `--gray-800` border, radius 0.75rem, `--shadow-lg`).

**Interfaces:**
- Consumes: `parseReaderPrefs`, `applyReaderPrefs`, `saveReaderPrefs`, `READER_DEFAULTS`, `READER_STORAGE_KEY` (Task 5); `[data-reader-enabled]` on article wrappers (Task 4).
- Produces: `export default function ReaderSettings(): JSX.Element | null`.

- [ ] **Step 1: Implement** with `@radix-ui/react-dropdown-menu`:
  - **Trigger:** a `<button aria-label="Reading settings">` with a lucide `ALargeSmall` icon (fallback `Type`), sized and styled like ThemeToggle's 2rem circle.
  - **Content:** three `DropdownMenu.RadioGroup`s, labeled "Font" (Sans/Serif), "Size" (14/16/18/20, labels S/M/L/XL with the px value visible) and "Spacing" (Tight/Normal/Loose). Then an Item "Reset to default". Each change calls `applyReaderPrefs` then `saveReaderPrefs`, and the menu stays open on select (`onSelect={e => e.preventDefault()}`).
  - **Visibility:** the component is in the persisted Nav, so it must not decide at render time. On mount and on every `astro:page-load`, set a `visible` state from `!!document.querySelector('[data-reader-enabled]')`, and return `null` when false.
  - Radix handles Escape, outside click and focus return.

- [ ] **Step 2: Run** `npm test && npx astro build`. Expected: PASS.

- [ ] **Step 3: Browser check** (record the results):
  - The Aa button appears on a post and a case study, not on `/`, `/writing/`, `/about/` or `/photography/`.
  - Navigate post → `/writing/` → another post via links (View Transitions): it hides, then reappears.
  - Change each setting: the body updates live. Check that serif + 20px + Loose keeps H2/body at 1.5×.
  - Reload: the settings persist with no flash of default size.
  - Reset returns to 16/1.7/sans.
  - Keyboard only: Tab to the button, Enter opens, arrows move, Escape closes and focus returns.
  - Repeat in dark mode.

- [ ] **Step 4: Commit** `feat(reader): Aa reading settings panel for posts and case studies`

---

### Task 7: Refresh the style guide and do a final sweep

**Files:**
- Modify: `docs/style-guide.html`: update the snapshot tokens block, Color (new red tokens), Typography (Tailwind scale, roles table from spec §2), Findings (mark F2, F3, F4, F5 and F8 resolved, with the commit), Components (button and pill fills, links). Keep the "How styles assemble" section, updated for `@layer base/components`.

- [ ] **Step 1: Update the guide.** Then open it at 375px and 1400px: no horizontal scroll, and the toggles still work.
- [ ] **Step 2: Final verification** per spec "Verification":
  - `npm test && npx astro build` pass.
  - `grep -rnE -- "--font-size-|--font-family-|--accent-regular|--accent-dark|--link-color" src` returns nothing.
  - Visit home, `/work/`, a post, `/writing/`, `/photography/`, `/about/` and `/404` in light and dark at both widths.
  - Report anything not machine-checked, such as decrypted case-study content.
- [ ] **Step 3: Commit** `docs: update style guide to the new type and color system`
