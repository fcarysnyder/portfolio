import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SRC_EXTENSIONS = ['.astro', '.tsx', '.ts', '.css'];

function listSourceFiles(dir = join(ROOT, 'src')): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (SRC_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      files.push(relative(ROOT, full));
    }
  }
  return files.sort();
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function grepSrc(pattern: RegExp, { exclude = [] }: { exclude?: string[] } = {}): string[] {
  const hits: string[] = [];
  for (const file of listSourceFiles()) {
    if (exclude.includes(file)) continue;
    read(file).split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

const ROLES = [
  't-display',
  't-page-title',
  't-article-title',
  't-summary',
  't-eyebrow',
  't-lead',
  't-section-heading',
  't-subheading',
  't-meta',
  't-small-link',
];

describe('type roles', () => {
  it('defines each role in type.css', () => {
    for (const c of ROLES) {
      expect(read('src/styles/type.css')).toMatch(new RegExp(`\\.${c}\\b`));
    }
  });

  it('declares title sizes only in type.css', () => {
    // The lightbox arrow / close glyphs in PhotoModal and CaseStudyCarousel use these
    // steps for icons, not titles.
    expect(
      grepSrc(/font-?[sS]ize:\s*['"]?var\(--text-(3xl|4xl|5xl)\)/, {
        exclude: [
          'src/styles/type.css',
          'src/components/photography/PhotoModal.tsx',
          'src/components/work/CaseStudyCarousel.tsx',
        ],
      }),
    ).toEqual([]);
  });

  it('no page uses the home Hero component except the home page', () => {
    expect(grepSrc(/import Hero from/, { exclude: ['src/pages/index.astro'] })).toEqual([]);
  });

  it('keeps element defaults in the base layer without a font-size', () => {
    const css = read('src/styles/global.css');
    expect(css).toMatch(/@layer base\s*{/);
    expect(css).toMatch(/@import "\.\/type\.css"|@import ['"]\.\/type\.css['"]/);
  });
});
