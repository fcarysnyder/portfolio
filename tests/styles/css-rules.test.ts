import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guards for the rules in docs/css-architecture.md: how the cascade is kept simple.
//   1. no important flag anywhere in src/ (the keyword or Tailwind's ! modifier)
//   2. inline style only sets custom properties; runtime .style.x = uses are an allow-list
//   3. no <style> in a .tsx
//   4. every .astro <style> block explains "Why not Tailwind:"
//   5. the CSS files have no stray unlayered rules, and :root holds only custom properties

const ROOT = join(__dirname, '..', '..');
const SRC_EXTENSIONS = ['.astro', '.tsx', '.jsx', '.ts', '.js', '.mjs', '.css', '.md', '.mdx'];

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

const filesWith = (pattern: RegExp) => listSourceFiles().filter((f) => pattern.test(f));
const isProse = (file: string) => /\.mdx?$/.test(file);

/** Blank out CSS and HTML comments, keeping line numbers, so a comment may mention a banned word. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

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

// ---------------------------------------------------------------------------
// 1. No important flag
// ---------------------------------------------------------------------------

/**
 * Every string literal in some code: the text of "...", '...' and `...`, newlines included
 * (a single-quoted string stops at the end of its line, so an apostrophe in page text can't
 * swallow the rest of the file). A template literal's ${...} is scanned as code of its own.
 */
function stringLiterals(src: string, base = 0): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  for (let i = 0; i < src.length; i++) {
    const quote = src[i];
    if (quote !== '"' && quote !== "'" && quote !== '`') continue;
    let text = '';
    let j = i + 1;
    let closed = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '\\') {
        text += src.slice(j, j + 2);
        j++;
      } else if (c === quote) {
        closed = true;
        break;
      } else if (quote === "'" && c === '\n') {
        break;
      } else if (quote === '`' && c === '$' && src[j + 1] === '{') {
        const inner = balanced(src, j + 1);
        out.push(...stringLiterals(inner, base + j + 2));
        text += ' ';
        j += inner.length + 2;
      } else text += c;
    }
    if (!closed) continue;
    out.push({ text, index: base + i });
    i = j;
  }
  return out;
}

/** `lg:`, `max-lg:`, `[&>.x]:`, `data-[state=open]:` ... stripped off the front of a class token. */
function stripVariants(token: string): string {
  let t = token;
  for (;;) {
    const m = t.match(/^(?:[^:\[\]\s]*\[[^\]]*\][^:\[\]\s]*|[^:\[\]\s]+):/);
    if (!m) return t;
    t = t.slice(m[0].length);
  }
}

// What is left of a class token must look like a utility (flex, mt-0, w-[50%], [mask:none]), not a URL or a sentence.
const UTILITY = /^(?:[a-z][a-z0-9]*(?:-[^\s@?]*)?|\[[^\s@?]*\])$/;

/** Tailwind's important modifier: a `!` at the start or end of a utility, after any variants. */
export function isImportantToken(token: string): boolean {
  const t = stripVariants(token);
  const lead = t.startsWith('!');
  const trail = t.endsWith('!');
  if (!lead && !trail) return false;
  return UTILITY.test(t.slice(lead ? 1 : 0, trail ? -1 : undefined));
}

function importantTokens(text: string): { line: number; token: string }[] {
  const hits: { line: number; token: string }[] = [];
  for (const lit of stringLiterals(text)) {
    for (const token of lit.text.split(/\s+/)) {
      if (isImportantToken(token)) hits.push({ line: lineOf(text, lit.index), token });
    }
  }
  return hits;
}

describe('no !important', () => {
  it('has no !important in src/', () => {
    const hits: string[] = [];
    for (const file of listSourceFiles()) {
      const text = stripComments(read(file));
      // Prose says "important" a lot; only the exact keyword counts there.
      const pattern = isProse(file) ? /!important\b/gi : /!\s*important\b/gi;
      for (const m of text.matchAll(pattern)) hits.push(`${file}:${lineOf(text, m.index!)}`);
    }
    expect(hits).toEqual([]);
  });

  it('uses no Tailwind important modifier (a ! at either end of a utility) in any string', () => {
    // The modifier compiles to the same thing. Every quoted and template string is split into
    // class tokens, newlines included, so a multi-line className can't hide one.
    const hits: string[] = [];
    for (const file of filesWith(/\.(astro|tsx|jsx|ts|js|mjs)$/)) {
      for (const { line, token } of importantTokens(stripComments(read(file)))) hits.push(`${file}:${line}: ${token}`);
    }
    expect(hits).toEqual([]);
  });

  it('recognises the modifier in every form (the check is not blind)', () => {
    for (const bad of ['!hidden', 'hidden!', '!flex', 'mt-0!', '!mt-0', 'lg:!flex', 'lg:hover:flex!', 'max-lg:[&>.x]:!block', 'data-[state=open]:p-2!', '[mask:none]!', 'min-[50em]:!p-4']) {
      expect(isImportantToken(bad), bad).toBe(true);
    }
    for (const fine of ['hidden', 'mt-0', 'lg:flex', '!', 'Thanks!', 'mailto:me@example.com?subject=Hi%20there!', 'group-hover/card:flex', 'w-[50%]']) {
      expect(isImportantToken(fine), fine).toBe(false);
    }
    // multi-line template literal, with a ${} in the middle
    expect(importantTokens('const c = `flex\n  gap-2 ${open ? "p-2" : "p-4!"}\n  !hidden`;').map((h) => h.token).sort()).toEqual(['!hidden', 'p-4!']);
    // an apostrophe in page text does not hide a class string on a later line
    expect(importantTokens("<p>It's here</p>\n<div class=\"a\n!flex\">").map((h) => h.token)).toEqual(['!flex']);
  });
});

// ---------------------------------------------------------------------------
// 2. Inline style only sets custom properties
// ---------------------------------------------------------------------------

/** Replace each `${ ... }` in a template literal with a placeholder (it carries data, not CSS). */
const HOLE = '\u0000';
function holeInterpolations(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$' && text[i + 1] === '{') {
      i += balanced(text, i + 1).length + 2;
      out += HOLE;
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
export function styleProblems(value: string): string[] {
  const expr = value.trim();
  // style={{ '--aspect': aspect }} (React object): every key must be a custom property
  if (expr.startsWith('{')) {
    return topLevelEntries(balanced(expr, 0))
      .filter((entry) => !/^(['"`])--[\w-]+\1\s*:/.test(entry))
      .map((entry) => `key is not a custom property: ${entry.split(':')[0]}`);
  }
  // style="--x: 1" or style={`--x: ${y}`} (string): every declaration must start with `--name:`.
  // A ${} may only sit after that colon, as the value, so ``--a: 1; ${d}`` (a whole declaration
  // from data) fails.
  const literals = [...holeInterpolations(expr).matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  if (!/["'`]/.test(expr)) return [`cannot check a non-literal style value: ${expr}`];
  return literals
    .flatMap((text) => text.split(';'))
    .map((decl) => decl.trim())
    .filter((decl) => decl && !/^--[\w-]+\s*:/.test(decl))
    .map((decl) => `declaration is not a custom property: ${decl.replace(HOLE, '${…}')}`);
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

/**
 * Scripts that set a style at runtime, found by `file:property`. These are state, not styling, and
 * the doc lists them under "Not covered". Anything else fails; so does an entry that no longer exists.
 */
const RUNTIME_STYLE_ALLOW = new Set([
  'src/components/AboutHero.astro:transform', // the carousel track
  'src/components/BackgroundEffect.astro:filter', // blur on the background container
  'src/components/photography/PhotoModal.tsx:overflow', // body scroll lock
  'src/components/work/CaseStudyCarousel.tsx:overflow',
  'src/components/work/PasswordModal.tsx:overflow',
]);

function runtimeStyleWrites(file: string): { line: number; key: string }[] {
  const text = stripComments(read(file));
  const found: { line: number; key: string }[] = [];
  const add = (index: number, what: string) => found.push({ line: lineOf(text, index), key: `${file}:${what}` });
  for (const m of text.matchAll(/\.style\.(?!setProperty\b|removeProperty\b|getPropertyValue\b)(\w+)\s*=(?!=)/g)) add(m.index!, m[1]);
  for (const m of text.matchAll(/\.style\s*=(?!=)/g)) add(m.index!, 'style');
  for (const m of text.matchAll(/\.style\.setProperty\(\s*['"`](?!--)/g)) add(m.index!, 'setProperty(non-custom)');
  for (const m of text.matchAll(/setAttribute\(\s*['"`]style['"`]/g)) add(m.index!, 'setAttribute(style)');
  for (const m of text.matchAll(/createElement\(\s*['"`]style['"`]/g)) add(m.index!, 'createElement(style)');
  return found;
}

describe('inline style', () => {
  const markupFiles = () => filesWith(/\.(astro|tsx|jsx|ts|js|mjs|md|mdx)$/);

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
    expect(files).toContain('src/components/photography/PhotoGallery.tsx');
  });

  it('rejects ordinary declarations and whole declarations from data', () => {
    expect(styleProblems("{ color: 'red' }")).not.toEqual([]);
    expect(styleProblems("{ '--a': 1, width: 2 }")).not.toEqual([]);
    expect(styleProblems('"color: red"')).not.toEqual([]);
    expect(styleProblems('`--a: ${x}; color: red`')).not.toEqual([]);
    expect(styleProblems('styles')).not.toEqual([]);
    // the interpolation hole: a ${} that is a declaration of its own, not a value
    expect(styleProblems('`--a: 1; ${d}`')).not.toEqual([]);
    expect(styleProblems('`${d}: red`')).not.toEqual([]);
    expect(styleProblems('`--${name}: 1`')).not.toEqual([]);
  });

  it('accepts custom properties', () => {
    expect(styleProblems("{ '--aspect': aspect }")).toEqual([]);
    expect(styleProblems('`--pill-color: ${color};`')).toEqual([]);
    expect(styleProblems("cond ? `--on-accent: ${c}` : ''")).toEqual([]);
    expect(styleProblems('"--a: 1; --b: 2"')).toEqual([]);
    expect(styleProblems('`--a: ${x}; --b: ${y}`')).toEqual([]);
  });

  it('sets styles from scripts only in the documented places', () => {
    const found = filesWith(/\.(astro|tsx|jsx|ts|js|mjs)$/).flatMap(runtimeStyleWrites);
    const unexpected = found.filter((w) => !RUNTIME_STYLE_ALLOW.has(w.key)).map((w) => `${w.key} (line ${w.line})`);
    expect(unexpected).toEqual([]);
    // keep the allow-list, and the doc that cites it, honest
    const seen = new Set(found.map((w) => w.key));
    expect([...RUNTIME_STYLE_ALLOW].filter((key) => !seen.has(key))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3 and 4. <style> blocks
// ---------------------------------------------------------------------------

describe('<style> blocks', () => {
  it('has none in a .tsx file (the whole file is scanned, so a split tag is caught)', () => {
    const hits: string[] = [];
    for (const file of filesWith(/\.(tsx|jsx)$/)) {
      const text = read(file);
      for (const m of text.matchAll(/<style(?=[\s>/])|createElement\(\s*['"`]style['"`]/g)) hits.push(`${file}:${lineOf(text, m.index!)}`);
    }
    expect(hits).toEqual([]);
  });

  it('in a .astro file, each one says "Why not Tailwind:"', () => {
    const missing: string[] = [];
    for (const file of filesWith(/\.astro$/)) {
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

/** The top-level blocks of a stylesheet, comments removed. `@import` and `@source` lines have no body. */
function topLevel(path: string): { head: string; body: string }[] {
  const css = stripComments(read(path));
  const blocks: { head: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        blocks.push({ head: css.slice(start, open).trim().replace(/\s+/g, ' '), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (c === ';' && depth === 0) {
      const statement = css.slice(start, i).trim();
      if (statement) blocks.push({ head: statement.replace(/\s+/g, ' '), body: '' });
      start = i + 1;
    }
  }
  return blocks;
}

const heads = (path: string) => topLevel(path).map((b) => b.head);

describe('unlayered CSS', () => {
  it('type.css and prose.css are entirely inside @layer components', () => {
    expect(heads('src/styles/type.css')).toEqual(['@layer components']);
    expect(new Set(heads('src/styles/prose.css'))).toEqual(new Set(['@layer components']));
  });

  it('global.css leaves only the token blocks outside a layer', () => {
    // @import, @source, @theme, @custom-variant and @utility are not rules in the cascade. @layer base must match exactly.
    const notARule = (head: string) => /^@(import|source|theme|custom-variant|utility)\b/.test(head) || head === '@layer base';
    const unlayered = heads('src/styles/global.css').filter((head) => !notARule(head));
    // :root and :root.theme-dark are custom properties, not rules that compete in the cascade
    expect(unlayered).toEqual([':root', ':root.theme-dark']);
  });

  it('the unlayered :root and :root.theme-dark blocks hold only custom properties', () => {
    const tokenBlocks = topLevel('src/styles/global.css').filter((b) => b.head === ':root' || b.head === ':root.theme-dark');
    expect(tokenBlocks).toHaveLength(2);
    const offenders = tokenBlocks.flatMap((b) =>
      b.body
        .split(';')
        .map((decl) => decl.trim())
        .filter((decl) => decl && !/^--[\w-]+\s*:/.test(decl))
        .map((decl) => `${b.head} { ${decl} }`),
    );
    expect(offenders).toEqual([]);
  });

  it('has no other stylesheet in src/', () => {
    expect(filesWith(/\.css$/)).toEqual(['src/styles/global.css', 'src/styles/prose.css', 'src/styles/type.css']);
  });
});
