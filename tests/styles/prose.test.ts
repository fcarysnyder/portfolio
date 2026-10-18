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
    const selectors = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
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

function allFontSizes(css: string): string[] {
  return [...css.matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map((m) => m[1].trim());
}

describe('prose styles', () => {
  it('sizes every prose element in em so reader settings keep the hierarchy', () => {
    expect(decl('.prose h2', 'font-size')).toBe('1.5em');
    expect(decl('.prose h3', 'font-size')).toBe('1.25em');
    expect(decl('.prose h4', 'font-size')).toBe('1.125em');
    expect(allFontSizes(prose).filter((v) => !/em$|^var\(--reader-size/.test(v))).toEqual([]);
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
});
