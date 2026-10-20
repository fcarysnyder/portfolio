import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guards for the rules in docs/css-architecture.md: how the cascade is kept simple.
//   1. no important flag anywhere in src/
//   2. inline style only sets custom properties
//   3. no <style> in a .tsx
//   4. every .astro <style> block explains "Why not Tailwind:"
//   5. the CSS files have no stray unlayered rules

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

// Same helper style as the other guards: every line in src/ that matches.
function grepSrc(pattern: RegExp, only: (file: string) => boolean = () => true): string[] {
  const hits: string[] = [];
  for (const file of listSourceFiles().filter(only)) {
    read(file).split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

/** Blank out CSS and HTML comments, keeping line numbers, so a comment may mention a banned word. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

// ---------------------------------------------------------------------------
// 1. No important flag
// ---------------------------------------------------------------------------

describe('no !important', () => {
  it('has no !important in src/', () => {
    const hits: string[] = [];
    for (const file of listSourceFiles()) {
      const text = stripComments(read(file));
      for (const m of text.matchAll(/!\s*important/gi)) hits.push(`${file}:${lineOf(text, m.index!)}`);
    }
    expect(hits).toEqual([]);
  });

  it("uses no Tailwind important modifier (`!mt-0` or `mt-0!`) in class strings", () => {
    // Tailwind's modifier compiles to the same thing. Look at quoted strings only, one token at a time.
    const leading = /^(?:[^\s:]+:)*![a-z][a-z0-9]*-[^\s]*$/;
    const trailing = /^(?:[^\s:]+:)*[a-z][a-z0-9]*-[^\s]*!$/;
    const hits: string[] = [];
    for (const file of listSourceFiles().filter((f) => /\.(astro|tsx)$/.test(f))) {
      const text = stripComments(read(file));
      for (const lit of text.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
        for (const token of lit[2].split(/\s+/)) {
          if (leading.test(token) || trailing.test(token)) hits.push(`${file}:${lineOf(text, lit.index!)}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Inline style only sets custom properties
// ---------------------------------------------------------------------------

/** Text of a balanced `{ ... }` starting at `open` (the index of the opening brace), skipping strings. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** Drop `${ ... }` interpolations from template literals; the data they carry is allowed. */
function dropInterpolations(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$' && text[i + 1] === '{') {
      i += balanced(text, i + 1).length + 2;
      continue;
    }
    out += text[i];
  }
  return out;
}

/** Split on commas that are not inside brackets, braces, parentheses or strings. */
function topLevelEntries(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') {
      const start = i;
      for (i++; i < body.length && body[i] !== c; i++) if (body[i] === '\\') i++;
      current += body.slice(start, i + 1);
      continue;
    }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      entries.push(current);
      current = '';
    } else current += c;
  }
  entries.push(current);
  return entries.map((e) => e.trim()).filter(Boolean);
}

/** Reasons a `style` value is not custom-properties-only. Empty when it is fine. */
function styleProblems(value: string): string[] {
  const expr = value.trim();
  // style={{ '--aspect': aspect }} (React object): every key must be a custom property
  if (expr.startsWith('{')) {
    return topLevelEntries(balanced(expr, 0))
      .filter((entry) => !/^(['"`])--[\w-]+\1\s*:/.test(entry))
      .map((entry) => `key is not a custom property: ${entry.split(':')[0]}`);
  }
  // style="--x: 1" or style={`--x: ${y}`} (string): every declaration must start with `--`
  const literals = [...dropInterpolations(expr).matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  const bare = !/["'`]/.test(expr);
  if (bare) return [`cannot check a non-literal style value: ${expr}`];
  return literals
    .flatMap((text) => text.split(';'))
    .map((decl) => decl.trim())
    .filter((decl) => decl && !/^--[\w-]+\s*:/.test(decl))
    .map((decl) => `declaration is not a custom property: ${decl}`);
}

/** Every `style=` attribute in markup. A <style> block in a .astro file is CSS text, not markup. */
function inlineStyles(file: string): { line: number; problems: string[] }[] {
  const text = stripComments(read(file)).replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/[^\n]/g, ' '));
  const found: { line: number; problems: string[] }[] = [];
  for (const m of text.matchAll(/(?<![\w.$-])style\s*=\s*/g)) {
    const start = m.index! + m[0].length;
    const opener = text[start];
    let value: string;
    if (opener === '"' || opener === "'") {
      value = opener + text.slice(start + 1, text.indexOf(opener, start + 1)) + opener;
    } else if (opener === '{') {
      value = balanced(text, start);
    } else continue;
    found.push({ line: lineOf(text, m.index!), problems: styleProblems(value) });
  }
  return found;
}

describe('inline style', () => {
  const markupFiles = () => listSourceFiles().filter((f) => /\.(astro|tsx)$/.test(f));

  it('is only used to set custom properties', () => {
    const hits: string[] = [];
    for (const file of markupFiles()) {
      for (const { line, problems } of inlineStyles(file)) {
        for (const problem of problems) hits.push(`${file}:${line}: ${problem}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('still finds the known custom-property styles (the check is not blind)', () => {
    const all = markupFiles().flatMap((f) => inlineStyles(f).map((s) => ({ f, ...s })));
    const files = new Set(all.map((s) => s.f));
    expect(files).toContain('src/components/Pill.astro');
    expect(files).toContain('src/components/PortfolioPreview.astro');
    expect(files).toContain('src/components/photography/PhotoGallery.tsx');
  });

  it('rejects ordinary declarations', () => {
    expect(styleProblems("{ color: 'red' }")).not.toEqual([]);
    expect(styleProblems("{ '--a': 1, width: 2 }")).not.toEqual([]);
    expect(styleProblems('"color: red"')).not.toEqual([]);
    expect(styleProblems('`--a: ${x}; color: red`')).not.toEqual([]);
    expect(styleProblems('styles')).not.toEqual([]);
  });

  it('accepts custom properties', () => {
    expect(styleProblems("{ '--aspect': aspect }")).toEqual([]);
    expect(styleProblems('`--pill-color: ${color};`')).toEqual([]);
    expect(styleProblems("cond ? `--on-accent: ${c}` : ''")).toEqual([]);
    expect(styleProblems('"--a: 1; --b: 2"')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3 and 4. <style> blocks
// ---------------------------------------------------------------------------

describe('<style> blocks', () => {
  it('has none in a .tsx file', () => {
    const hits = grepSrc(/<style[\s>]|createElement\(\s*['"]style['"]/, (f) => f.endsWith('.tsx'));
    expect(hits).toEqual([]);
  });

  it('in a .astro file, each one says "Why not Tailwind:"', () => {
    const missing: string[] = [];
    for (const file of listSourceFiles().filter((f) => f.endsWith('.astro'))) {
      const text = read(file);
      for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
        if (!/Why not Tailwind:/.test(m[1])) missing.push(`${file}:${lineOf(text, m.index!)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Unlayered rules in the stylesheets
// ---------------------------------------------------------------------------

/** Heads of the top-level blocks of a stylesheet, comments removed. `@import` lines are included. */
function topLevel(path: string): string[] {
  const css = stripComments(read(path));
  const heads: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) heads.push(css.slice(start, i).trim().replace(/\s+/g, ' '));
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) start = i + 1;
    } else if (c === ';' && depth === 0) {
      const statement = css.slice(start, i).trim();
      if (statement) heads.push(statement.replace(/\s+/g, ' '));
      start = i + 1;
    }
  }
  return heads;
}

describe('unlayered CSS', () => {
  it('type.css and prose.css are entirely inside @layer components', () => {
    expect(topLevel('src/styles/type.css')).toEqual(['@layer components']);
    expect(new Set(topLevel('src/styles/prose.css'))).toEqual(new Set(['@layer components']));
  });

  it('global.css leaves only the token blocks outside a layer', () => {
    const layered = (head: string) => /^@(import|source|theme|custom-variant|utility|layer base)\b/.test(head);
    const unlayered = topLevel('src/styles/global.css').filter((head) => !layered(head));
    // :root and :root.theme-dark are custom properties, not rules that compete in the cascade
    expect(unlayered).toEqual([':root', ':root.theme-dark']);
  });

  it('has no other stylesheet in src/', () => {
    expect(listSourceFiles().filter((f) => f.endsWith('.css'))).toEqual([
      'src/styles/global.css',
      'src/styles/prose.css',
      'src/styles/type.css',
    ]);
  });
});
