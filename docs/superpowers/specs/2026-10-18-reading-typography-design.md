# Typography System, Reading Pages and Reader Controls: Design

Branch: `chore/fix-style-consistency-usablity`
Visual reference: `docs/type-explorations.html`, treatment **D · Proposed**. Open it in a browser; it's the approved look for reading pages.
Background audit: `docs/style-guide.html`. Findings are referenced below as F1–F13.

> **Updated 2026-10-20.** Three things changed after this spec was approved, and the text below now reflects them: the accent reds are one AAA red per theme (§3), `.prose` defaults to 18px with the headings staying at 24/20px (§5, §9), and the cascade is layered all the way down, with no `!important` in `src/` (see `docs/css-architecture.md`). The Swiss layout experiment mentioned in earlier notes was deleted.

## Why

The owner designs typography systems professionally, and their own site doesn't have one. Font sizes are declared page by page: the page title is defined six times, and blog posts and case studies each have their own diverging copy of the article styles. Most sizes are off any standard scale (34px H2s, 26px H3s, `24px !important` card titles, a hardcoded 1.5rem tagline). The specific complaint that started this: **H2s on blog pages are too large**. They're 34px against 16px body, 2.1× the body.

The owner wants three things:
- the site on the plain Tailwind v3 type scale **as much as possible**;
- **consistency across pages** as much as possible;
- reading pages that feel like Matter's reader (getmatter.com): calm, with headings that stand out through weight rather than size.

## Goals

1. **One type scale: Tailwind's default, sitewide.** Tailwind v4's default `text-*` scale has the same values as v3 (`xs` .75, `sm` .875, `base` 1, `lg` 1.125, `xl` 1.25, `2xl` 1.5, `3xl` 1.875, `4xl` 2.25, `5xl` 3rem). Every font size in `src/` resolves to one of these steps. There are no `px` font sizes and no `!important` on type, except the documented exceptions below.
2. **Named type roles, each defined once**, and used the same way on every page (table below).
3. **A consistent header** on blog posts and case studies: eyebrow, title, summary.
4. **One shared set of article styles** (`.prose`) for blog posts and case-study content.
5. **Separate brand red from accessible "action" red.** The logo keeps the brand red. Text and buttons use one red per theme that passes WCAG AAA (updated 2026-10-20; it started as AA).
6. **Reader controls**: an "Aa" panel in the nav on blog posts and case studies, for font (sans/serif), text size and line spacing.

## Non-goals

- Layout changes beyond what's listed here. The home page, About layout, grids, cards and nav keep their structure; only their type sizes move onto the scale.
- ~~Serving Aktiv Grotesk as a webfont (F1).~~ Superseded 2026-10-20: the site switched to Mona Sans from Google Fonts, which every visitor gets.
- Dead CSS cleanup (F6/F10/F11) as a goal in itself. Delete only what this work directly replaces.
- Changing the reading column width. The owner likes the current width.

## Anti-goals (failure even if it technically works)

- Headings that shout. H2 is no more than 1.5× body at the default size.
- The same role looking different on two pages.
- Blog and case-study articles styled by separate copies of the rules.
- A flash of default styles on load for a visitor with saved reader preferences.
- Reader controls that break the hierarchy at any setting.
- Red text or white-on-red that fails WCAG AA (4.5:1) in either theme.

## Constraints

- Astro 6 + Tailwind v4 (Vite pinned to 7). Tailwind utilities live in cascade layers, and unlayered CSS always beats them, so our CSS is layered too and the unlayered remainder is a short documented list. See `docs/css-architecture.md` and the style guide's "How styles assemble."
- Dark mode is a `.theme-dark` class on `<html>`, set by an inline script in `src/components/MainHead.astro` before paint and re-applied on `astro:after-swap`.
- Astro View Transitions (`ClientRouter`) are on, and Nav is `transition:persist`.
- Case-study body HTML is decrypted client-side and injected into `.gated-content` (`src/components/work/GatedContent.tsx`), so article styles must use a global class, not Astro-scoped selectors. The source lives in the private repo `~/code/portfolio-private`. It contains only h2, h3, p, ul (items lead with `**bold**`) and blockquotes; there are no rules, tables, code or inline images.
- The previous migration spec (`2026-04-03-tailwind-v4-hybrid-migration-design.md`) named tokens `--font-size-*` / `--font-family-*`. Those are v3 names that v4 ignores, which is the root of the two parallel scales (F3). This design supersedes that part of it.

## Decisions

### 1. Type tokens (`src/styles/global.css`)

- Delete the `--font-size-*` entries from `@theme`, so Tailwind's default `--text-*` scale is the only size scale.
- Font families use v4 namespaces: `--font-sans` (Mona Sans from Google Fonts; was Aktiv Grotesk, local-only), `--font-mono` (current Roboto Mono stack), and a new `--font-serif: 'Literata', Georgia, serif` for the reader option. Drop `--font-family-brand`; it's identical to body.
- Replace every `var(--font-size-*)` / `var(--font-family-*)` in `src/` (about 80 references). **Map by value or by role, never by name.** The old names are one step off from Tailwind's, so a plain rename silently shrinks text:

| Old token | Old value | Replace with |
|---|---|---|
| `--font-size-xs` / `sm` / `base` | .75 / .875 / 1rem | `--text-xs` / `sm` / `base` (same values) |
| `--font-size-md` | 1.125rem | `--text-lg` (only in dead Nav.astro rules) |
| `--font-size-lg` | 1.25rem | `--text-xl` (same value) |
| `--font-size-xl` | 1.625rem (26px) | `--text-2xl` (24px). There's no 26px step; this affects Photography year headings, the PasswordModal title, About section headings, and Nav `--icon-size` (nav gets 2px shorter). |
| `--font-size-2xl` / `3xl` | 2.125 / 2.625rem | By role: page titles, display title (see section 2) |
| `--font-size-4xl` / `5xl` | 3.5 / 4.5rem | Delete. Only the global `h1`/`h2` defaults use them, and every heading overrides those. |

- Hardcoded sizes move onto the scale:

| Where | Today | Becomes |
|---|---|---|
| Hero tagline (Hero.astro, AboutHero.astro, index.astro) | `1.5rem / 2rem` | `text-2xl` (same value; the line-height is Tailwind's default `2rem`) |
| `.button` (global.css) | `14px / 20px` | `text-sm` (same value) |
| Card title (PortfolioPreview.astro:113) | `24px !important` | `text-2xl`, no `!important` |
| Card description (PortfolioPreview.astro:65) | `16px` | `text-base` |
| Nav menu button / dropdown icon (`1.5rem`) | `1.5rem` | `text-2xl` |
| ThemeToggle icon | `1rem` | `text-base` |
| Lightbox and modal close / prev / next glyphs (PhotoModal, CaseStudyCarousel) | `2rem` / `2.5rem` | `text-3xl` / `text-4xl` |
| Carousel caption (CaseStudyCarousel.tsx:130) | `0.875rem` | `text-sm` |

- **Documented exceptions (leave as is):** the BackgroundEffect debug panel (12px, an easter egg), and the emoji-cursor SVG data URIs in about.astro (their `font-size` sizes the cursor image, not text).

### 2. Type roles

Each role is defined once (as a class, a component, or the `.prose` rules) and used everywhere it appears.

| Role | Spec | Used on |
|---|---|---|
| **Display title** | `text-4xl` → `lg:text-5xl` (36 → 48px), weight 600 (as today), line-height 1.1, `--gray-0` | Home hero only |
| **Page title** | `text-4xl` → `lg:text-5xl` (36 → 48px), weight 700, line-height 1.15, letter-spacing −0.01em, `--gray-0` | Writing index, Photography, About, Work index (`/work/`), 404 |
| **Article title** | `text-3xl` → `lg:text-4xl` (30 → 36px), weight 700, line-height 1.15, letter-spacing −0.01em, `--gray-0` | Blog post, case study (one step below the section pages) |
| **Summary** | `text-lg`, line-height 1.5, `--gray-400` | Blog post and case study (from `description`) |
| **Eyebrow** | Roboto Mono `text-xs`, uppercase, letter-spacing 0.06em, `--gray-400` | Date line on posts and case studies, and Writing-index post dates |
| **Lead** | `text-2xl`, `--gray-200` | Hero taglines (home, About, 404) |
| **Section heading** | `text-2xl` (24px), weight 700, line-height 1.3, `--gray-0` | `.prose` h2, About section headings |
| **Subheading** | `text-xl` (20px), weight 700, line-height 1.35, `--gray-0` | `.prose` h3, Photography year headings, PasswordModal title |
| **Section label** | `text-sm`, weight 600, uppercase, `--gray-200` | SectionHeader (unchanged) |
| **Body** | `text-lg` (18px), line-height 1.7 | `.prose` |
| **Meta** | Roboto Mono `text-sm`, `--gray-400`; labels uppercase | Bottom-of-post meta, case-study Role/Collaborators/Product block, footer |
| **Small link** | `text-sm`, weight 500, `--accent-text` | Back, Prev/Next |
| **Tag / pill** | `text-xs`, uppercase, letter-spacing 0.05em | Pills (unchanged) |

The Work index and 404 currently borrow the home `Hero` component. They switch to the page-title role, so only the home page shows the display size. 404 keeps its tagline as a Lead.

Global `h1–h5` defaults in global.css (4.5rem / 3.5rem / …) describe nothing real. Set them to match these roles (or remove them), as long as each page ends up as specified here.

### 3. Color: brand red vs. action red

`#ff4949` is 3.33:1 on white and 3.33:1 under white text, so it fails AA for text in light mode and for every white-on-red button in **both** themes. New tokens in `:root` / `:root.theme-dark`, bridged into `@theme`.

**Updated 2026-10-20: one AAA red per theme.** The first version used a brand red plus two AA reds (`#d62828` / `#b71c1c` light, `#ff4949` / `#ff7a7a` dark text). It is now a single red per theme, taken at the logo's hue (hsl 0 100%) at the lightest lightness that reaches WCAG AAA (7:1) as text on the page and under `--on-accent`. Text and fill are the same value, and the hovers are darker in light mode and lighter in dark mode.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#ff4949` | `#ff4949` | A token only. The logo is an image, and no UI code reads it (it fails as text: 3.33:1 on white). A test keeps it out of components. |
| `--accent-text` | `#b60000` (7.03:1 on white) | `#ff6969` (7.00:1 on the dark page) | All red text: links, back/prev/next, active filters, card CTA, footer social links, company link, PasswordModal error and links. Also the focus ring, list markers, blockquote rule and switches (theme toggle, Aa trigger). |
| `--accent-text-hover` | `#970000` (9.07:1) | `#ff8787` (8.49:1) | Hover for the above. A visible change, unlike the original `#ff4949` to `#f54c4c`. |
| `--accent-fill` | `#b60000` | `#ff6969` | Backgrounds under button text: `.button`, default Pill, GatedContent and PasswordModal buttons. Same value as `--accent-text` in each theme. |
| `--accent-fill-hover` | `#970000` | `#ff8787` | Hover for fills |
| `--on-accent` | `#ffffff` (7.03:1 on the fill, 9.07:1 on the hover) | `#090b11` (7.00:1 on the fill, 8.49:1 on the hover) | Text on fills. Dark mode uses near-black text, because white on `#ff6969` is 2.81:1. |
| `--accent-overlay-hover` | `hsla(0, 99%, 64%, 0.17)` | same | Tinted hover backgrounds, selection |

**Designer's call, resolved:** dark-mode buttons moved off `#ff4949` (white on it fails in dark mode too). They now use `#ff6969` with near-black text.

Replace and then remove the old tokens: `--accent-regular`, `--accent-dark`, `--accent-light`, `--accent-overlay`, `--accent-subtle-overlay`, `--link-color`, `--accent-text-over`. They're used in 13 files plus global.css. Map each use by what it *is* (text, fill or decoration), not by its old name. Per-project Pill colors from frontmatter (`color:`) are unchanged.

### 4. Page header (blog posts and case studies)

Applies to `src/pages/writing/[...slug].astro` and `src/pages/work/[...slug].astro`. Top to bottom:

1. **Back link** (Small link role) on its own line, in normal flow (no longer absolutely positioned), about 2rem above the eyebrow. Never on the eyebrow's line.
2. **Eyebrow**: `JULY 21, 2026 · 9 MIN READ`. Case studies show the date only (their body is encrypted, so read time can't be computed at build time). No section label, tags or author.
3. **Article title**.
4. **Summary**: the entry's `description` (required in both collections), about 0.75rem below the title.

The article body starts about 3rem below. Case studies keep their screenshot carousel and Role / Collaborators / Product block below the header. Build it once (e.g. `PageHeader.astro` with `title`, `description`, `date` and optional `readingTime`).

### 5. Article body (`.prose`)

One global class, applied to the blog `.post-content` wrapper and the case-study `.gated-content` element. It replaces both existing copies (writing/[...slug].astro:137-214 and work/[...slug].astro:206-284). **All sizes inside are `em`, relative to `.prose`'s font size**, so reader controls scale everything while keeping the hierarchy. At the default size they land exactly on the scale.

**Updated 2026-10-20: the default is 18px.** The body grew from 16px to 18px (`text-lg`), and the heading sizes stay at the approved 24px and 20px by changing their ratios to `calc(4em / 3)` and `calc(10em / 9)`, so only the body text got bigger. The reader's default size is 18 (it was 16).

| Element | Spec (value at the default 18px) |
|---|---|
| Base | 1.125rem (`text-lg`), line-height 1.7, `--gray-100`, `--font-sans`. Column width unchanged: full width below 60em; the middle column of `1fr 60% 1fr` at and above 60em. |
| `p + p` | margin-top 1.4em |
| `strong` | weight 600, `--gray-0` |
| `h2` | `calc(4em / 3)` (24px), Section heading role, margin 2.75em 0 0.75em (em of the heading) |
| `h3` | `calc(10em / 9)` (20px), Subheading role, margin 2em 0 0.5em |
| `h4` | `1em` (18px), weight 600, `--gray-0`, margin 1.5em 0 0.5em. Set apart by weight, not size. |
| Links | `--accent-text` at rest. 1px underline, offset 0.2em, underline at about 40% opacity of the link color; on hover, full underline and `--accent-text-hover` |
| `ul` / `ol` | Real markers (`disc` / `decimal`; Preflight removes them). padding-left 1.25em, margin-top 1.4em, `li + li` 0.4em. `ul` markers in `--accent-text`. |
| `blockquote` | **Upright (not italic)**, 2px `--accent-text` left rule, padding-left 1.25em, `--gray-200`, margin 1.75em 0 |
| Images / figures | Full width, radius 0.75rem, `--shadow-md`, margin 2.5em auto. `figcaption`: 0.875em, `--gray-400`, centered. |
| `hr` | 1px `--gray-800`, margin 2.5em 0 |
| `.react-tweet-theme` | Keep `margin: 2rem auto` |

Because the headings are fixed ratios of the body, the reader sizes give: 14px body, h2 18.7px, h3 15.6px; 16px, 21.3 and 17.8px; 20px, 26.7 and 22.2px. The h2 stays under 1.5x the body at every size (1.33x), which is the anti-goal above.

**Cascade note (done):** the element defaults live in `@layer base` and `.prose` in `@layer components`, so `.prose` beats the global `h2` / `a` rules and a utility on the same element still beats `.prose`. Never move `.prose` out of its layer: an unlayered rule would beat every utility.

### 6. Bottom-of-post meta

Drop the "Date" row (the date is at the top now). Keep "Tags", the only place tags appear, in the Meta role, about 4rem below the body. Prev/Next is unchanged apart from colors.

### 7. Index pages

- **Writing index:** Page title. Post links stay as today in size (`--font-size-lg` → `text-xl`), `--gray-0`, hover `--accent-text`. Dates use the Eyebrow role.
- **Photography:** Page title. Year headings use the Subheading role.
- **Work index:** Page title instead of the Hero component.

### 8. About page (owner's call: new title and heading sizes only)

- Title (AboutHero) uses the Page title role. Section headings ("Background", "Skills", "Current Interests") use the Section heading role.
- Everything else is unchanged: the side-heading layout at ≥60em, body at 16px on mobile and `text-xl` (20px, same value as today) on desktop with line-height 1.5, and lists without bullets. Links use `--accent-text`, keeping their current hover-underline behavior.
- About does **not** use `.prose` and gets no Aa button.

### 9. Reader controls

- **Where:** an "Aa" icon button in the nav, immediately left of the theme toggle, matching its size and treatment. Shown only on blog posts and case studies.
- **Panel** (styled after Matter's reader panel: rounded card, `--gray-999` surface, `--gray-800` border, `--shadow-lg`):
  - **Font:** Sans (Mona Sans) / Serif (Literata). Default Sans.
  - **Size:** 14 / 16 / 18 / 20px on the `.prose` base (`text-sm` / `base` / `lg` / `xl`). Default 18 (changed from 16 on 2026-10-20).
  - **Line spacing:** 1.5 / 1.7 / 1.9. Default 1.7.
  - **Reset to default.**
  - Steppers (like Matter's ▼▲) or segmented controls; builder's choice.
- **Affects only `.prose`** on opted-in pages. The page header, nav, footer and meta don't change. The `data-reader-*` attributes sit on `<html>`, so `.prose` responds to them only inside a page-level opt-in (e.g. `[data-reader-enabled] .prose` on the post and case-study article wrappers). A saved preference can then never restyle other pages.
- **Persistence:** `localStorage` key `reader-prefs` (`{ font, size, leading }`), applied as `data-reader-font|size|leading` on `<html>` by an inline script in `MainHead.astro` before paint and on `astro:after-swap`, mirroring the theme script.
- **Serif font loading:** Literata via Google Fonts (`display=swap`), loaded only when serif is active. The inline script adds the `<link>` when the saved pref is serif, and the panel adds it on switch. Default visitors download nothing extra.
- **Accessibility:** a `<button>` with `aria-label="Reading settings"` and `aria-expanded`. The panel is keyboard reachable and closes on Escape or an outside click, returning focus to the button. Settings are radio groups or steppers with visible values. Works in both themes.

## Left to the builder

- File and component names, and whether roles are classes, components or both.
- The reader panel's implementation (Radix dropdown already in deps, a web component like `ThemeToggle.astro`, or a React island) and its visual details within the spec.
- Deleting per-page heading and prose rules once replaced.

## Verification

- `npx astro build` succeeds, and `npm test` passes.
- A search finds no `--font-size-`, `--font-family-`, `--accent-regular`, `--accent-dark` or `--link-color` left in `src/`, and no `px` font sizes outside the documented exceptions.
- Light and dark, at ~375px and ~1400px: home, Work index, one blog post, Writing index, Photography, About, one case study (unlock locally) and 404. Reading pages match `docs/type-explorations.html` (D), apart from the decided changes (eyebrow, red links, upright quotes).
- Computed sizes on a blog post at default reader settings: body 18px / 30.6px, H2 24px, H3 20px, title 36px at desktop. Home title 48px at desktop.
- Contrast: link text and button text/background pass 7:1 (AAA) in both themes. `tests/styles/color-tokens.test.ts` checks it.
- Reader controls: each setting changes body text with no layout break; preferences survive reload and View Transition navigation with no flash; reset works; keyboard-only use works; About and index pages ignore saved preferences.
