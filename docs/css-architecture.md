# How the CSS fits together

This is the plain-language map of the site's styles after the Tailwind cleanup. It says which file owns what, which rule wins when two disagree, and how to add a style without breaking that. The visual reference is `docs/style-guide.html`; the design decisions behind the type and color systems are in `docs/superpowers/specs/2026-10-18-reading-typography-design.md`.

## The short version

- **Style elements with Tailwind classes in the markup.** That is where almost all styling lives.
- **Three CSS files** hold what classes can't do well: variables, element defaults, shared text styles, and article styles. They are `global.css`, `type.css` and `prose.css`, all in `src/styles/`.
- **Almost everything is in a cascade layer.** The few rules that are not are listed below, with the reason for each. The two color-token blocks are the only unlayered rules in our own CSS files.
- **No `!important` anywhere in `src/`.** Layers make the winner predictable, and `!important` throws that away.
- **Inline `style` only sets a CSS variable** from data, like a pill's color. A Tailwind class reads the variable.

Five guard tests in `tests/styles/css-rules.test.ts` fail if any of that stops being true.

## Which rule wins: the cascade

CSS has a feature called cascade layers. When two rules disagree, the one in the later layer wins, no matter how specific its selector is. Rules outside every layer ("unlayered") beat every layer. Tailwind puts its output in layers, and we put our own CSS in the same ones.

Weakest first:

| # | What | Where it comes from | Examples |
|---|------|---------------------|----------|
| 1 | **theme** layer | Tailwind, from `@theme` in `global.css` | `--color-gray-200`, `--font-sans`, `--spacing-4`, the type scale (`--text-xl`). Variables only, no rules. |
| 2 | **base** layer | Tailwind's reset (Preflight), then our element defaults in `global.css` | `body` color and font, headings, links, `img`, text selection, the focus ring |
| 3 | **components** layer | `type.css` and `prose.css` | The `.t-*` type roles, `.prose`, the reader-size hooks |
| 4 | **utilities** layer | Every Tailwind class in the markup, plus our own `@utility` rules in `global.css` | `flex`, `gap-4`, `text-accent-text`, `lg:grid`, `elevation-md`, `wrapper` |
| 5 | **Unlayered** | `:root` tokens, the About cursors, Astro and library CSS (see the next section) | `--accent-text: #ff4949` |
| 6 | **Inline `style`** | Markup | `style="--pill-color: #46d501"` |

What this means in practice:

- A **utility beats a role**, and a **role beats an element default**. So `class="t-lead mt-4"` works: the role sets the size and color, and `mt-4` adds spacing. A plain `a { color: ... }` can never beat a class.
- Row 5 beats everything above it. That is why we keep it nearly empty: an unlayered color or margin rule would silently beat every Tailwind class on that element.
- Row 6 (inline style) would also beat everything, which is why it is limited to setting variables. A variable changes nothing until a class reads it.

The order is declared by Tailwind itself (theme, base, components, utilities), so our `@layer base` and `@layer components` blocks slot in automatically.

## What lives in each file

### `src/styles/global.css`

| Part | Layer | What it does |
|------|-------|--------------|
| `@import "tailwindcss"` | builds all four layers | Includes Preflight, the reset |
| `@theme { ... }` | theme | Bridges the site's colors into Tailwind names (`--color-gray-200: var(--gray-200)`), declares the font stacks, the spacing scale, `--breakpoint-lg: 60em`, and the three animations (`--animate-*`) |
| `@custom-variant hover` | none (it is a rule for Tailwind, not CSS output) | Makes `hover:` mean plain `:hover`. Tailwind's own `hover:` only fires on devices that truly hover; the site has always applied hover styles on tap too |
| `@custom-variant dark` | none | Makes `dark:` follow the `.theme-dark` class on `<html>`, not the OS setting |
| `@utility wrapper`, `elevation-sm/md/lg` | utilities | `wrapper` is the 83rem page column. `elevation-*` apply the site's shadow variables, which flip in dark mode (Tailwind's own `shadow-*` classes bake in fixed values) |
| `@utility btn`, `icon-control` | utilities | The two button styles (see "Buttons" below) |
| `:root`, `:root.theme-dark` | **unlayered** | The color, gradient and shadow tokens, light and dark |
| `@layer base { ... }` | base | `html`/`body` sizing, `body` font and color, heading defaults (weight, color, line height, **no size**), `a`, `img`, `::selection`, the global focus ring |
| `@source not ...` | none | Keeps `docs/`, `tests/` and notes out of Tailwind's class scan (see "Things worth knowing") |

### `src/styles/type.css`

All in the components layer. The eleven `.t-*` roles: `t-display`, `t-page-title`, `t-article-title`, `t-summary`, `t-eyebrow`, `t-lead`, `t-section-heading`, `t-subheading`, `t-meta`, `t-link`, `t-small-link`. Each role is defined once and used by class on every page. Sizes come from Tailwind's default `--text-*` scale, which is never redefined.

**Links.** There is one link treatment, `.t-link`: `--accent-text`, an underline that is transparent at rest, and on hover and keyboard focus the color goes to `--accent-text-hover` and the underline to `currentColor` (a 0.2s transition on both). Put the class on every inline text link, with no other color or underline utility on the element. `.t-small-link` is only the size and weight (sm, 500) of Back, Previous and Next; those anchors carry `t-small-link t-link`. Links inside article text follow the same rule through `.prose a` in `prose.css`, with one difference: the underline is faint (40% of the text color) at rest, so a link in body copy does not depend on color alone. The two rules repeat each other's values and point to each other in comments; `tests/styles/links.test.ts` fails if they drift.

Links that are not inline text keep their own pattern, but their hover color is still `--accent-text-hover`: the project card, nav dropdown items, the Writing-list post titles and the Writing filters. (The primary button is the exception: it hovers its background, see "Buttons" below. The nav logo has no hover.) The test lists each one, with a reason, in an allow-list; any new `<a>` has to take `t-link` or join the list. The global `a` rule in `global.css` only sets the fallback color (`--accent-text`).

### Buttons

There are two button styles, each defined once in `global.css` as an `@utility`:

- **`btn`**, the filled button: `--accent-fill` with `--on-accent` text (dark, in both themes), 40px tall, 8px radius, `text-sm` 600 uppercase. On hover the fill goes to `--accent-fill-hover`; `:disabled` shows the wait cursor. Used by Hero's "Drop me a line", "Enter password" and "Unlock case study". Put layout on the element (`mt-5`, `w-full`, `w-fit`) and nothing that changes the fill, size or radius. The keyboard focus ring is the global one.
- **`icon-control`**, the round icon control: a page-colored circle (`--gray-999`, dark in dark mode) with a 1px `--accent-text` ring and icon, tinted with `--accent-overlay-hover` on hover and while its menu is open (`data-state='open'`). Used by the Aa reader trigger, the menu (≡) button and the theme toggle. It sets no size: the 2rem comes from the icon box inside it (`size-8 p-2`, icon at `1em`). That is also why the theme toggle can take it as is: its two icon boxes make a 4rem two-segment pill, and its sliding knob keeps its own `group-hover` darkening to `--accent-fill-hover`.

Dropdown items (`NavDropdown.tsx`, `ReaderSettings.tsx`) are list items, not buttons, but share the hover tint; a keyboard-highlighted item (`data-highlighted`) gets the same background and color as hover.

Left alone on purpose, each with its own look: the lightbox controls (white glyphs on the dark overlay, over photos), the filter buttons (text toggles that follow the link hover), the carousel trigger (the screenshot is the button) and the debug-panel easter egg. `tests/styles/buttons.test.ts` checks that every `<button>` and button-like `<a>` in `src/` takes `btn` or `icon-control`, or is on its allow-list with a reason, and that no button carries its own `bg-accent-fill`. A second scan covers every tag in `src/`: any element with an accent-fill background (`bg-accent-fill`, its hover, or an arbitrary `bg-[...accent-fill...]`, not counting `before:`/`after:`) must be a `btn` or on a small allow-list (the Pill label).

### `src/styles/prose.css`

All in the components layer. It holds two things:

1. **`.prose`**, the article body style, used by blog posts and case studies. It has to be CSS, not utilities, because the case-study HTML is decrypted in the browser and injected into the page, so there is no markup to put classes on. Every size inside is in `em`, so it scales with the reader's size choice. The default is 18px: body 18px, h2 24px (`4em / 3`), h3 20px (`10em / 9`), h4 18px (`1em`, set apart by weight).
2. **The reader hooks**, like `[data-reader-size='20'] [data-reader-enabled] .prose`. `src/lib/reader-prefs.ts` sets `data-reader-*` attributes on `<html>`; these rules turn them into the `--reader-size`, `--reader-leading` and `--reader-font` variables that `.prose` reads. They only apply inside `[data-reader-enabled]`, so a saved preference never restyles other pages. The defaults (18px, 1.7, sans) need no rule.

### Everything else

Component and page files carry no CSS of their own. Their styling is Tailwind classes in the markup. The one exception is `src/pages/about.astro` (below).

## What is still unlayered, and why

This is the full list, read from the built CSS. Nothing else is outside a layer.

| Rule | Where | Why it is outside a layer |
|------|-------|------------------------------------|
| `:root { ... }` and `:root.theme-dark { ... }` | `global.css` | **Variables, not rules, so they needn't be layered.** They don't style any element; they just define values that other rules read. Nothing competes with them, because only the dark block redefines the same names, and it wins by being more specific (`:root.theme-dark` beats `:root`). A layered copy would work too; they are left plain because layers add nothing for variables. The guard test checks that every declaration in these two blocks is a custom property, so a real rule can't slip in. They are also why dark mode works: the colors live here, and `@theme` only bridges to them. |
| `@keyframes modalFadeIn`, `reader-fade-in`, `fadeInFromTop` | written in `@theme` in `global.css`, emitted by Tailwind | Keyframes are named animations, not rules that match elements, so there is nothing for layers to order. The `animate-*` utilities (in the utilities layer) are what apply them. |
| `@property --tw-*` | emitted by Tailwind | Tailwind registers its internal variables. Not ours, not rules. |
| Five hover cursors: `:global(.about-img-1:hover)` to `-5` | `src/pages/about.astro`, its only `<style>` block | Each cursor is a data-URI SVG containing quotes, angle brackets and an emoji. As a Tailwind arbitrary value it would need heavy escaping and be unreadable. The block has a "Why not Tailwind:" comment, and the guard test requires one on any `<style>`. The rules only set `cursor`, which no utility sets on those images, so being unlayered beats nothing it shouldn't. |
| `.astro-route-announcer`, the `astro*` view-transition keyframes, and an unlayered `@media (prefers-reduced-motion)` view-transition rule | injected by Astro's `<ClientRouter />` | Framework CSS. Not ours to change. |
| react-tweet's stylesheet (`.react-tweet-theme` and its parts) | loaded on pages that embed a tweet | Third-party CSS, unlayered. Because it beats our layers, we scope around it: `.prose img:not(.react-tweet-theme img)` leaves its avatars alone, and the blog post centers and spaces the embed with its own unlayered `<style>` rule (`.post-content :global(.react-tweet-theme)`), because react-tweet sets the margin on its root and an unlayered rule beats any utility. |
| `.post-content :global(.react-tweet-theme) { margin: 2rem auto }` | `src/pages/writing/[...slug].astro`, its only `<style>` block | The answer to the row above: to beat react-tweet's unlayered margin, the override must be unlayered too. It has a "Why not Tailwind:" comment, and it sets only the embed's margin. |

Library CSS also contains a few `!important` declarations (Preflight's `[hidden]` rule, Astro's reduced-motion rule). The ban is on our own source in `src/`.

## The inline-style rule

> Inline `style` may only set custom properties (`--something`), from data.

There are three, and each is paired with a class that reads the variable:

| Where | Sets | Read by |
|-------|------|---------|
| `Pill.astro` | `--pill-color` (the pill's color from the project's front matter) | `bg-[var(--pill-color,var(--accent-fill))]` and the border |
| `PortfolioPreview.astro` | `--on-accent` on one pill, for projects with a custom pill text color | `text-(color:--on-accent)` in `Pill.astro` |
| `PhotoGallery.tsx` | `--aspect` (each photo's ratio) | `aspect-(--aspect)` |

The reason: a Tailwind class has to be written in full in the source, so it can't depend on a value that is only known when the page is built (a color from a content file, a photo's ratio). A variable can. Everything else, including every hover, focus and breakpoint style, is a class.

Two related rules, both enforced:

- No `<style>` tag inside a `.tsx` file (React components used to inject their own).
- Any `.astro` file with a `<style>` block must say `Why not Tailwind:` inside it.

**Not covered:** a few scripts set inline styles at runtime for state that is not styling: the About carousel moves its track with `transform`, the three overlays (PasswordModal, PhotoModal, CaseStudyCarousel) lock page scroll with `body.style.overflow`, and BackgroundEffect sets a `filter` (blur) on its container. These are JavaScript assignments, not markup attributes. The test lists exactly these uses and fails on any other `.style.x =`, `setAttribute('style', …)` or injected `<style>`, so they stay few.

**Also not covered:** in a template-literal style, a `${…}` is trusted to carry a value. The test makes sure each one sits after a `--name:` (so ``style={`--a: ${x}`}`` passes and ``style={`--a: 1; ${x}`}`` fails), but it can't check what the expression evaluates to.

## How to add a style

Work down this list and stop at the first one that fits.

1. **A Tailwind class in the markup.** Use scale values (`p-10`, `gap-4`) when they equal what you want, and project colors (`text-gray-200`, `bg-gray-999`, `text-accent-text`, `bg-accent-fill`). If the exact value isn't on the scale, use an arbitrary value for that one property (`rounded-[20px]`). Don't round to a nearby step. Write complete class names; Tailwind can't see a class built from pieces.
2. **An existing role** if it is text: put the `t-*` class on the element, then adjust spacing with utilities.
3. **A new role in `type.css`**, if several places need the same text style and none of the existing roles fit. Keep it inside `@layer components`.
4. **`prose.css`**, if it styles content you can't put classes on (the article body, decrypted case studies).
5. **A new token** if it is a color or shadow: define it in `:root` and `:root.theme-dark` in `global.css`, bridge it in `@theme` if you want a class for it, then use the class.
6. **Unlayered CSS, last resort, only to override something outside our layers** (a library's CSS, say). Put it in an `.astro` `<style>` block with a `Why not Tailwind:` comment saying why a class can't do the job.

Don't:

- add `!important` or Tailwind's `!` modifier;
- add a stylesheet file (the test lists the three allowed ones);
- put a rule outside a layer in `type.css` or `prose.css`;
- set anything except variables in inline `style`.

## Colors in one place

The reds have role tokens, and they resolve to the values main shipped: the logo red for text and fills, a slightly deeper red on hover, white text on fills. The owner chose the brand look over contrast: `#ff4949` is 3.3:1 on white and under white text, below AA (4.5:1) for normal-size text. To change a red, change a token here; components only read the roles.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--accent-text` | `#ff4949` | `#ff4949` | Links, back/prev/next, active filters, card CTA, focus rings, list markers, quote rules, switches |
| `--accent-text-hover` | `var(--accent-text)` | same | Hover for the above: the same red, so a link's hover is its underline and a list item's is the change from ink to red |
| `--accent-fill` | `#ff4949` | `#ff4949` | Backgrounds: `btn`, default pill, toggle knob |
| `--accent-fill-hover` | `#f54c4c` | `#f86161` | Hover for fills |
| `--on-accent` | `#ffffff` | `#ffffff` | Text on fills |
| `--brand` | `#ff4949` | `#ff4949` | The logo red. The same value as the roles today, but no UI code reads it, so the roles can move without touching the logo |
| `--accent-overlay-hover` | `hsla(0, 99%, 64%, 0.17)` | same | Tinted hover backgrounds, selection |

Project pills pick white or black text per project color at build time (`src/lib/pill-text.ts`); a test checks each work color at AA.

`tests/styles/color-tokens.test.ts` checks that the tokens hold these values.

## Things worth knowing

These were decided during the cleanup. Each is a place where the obvious approach would have changed something.

- **`hover:` fires on touch.** `@custom-variant hover` is plain `:hover` (see above), to keep tap-hover behavior.
- **Focus rings live in the base layer**, so a utility can override them. One side effect: an element with its own `rounded-*` keeps that radius when focused. Before, every focus ring forced a 2px radius.
- **Menus don't lock the page.** The nav dropdown and the Aa panel (Radix) are set to `modal={false}`. Radix's modal mode adds its own `!important` margin to `<body>` to hide the scrollbar jump, and removing the old override without it would shift the page when a menu opens. Cost: the page behind an open menu can still scroll, and both menus can be open at once.
- **Shadows use `elevation-*`**, not Tailwind's `shadow-*` classes, because Tailwind's bake in fixed colors instead of the site's `--shadow-*` variables.
- **Tailwind only scans real markup.** `@source not` excludes `docs/`, `tests/`, `.superpowers/` and the README. Without it, class names written as examples (in a doc, or a test that mentions `!` modifiers) generate real utilities in the built CSS, including important ones. Also, Tailwind only writes out the `@theme` variables something uses, so check a variable is actually referenced before assuming it exists in the built CSS.
- **Hook classes stay on elements even when they have no styling,** like `card`, `pill`, `back-link`, `post-content`. Scripts and tests find elements by them. Grep `src/` and `tests/` before removing one.
- **Breakpoints:** `lg:` is 60em, and `max-lg:` is below it. One-offs use arbitrary variants: `min-[50em]:` (Nav), `min-[64em]:` (Footer), `min-[70em]:` (the project card). The default `sm`, `md` and `xl` are unchanged and unused.
- **The Swiss layout experiment is deleted** (commit `0eeb7b2`). There is no `swiss.css` and no dev toggle. If it comes back, it will need unlayered rules to override utilities, which the guard tests would flag.

## The guard tests

All in `tests/styles/`. Run them with `npx vitest run tests`.

| File | Locks |
|------|-------|
| `css-rules.test.ts` | No `!important` or `!` modifier in `src/`; inline `style` only sets custom properties; no `<style>` in `.tsx`, and runtime `.style.x =` uses are an allow-list; every `.astro` `<style>` has `Why not Tailwind:`; `type.css` and `prose.css` are entirely in `@layer components`; `global.css` leaves only `:root` and `:root.theme-dark` unlayered, and those hold only custom properties; there are exactly three stylesheets |
| `type-guard.test.ts` | Every font size is on Tailwind's scale; the scale is never redefined; no old v3 token names |
| `type-roles.test.ts` | The roles exist and pages use them |
| `prose.test.ts` | `.prose` sizes, margins and reader hooks |
| `color-tokens.test.ts` | the red tokens hold main's values, brand only as a token |
| `links.test.ts` | One link style, `.t-link`; every `<a>` takes it or is on the allow-list |
| `buttons.test.ts` | `btn` and `icon-control` values; every button takes one or is on the allow-list; no button carries `bg-accent-fill` |
