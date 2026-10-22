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

// Hex value of a token, following var() references, and falling back to the light value when
// dark doesn't redefine it.
function tok(mode: string, name: string): string {
  const pattern = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8}|var\\(--[\\w-]+\\))\\s*;`);
  const value = BLOCKS[mode].match(pattern) ?? BLOCKS.light.match(pattern);
  if (!value) throw new Error(`Token ${name} not found as a hex value or var() in ${mode}`);
  const ref = value[1].match(/^var\((--[\w-]+)\)$/);
  return ref ? tok(mode, ref[1]) : value[1].toLowerCase();
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

  // The owner rolled the reds back to what main shipped, under the role token names, then made the link
  // hover the button hover. #ff4949 is
  // not AA as text on white (3.3:1); that is a recorded choice, not an oversight.
  it.each([
    ['light', { '--accent-text': '#ff4949', '--accent-text-hover': '#f54c4c', '--accent-fill': '#ff4949', '--accent-fill-hover': '#f54c4c', '--on-accent': '#ffffff' }],
    ['dark', { '--accent-text': '#ff4949', '--accent-text-hover': '#f54c4c', '--accent-fill': '#e03e3e', '--accent-fill-hover': '#cc3838', '--on-accent': '#ffffff' }],
  ] as const)('%s: the red tokens resolve to main\'s values', (mode, values) => {
    for (const [name, value] of Object.entries(values)) expect(tok(mode, name), name).toBe(value);
  });

  it('changes only the fills in dark mode, each a step deeper than the last', () => {
    expect([...BLOCKS.dark.matchAll(/^\s*(--accent-[\w-]+)\s*:/gm)].map((m) => m[1]).sort()).toEqual(['--accent-fill', '--accent-fill-hover']);
    expect(contrast('#ffffff', tok('dark', '--accent-fill-hover'))).toBeGreaterThan(contrast('#ffffff', tok('dark', '--accent-fill')));
    expect(contrast('#ffffff', tok('dark', '--accent-fill'))).toBeGreaterThan(contrast('#ffffff', tok('light', '--accent-fill')));
  });

  it('defines the light fills as references to the text reds, not copies', () => {
    expect(BLOCKS.light).toMatch(/--accent-fill:\s*var\(--accent-text\);/);
    expect(BLOCKS.light).toMatch(/--accent-fill-hover:\s*var\(--accent-text-hover\);/);
    expect(BLOCKS.dark).not.toMatch(/--accent-text[\w-]*\s*:/);
  });

  it('has no brand token or brand utility (UI code reads the role tokens; the logo is an image)', () => {
    expect(grepSrc(/--brand\b|(?<![\w-])(?:[a-z0-9-]+:)*(?:[a-z]+-)+brand\b/)).toEqual([]);
  });

  // Every token in :root is used somewhere in src (outside its own definition and its @theme bridge).
  it('defines no unused color tokens', () => {
    const css = read('src/styles/global.css');
    const names = [...BLOCKS.light.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
    const unused = names.filter((name) => {
      const key = name.slice(2);
      const uses = grepSrc(new RegExp(`var\\(${name}\\)|\\(${name}\\)|\\([a-z-]+:${name}\\)|(?<![\\w-])(?:[\\w\\[\\]&=:.\\-/@()]*:)?(?:bg|text|border(?:-[trblxy])?|outline|ring|fill|stroke|decoration|from|to|via|divide|shadow|caret)-${key}(?![\\w-])|'${name}'`));
      const outside = uses.filter((h) => !h.startsWith('src/styles/global.css:') || !new RegExp(`(?:${name}|--color-${key})\\s*:`).test(h));
      return outside.length === 0;
    });
    expect(unused).toEqual([]);
    expect(css).toMatch(/--gray-0:/); // the check is not blind
  });
});
