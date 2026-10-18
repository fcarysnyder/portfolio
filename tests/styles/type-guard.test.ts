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
