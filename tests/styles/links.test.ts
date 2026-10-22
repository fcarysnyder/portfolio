import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guards for the link rule in docs/css-architecture.md: one inline-link treatment (.t-link),
// plus the .prose a variant. Every <a> is either an inline text link with .t-link, or is on
// the allow-list below, with a reason.

const ROOT = join(__dirname, '..', '..');

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function listFiles(dir = join(ROOT, 'src')): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else if (/\.(astro|tsx)$/.test(name)) files.push(relative(ROOT, full));
  }
  return files.sort();
}

/** Flat rule parser: every `selectors { declarations }` block, ignoring comments and at-rule wrappers. */
function rules(css: string): { selectors: string[]; body: string }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selectors: string[]; body: string }[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(/,(?![^(]*\))/).map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectors[0].startsWith('@')) continue;
    out.push({ selectors, body: m[2] });
  }
  return out;
}

/** The last declaration of `prop` in any rule whose selector list includes `selector`. */
function decl(css: string, selector: string, prop: string): string | undefined {
  let found: string | undefined;
  for (const rule of rules(css)) {
    if (!rule.selectors.includes(selector)) continue;
    const m = rule.body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`));
    if (m) found = m[1].trim().replace(/\s+/g, ' ');
  }
  return found;
}

const typeCss = read('src/styles/type.css');
const proseCss = read('src/styles/prose.css');

// ---------------------------------------------------------------------------
// .t-link
// ---------------------------------------------------------------------------

describe('.t-link', () => {
  it('is defined once in type.css, with the CrossnoKaye treatment', () => {
    expect(rules(typeCss).filter((r) => r.selectors.includes('.t-link'))).toHaveLength(1);
    expect(decl(typeCss, '.t-link', 'color')).toBe('var(--accent-text)');
    expect(decl(typeCss, '.t-link', 'text-decoration')).toBe('underline 1px transparent');
    expect(decl(typeCss, '.t-link', 'text-underline-offset')).toBe('0.2em');
    expect(decl(typeCss, '.t-link', 'transition')).toBe(
      'color var(--theme-transition), text-decoration-color var(--theme-transition)',
    );
  });

  it('turns the color and the underline on at hover and keyboard focus', () => {
    for (const state of ['.t-link:hover', '.t-link:focus-visible']) {
      expect(decl(typeCss, state, 'color'), state).toBe('var(--accent-text-hover)');
      expect(decl(typeCss, state, 'text-decoration-color'), state).toBe('currentColor');
    }
  });

  it('keeps .t-small-link to size and weight', () => {
    expect(decl(typeCss, '.t-small-link', 'font-size')).toBe('var(--text-sm)');
    expect(decl(typeCss, '.t-small-link', 'font-weight')).toBe('500');
    const smallLinkRules = rules(typeCss).filter((r) => r.selectors.some((s) => s.startsWith('.t-small-link')));
    for (const rule of smallLinkRules) {
      expect(rule.body, rule.selectors.join(', ')).not.toMatch(/(?:^|[;\s])(color|text-decoration[\w-]*|transition)\s*:/);
    }
    expect(smallLinkRules.flatMap((r) => r.selectors).filter((s) => s !== '.t-small-link')).toEqual([]);
  });

  it('is not undone by any rule that removes the underline', () => {
    // A no-underline utility on the same element would beat the role (utilities layer).
    const hits = tags().filter((t) => hasClass(t.tag, 't-link') && /(?<![\w-])(no-underline|decoration-transparent|underline-offset-)/.test(t.tag));
    expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// .prose a: the same link with a faint underline at rest
// ---------------------------------------------------------------------------

describe('.prose a', () => {
  it('matches .t-link in color, offset, thickness, transition and hover', () => {
    expect(decl(proseCss, '.prose a', 'color')).toBe(decl(typeCss, '.t-link', 'color'));
    expect(decl(proseCss, '.prose a', 'text-underline-offset')).toBe(decl(typeCss, '.t-link', 'text-underline-offset'));
    expect(decl(proseCss, '.prose a', 'text-decoration-thickness')).toBe('1px');
    expect(decl(proseCss, '.prose a', 'transition')).toBe(decl(typeCss, '.t-link', 'transition'));
    expect(decl(proseCss, '.prose a', 'text-decoration-line') ?? decl(proseCss, '.prose a', 'text-decoration')).toMatch(/^underline/);
  });

  it('has the same hover and focus-visible state as .t-link', () => {
    for (const state of [':hover', ':focus-visible']) {
      expect(decl(proseCss, `.prose a${state}`, 'color'), state).toBe(decl(typeCss, `.t-link${state}`, 'color'));
      expect(decl(proseCss, `.prose a${state}`, 'text-decoration-color'), state).toBe(
        decl(typeCss, `.t-link${state}`, 'text-decoration-color'),
      );
    }
  });

  it('keeps a faint underline at rest, so a link does not rely on color alone', () => {
    expect(decl(proseCss, '.prose a', 'text-decoration-color')).toBe('color-mix(in srgb, currentColor 40%, transparent)');
  });

  it('points to .t-link, and .t-link to it, so the two are changed together', () => {
    expect(proseCss).toMatch(/\.t-link/);
    expect(typeCss).toMatch(/\.prose a/);
  });
});

// ---------------------------------------------------------------------------
// The element default and the list / navigation items
// ---------------------------------------------------------------------------

describe('link defaults and hover color', () => {
  it('uses --accent-text for the global a default', () => {
    expect(decl(read('src/styles/global.css'), 'a', 'color')).toBe('var(--accent-text)');
  });

  // Hover moves one step: ink at rest turns the link red; red at rest deepens to the button hover.
  it('turns ink-at-rest list and navigation items the link red on hover', () => {
    const items: [string, RegExp][] = [
      ['src/pages/writing/index.astro', /text-gray-0 [^"]*hover:text-accent-text(?![\w-])/],
      ['src/pages/writing/index.astro', /focus-visible:text-accent-text(?![\w-])/],
      ['src/components/NavDropdown.tsx', /text-gray-300 [^"]*hover:text-accent-text(?![\w-])/],
      ['src/components/NavDropdown.tsx', /data-highlighted:text-accent-text(?![\w-])/],
      ['src/components/ReaderSettings.tsx', /text-gray-300 [^']*not-aria-disabled:hover:text-accent-text(?![\w-])/],
      ['src/components/SectionHeader.astro', /\.filter-option:hover\]:text-accent-text(?![\w-])/],
      ['src/components/SectionHeader.astro', /\.filter-option:focus-visible\]:text-accent-text(?![\w-])/],
    ];
    for (const [file, pattern] of items) expect(read(file), `${file} ${pattern}`).toMatch(pattern);
  });

  it('deepens red-at-rest items to --accent-text-hover', () => {
    const items: [string, RegExp][] = [
      ['src/components/NavDropdown.tsx', /aria-\[current\]:hover:text-accent-text-hover/],
      ['src/components/NavDropdown.tsx', /aria-\[current\]:data-highlighted:text-accent-text-hover/],
      ['src/components/SectionHeader.astro', /\.filter-option\.active:hover\]:text-accent-text-hover/],
      ['src/components/PortfolioPreview.astro', /text-accent-text hover:text-accent-text-hover/],
    ];
    for (const [file, pattern] of items) expect(read(file), `${file} ${pattern}`).toMatch(pattern);
  });

  it('makes the light button hover the link hover token', () => {
    expect(read('src/styles/global.css')).toMatch(/--accent-fill-hover:\s*var\(--accent-text-hover\);/);
  });
});

// ---------------------------------------------------------------------------
// Every <a> in src/ is an inline link with .t-link, or an allow-listed non-inline link
// ---------------------------------------------------------------------------

/** Index of the `>` that closes an opening tag starting at `start`, skipping quotes and { } JSX / Astro expressions. */
function tagEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return text.length;
}

/** Every `<a ...>` opening tag in .astro and .tsx files (not <article>, <aside>, <abbr>). */
function tags(): { file: string; line: number; tag: string }[] {
  const out: { file: string; line: number; tag: string }[] = [];
  for (const file of listFiles()) {
    const text = read(file).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of text.matchAll(/<a(?=[\s>])/g)) {
      const end = tagEnd(text, m.index!);
      out.push({ file, line: text.slice(0, m.index!).split('\n').length, tag: text.slice(m.index!, end + 1) });
    }
  }
  return out;
}

const hasClass = (tag: string, name: string) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(tag);

/**
 * Links that are not inline text links, so they do not take .t-link. `match` is a string the
 * opening tag must contain; the entry must match at least one tag, or the test fails.
 */
const NOT_INLINE: { file: string; match: string; reason: string }[] = [
  { file: 'src/components/Hero.astro', match: 'class="button btn', reason: 'filled call-to-action button: the shared btn utility (dark text on the accent fill), not a text link' },
  { file: 'src/components/PortfolioPreview.astro', match: 'class="card', reason: 'whole project card is the link; its CTA line has its own hover' },
  { file: 'src/components/Nav.astro', match: 'href="/"', reason: 'site logo in the nav, gray text with no underline' },
  { file: 'src/components/NavDropdown.tsx', match: 'href={href}', reason: 'nav dropdown items, a list pattern: gray at rest, accent-text on hover, with a hover fill' },
  { file: 'src/pages/writing/index.astro', match: 'class="filter-option t-label"', reason: 'sort filters in the section header, a toggle group styled by SectionHeader' },
  { file: 'src/pages/writing/index.astro', match: 'text-gray-0', reason: 'post titles in the Writing list: gray-0 at rest, accent-text on hover' },
];

describe('every <a> is a .t-link or on the allow-list', () => {
  const all = tags();
  const without = all.filter((t) => !hasClass(t.tag, 't-link'));
  const entryMatches = (e: (typeof NOT_INLINE)[number], t: (typeof all)[number]) => t.file === e.file && t.tag.includes(e.match);

  it('finds the links (the scan is not blind)', () => {
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter((t) => hasClass(t.tag, 't-link')).length).toBeGreaterThan(5);
  });

  it('has no <a> without .t-link outside the allow-list', () => {
    const unlisted = without.filter((t) => !NOT_INLINE.some((e) => entryMatches(e, t)));
    expect(unlisted.map((t) => `${t.file}:${t.line}: ${t.tag.replace(/\s+/g, ' ').slice(0, 110)}`)).toEqual([]);
  });

  it('has no stale allow-list entry (each matches a link that lacks .t-link)', () => {
    const stale = NOT_INLINE.filter((e) => !without.some((t) => entryMatches(e, t)));
    expect(stale.map((e) => `${e.file}: ${e.match}`)).toEqual([]);
  });

  it('gives every allow-list entry a reason', () => {
    for (const e of NOT_INLINE) expect(e.reason.length, `${e.file} ${e.match}`).toBeGreaterThan(10);
  });
});
