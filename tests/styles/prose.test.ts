import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

const prose = read('src/styles/prose.css');

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

function decl(selector: string, prop: string): string | undefined {
  let found: string | undefined;
  for (const rule of rules(prose)) {
    if (!rule.selectors.includes(selector)) continue;
    const m = rule.body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`));
    if (m) found = m[1].trim();
  }
  return found;
}

/** Prose font sizes must be em (rem would ignore the reader size) or the reader size variable itself. */
const isAllowedFontSize = (v: string) => /^[\d.]+em$|^var\(--reader-size/.test(v);

function allFontSizes(css: string): string[] {
  return [...css.matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map((m) => m[1].trim());
}

describe('prose styles', () => {
  it('sizes every prose element in em so reader settings keep the hierarchy', () => {
    expect(decl('.prose h2', 'font-size')).toBe('1.5em');
    expect(decl('.prose h3', 'font-size')).toBe('1.25em');
    expect(decl('.prose h4', 'font-size')).toBe('1.125em');
    expect(allFontSizes(prose).filter((v) => !isAllowedFontSize(v))).toEqual([]);
  });

  it('lets prose headings follow the reader font instead of the base sans', () => {
    expect(decl('.prose :is(h2, h3, h4)', 'font-family')).toBe('inherit');
  });

  it('keeps embedded images out of the article image styles', () => {
    expect(decl('.prose img:not(.react-tweet-theme img)', 'width')).toBe('100%');
    expect(rules(prose).some((r) => r.selectors.includes('.prose img'))).toBe(false);
  });

  it('guards font sizes against rem', () => {
    expect(isAllowedFontSize('1.5em')).toBe(true);
    expect(isAllowedFontSize('var(--reader-size, 1rem)')).toBe(true);
    expect(isAllowedFontSize('1.5rem')).toBe(false);
  });

  it('reads reader preferences with defaults on the base rule', () => {
    expect(decl('.prose', 'font-size')).toBe('var(--reader-size, 1rem)');
    expect(decl('.prose', 'line-height')).toBe('var(--reader-leading, 1.7)');
    expect(decl('.prose', 'font-family')).toBe('var(--reader-font, var(--font-sans))');
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

  it('marks each article as reader-enabled and uses the shared header', () => {
    for (const page of ['src/pages/writing/[...slug].astro', 'src/pages/work/[...slug].astro']) {
      const src = read(page);
      expect(src).toMatch(/<article[^>]*data-reader-enabled/);
      expect(src).toMatch(/<PageHeader/);
    }
  });

  it('applies reader preference hooks only inside reader-enabled pages', () => {
    const hooks: [string, string, string][] = [
      ['size', '14', 'var(--text-sm)'],
      ['size', '18', 'var(--text-lg)'],
      ['size', '20', 'var(--text-xl)'],
    ];
    for (const [attr, value, size] of hooks) {
      expect(decl(`[data-reader-${attr}='${value}'] [data-reader-enabled] .prose`, '--reader-size')).toBe(size);
    }
    expect(decl(`[data-reader-leading='1.5'] [data-reader-enabled] .prose`, '--reader-leading')).toBe('1.5');
    expect(decl(`[data-reader-leading='1.9'] [data-reader-enabled] .prose`, '--reader-leading')).toBe('1.9');
    expect(decl(`[data-reader-font='serif'] [data-reader-enabled] .prose`, '--reader-font')).toBe('var(--font-serif)');
    // No hook may set a reader property outside the opt-in.
    for (const rule of rules(prose)) {
      if (/--reader-[a-z]+\s*:/.test(rule.body) && !rule.selectors.every((sel) => sel.includes('[data-reader-enabled]'))) {
        throw new Error(`reader property set outside [data-reader-enabled]: ${rule.selectors.join(', ')}`);
      }
    }
  });
});
