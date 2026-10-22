import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SRC_EXTENSIONS = ['.astro', '.tsx', '.ts', '.css'];

// Documented exceptions: the debug-panel easter egg, and the reader stylesheet
// that owns its own sizes.
const SKIPPED_FILES = new Set([
  'src/components/BackgroundEffect.astro',
  'src/styles/prose.css',
]);

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

function grepSrc(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of listSourceFiles()) {
    if (file === 'src/components/BackgroundEffect.astro') continue;
    read(file).split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

const ALLOWED_SIZE = /^var\(--text-[0-9a-z]+\)$/;

function offScaleFontSizes(): string[] {
  // CSS `font-size: X` and React `fontSize: 'X'`
  const declaration = /(?:font-size\s*:\s*([^;}\n]+)|fontSize\s*:\s*'([^']*)')/g;
  const offenders: string[] = [];
  for (const file of listSourceFiles()) {
    if (SKIPPED_FILES.has(file)) continue;
    read(file).split('\n').forEach((line, i) => {
      // font-size inside a data: URI sizes the cursor image, not text
      if (file === 'src/pages/about.astro' && line.includes('data:')) return;
      for (const match of line.matchAll(declaration)) {
        const value = (match[1] ?? match[2]).replace(/\s*!important$/, '').trim();
        if (value === 'inherit' || ALLOWED_SIZE.test(value)) continue;
        offenders.push(`${file}:${i + 1}: ${value}`);
      }
    });
  }
  return offenders;
}

describe('type scale guard', () => {
  it('uses no v3-named type tokens', () => {
    expect(grepSrc(/--font-size-|--font-family-/)).toEqual([]);
  });

  it('declares every font size on the Tailwind scale', () => {
    expect(offScaleFontSizes()).toEqual([]);
  });

  it('does not redefine the Tailwind text scale', () => {
    expect(read('src/styles/global.css')).not.toMatch(/@theme[^}]*--text-/s);
  });
});

// 600 is the heaviest weight on the site (owner's call). Covers CSS, Tailwind utilities,
// arbitrary values and inline styles in every source file, BackgroundEffect included.
const HEAVY_WEIGHT = /font-weight\s*:\s*(?:[7-9]00|bold(?:er)?)\b|fontWeight\s*:\s*['"]?(?:[7-9]00|bold)|(?<![\w-])(?:[a-z0-9-]+:)*font-(?:bold|extrabold|black|\[[7-9]00\])(?![\w-])/;

function heavyWeights(): string[] {
  const hits: string[] = [];
  for (const file of listSourceFiles()) {
    read(file).split('\n').forEach((line, i) => {
      if (HEAVY_WEIGHT.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

describe('font weight cap', () => {
  it('uses no weight above 600', () => {
    expect(heavyWeights()).toEqual([]);
  });

  it('caps <b> and <strong>, which Preflight sets to bolder (700)', () => {
    expect(read('src/styles/global.css')).toMatch(/b,\s*strong\s*\{\s*font-weight:\s*600;/);
  });

  it('recognises every heavy form (the check is not blind)', () => {
    for (const bad of ['font-weight: 700;', 'font-weight:bold', 'font-bold', 'aria-[current]:font-bold', 'font-extrabold', 'font-[800]', "fontWeight: 'bold'", 'fontWeight: 700']) {
      expect(HEAVY_WEIGHT.test(bad), bad).toBe(true);
    }
    for (const fine of ['font-weight: 600;', 'font-semibold', 'font-medium', 'font-[600]', 'font-bolder-x', 'wght@0,400..600']) {
      expect(HEAVY_WEIGHT.test(fine), fine).toBe(false);
    }
  });
});
