import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guards for the button rule in docs/css-architecture.md: one filled button (`btn`) and one
// round icon control (`icon-control`), each defined once in global.css. Every <button> and
// button-like <a> in src/ takes one of them, or is on the allow-list below with a reason.

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

/** The body of `@utility <name> { ... }`, with nested blocks kept, found by brace matching. */
function utilityBody(css: string, name: string): string | undefined {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = clean.match(new RegExp(`@utility ${name}\\s*\\{`));
  if (!start) return undefined;
  let depth = 1;
  let i = start.index! + start[0].length;
  const from = i;
  for (; i < clean.length && depth > 0; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') depth--;
  }
  return clean.slice(from, i - 1);
}

/** The declarations of a body outside any nested block, as { prop: value }. */
function topLevel(body: string): Record<string, string> {
  const flat = body.replace(/[^{};]*\{[^{}]*\}/g, '');
  const out: Record<string, string> = {};
  for (const m of flat.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  return out;
}

/** The declarations of the first nested block whose selector is `selector`. */
function nested(body: string, selector: string): Record<string, string> | undefined {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = body.match(new RegExp(`${esc}\\s*\\{([^{}]*)\\}`)) ?? body.match(new RegExp(`(?:[^{};]*,\\s*)?${esc}\\s*(?:,[^{};]*)?\\{([^{}]*)\\}`));
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const d of m[1].matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) out[d[1]] = d[2].trim().replace(/\s+/g, ' ');
  return out;
}

const globalCss = read('src/styles/global.css');

// ---------------------------------------------------------------------------
// The two utilities
// ---------------------------------------------------------------------------

describe('@utility btn', () => {
  const body = utilityBody(globalCss, 'btn');

  it('is defined once in global.css', () => {
    expect(body, '@utility btn').toBeDefined();
    expect(globalCss.match(/@utility btn\s*\{/g)).toHaveLength(1);
  });

  it('has the "Drop me a line" values', () => {
    const d = topLevel(body ?? '');
    expect(d).toMatchObject({
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      gap: '0.5rem',
      height: '2.5rem',
      'padding-inline': '1rem',
      border: 'none',
      'border-radius': '0.5rem',
      'background-color': 'var(--accent-fill)',
      color: 'var(--on-accent)',
      'font-size': 'var(--text-sm)',
      'line-height': '1.25rem',
      'font-weight': '600',
      'text-transform': 'uppercase',
      'text-decoration': 'none',
      cursor: 'pointer',
    });
  });

  it('lightens the fill on hover and shows a wait cursor when disabled', () => {
    expect(nested(body ?? '', '&:hover')).toMatchObject({ 'background-color': 'var(--accent-fill-hover)' });
    expect(nested(body ?? '', '&:disabled')).toMatchObject({ cursor: 'wait' });
  });
});

describe('@utility icon-control', () => {
  const body = utilityBody(globalCss, 'icon-control');

  it('is defined once in global.css', () => {
    expect(body, '@utility icon-control').toBeDefined();
    expect(globalCss.match(/@utility icon-control\s*\{/g)).toHaveLength(1);
  });

  it('is a round, ringed, accent-colored control', () => {
    expect(topLevel(body ?? '')).toMatchObject({
      display: 'flex',
      'border-radius': '999rem',
      border: 'none',
      'background-color': 'var(--gray-999)',
      'box-shadow': 'inset 0 0 0 1px var(--accent-text)',
      color: 'var(--accent-text)',
      cursor: 'pointer',
    });
  });

  it('tints the background on hover and while open', () => {
    expect(nested(body ?? '', '&:hover')).toMatchObject({ 'background-color': 'var(--accent-overlay-hover)' });
    expect(nested(body ?? '', "&[data-state='open']")).toMatchObject({ 'background-color': 'var(--accent-overlay-hover)' });
  });
});

// ---------------------------------------------------------------------------
// Every button in src/
// ---------------------------------------------------------------------------

/** Index of the `>` that closes an opening tag starting at `start`, skipping quotes and { } expressions. */
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

const hasClass = (tag: string, name: string) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(tag);

/** Every <button>, Radix trigger and button-like <a> (one that carries btn, icon-control or the button hook). */
function buttons(): { file: string; line: number; tag: string }[] {
  const out: { file: string; line: number; tag: string }[] = [];
  for (const file of listFiles()) {
    const text = read(file).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of text.matchAll(/<(button|a|[A-Za-z]+\.Trigger)(?=[\s>])/g)) {
      const tag = text.slice(m.index!, tagEnd(text, m.index!) + 1);
      const isAnchor = m[1] === 'a';
      if (isAnchor && !(hasClass(tag, 'btn') || hasClass(tag, 'icon-control') || hasClass(tag, 'button'))) continue;
      out.push({ file, line: text.slice(0, m.index!).split('\n').length, tag });
    }
  }
  return out;
}

/** Controls that deliberately do not take btn or icon-control. `match` must appear in the opening tag; a stale entry fails. */
const OWN_STYLE: { file: string; match: string; reason: string }[] = [
  { file: 'src/components/Lightbox.tsx', match: 'CONTROL', reason: 'close, previous and next glyphs: white on the dark overlay, over photos, so they cannot take the red fill' },
  { file: 'src/components/work/CaseStudyCarousel.tsx', match: 'carousel-trigger', reason: 'the screenshot itself is the trigger, an image with a hover shadow, not a labelled button' },
  { file: 'src/pages/photography/index.astro', match: 'filter-option', reason: 'year filters: text toggles that follow the link hover, styled by SectionHeader' },
  { file: 'src/components/BackgroundEffect.astro', match: 'toggle-debug-btn', reason: 'the debug-panel easter egg, hidden by default and not part of the design' },
];

describe('every button takes btn or icon-control, or is on the allow-list', () => {
  const all = buttons();
  const standard = (t: string) => hasClass(t, 'btn') || hasClass(t, 'icon-control');
  const without = all.filter((b) => !standard(b.tag));
  const entryMatches = (e: (typeof OWN_STYLE)[number], b: (typeof all)[number]) => b.file === e.file && b.tag.includes(e.match);

  it('finds the buttons (the scan is not blind)', () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.filter((b) => hasClass(b.tag, 'btn')).length).toBeGreaterThanOrEqual(3);
    expect(all.filter((b) => hasClass(b.tag, 'icon-control')).length).toBeGreaterThanOrEqual(3);
  });

  it('has no button outside the two styles and the allow-list', () => {
    const unlisted = without.filter((b) => !OWN_STYLE.some((e) => entryMatches(e, b)));
    expect(unlisted.map((b) => `${b.file}:${b.line}: ${b.tag.replace(/\s+/g, ' ').slice(0, 110)}`)).toEqual([]);
  });

  it('has no stale allow-list entry (each matches a control that lacks btn and icon-control)', () => {
    const stale = OWN_STYLE.filter((e) => !without.some((b) => entryMatches(e, b)));
    expect(stale.map((e) => `${e.file}: ${e.match}`)).toEqual([]);
  });

  it('gives every allow-list entry a reason', () => {
    for (const e of OWN_STYLE) expect(e.reason.length, `${e.file} ${e.match}`).toBeGreaterThan(10);
  });

  it('puts btn on the three filled buttons and icon-control on the three nav controls', () => {
    const has = (file: string, cls: string) => all.some((b) => b.file === file && hasClass(b.tag, cls));
    for (const file of ['src/components/Hero.astro', 'src/components/work/GatedContent.tsx', 'src/components/work/PasswordModal.tsx']) {
      expect(has(file, 'btn'), `${file} btn`).toBe(true);
    }
    for (const file of ['src/components/ThemeToggle.astro', 'src/components/ReaderSettings.tsx', 'src/components/NavDropdown.tsx']) {
      expect(has(file, 'icon-control'), `${file} icon-control`).toBe(true);
    }
  });

  it('keeps no button-level fill, ring or radius utility next to btn or icon-control', () => {
    const duplicated = all.filter(
      (b) =>
        standard(b.tag) &&
        /(?<![\w-])(bg-accent-fill|bg-gray-999|rounded-(?:lg|\[999rem\])|hover:bg-accent-(?:fill|overlay)-hover|text-on-accent)(?![\w-])|\[box-shadow:/.test(b.tag),
    );
    expect(duplicated.map((b) => `${b.file}:${b.line}`)).toEqual([]);
  });
});

describe('no button carries its own accent fill', () => {
  it('uses bg-accent-fill on no <button> or button-like <a>', () => {
    const hits = buttons().filter((b) => /(?<![\w-])bg-accent-fill(?![\w-])/.test(b.tag));
    expect(hits.map((b) => `${b.file}:${b.line}`)).toEqual([]);
  });
});
