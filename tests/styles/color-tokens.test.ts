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

// Scans every source file, including BackgroundEffect.astro.
function grepSrc(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of listSourceFiles()) {
    read(file).split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

const css = read('src/styles/global.css');

function block(selector: RegExp): string {
  const match = css.match(selector);
  if (!match) throw new Error(`No CSS block matching ${selector}`);
  return match[1];
}

const BLOCKS: Record<string, string> = {
  light: block(/^:root\s*\{([\s\S]*?)^\}/m),
  dark: block(/^:root\.theme-dark\s*\{([\s\S]*?)^\}/m),
};

// Value of a hex token, falling back to the light value when dark doesn't redefine it.
function tok(mode: string, name: string): string {
  const pattern = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`);
  const own = BLOCKS[mode].match(pattern);
  const value = own ?? BLOCKS.light.match(pattern);
  if (!value) throw new Error(`Token ${name} not found as a hex value in ${mode}`);
  return value[1].toLowerCase();
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('color tokens', () => {
  it('removes the old accent tokens from src', () => {
    expect(
      grepSrc(/--accent-(regular|dark|light|overlay(?!-)|subtle-overlay|text-over)|--link-color/),
    ).toEqual([]);
  });

  it.each(['light', 'dark'])('%s: accent text passes AAA on the page background', (mode) => {
    expect(contrast(tok(mode, '--accent-text'), tok(mode, '--gray-999'))).toBeGreaterThanOrEqual(7);
    expect(contrast(tok(mode, '--accent-text-hover'), tok(mode, '--gray-999'))).toBeGreaterThanOrEqual(7);
  });

  it.each(['light', 'dark'])('%s: text on accent fill passes AAA', (mode) => {
    expect(contrast(tok(mode, '--on-accent'), tok(mode, '--accent-fill'))).toBeGreaterThanOrEqual(7);
    expect(contrast(tok(mode, '--on-accent'), tok(mode, '--accent-fill-hover'))).toBeGreaterThanOrEqual(7);
  });

  it('fills use the same light red in both themes, with dark text on them', () => {
    expect(tok('light', '--accent-fill')).toBe(tok('dark', '--accent-fill'));
    expect(tok('light', '--accent-fill-hover')).toBe(tok('dark', '--accent-fill-hover'));
    expect(tok('light', '--on-accent')).toBe(tok('dark', '--on-accent'));
  });
  it('dark mode uses one red: text and fill are the same token value', () => {
    expect(tok('dark', '--accent-fill')).toBe(tok('dark', '--accent-text'));
  });
  it('uses the brand red only as a token (the logo is an image), never directly in UI code', () => {
    expect(grepSrc(/var\(--brand\)|(?<![\w-])(?:[a-z0-9-]+:)*(?:[a-z]+-)+brand\b/).filter((h) => !h.startsWith('src/styles/global.css:'))).toEqual([]);
  });
  it('keeps the brand red', () => {
    expect(tok('light', '--brand')).toBe('#ff4949');
    expect(tok('dark', '--brand')).toBe('#ff4949');
  });
});
