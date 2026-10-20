import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { themeBootstrap } from '../../src/lib/theme';

/** Just enough of Document for the theme bootstrap. */
function makeDoc(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    classes,
    documentElement: {
      classList: {
        add: (c: string) => void classes.add(c),
        remove: (c: string) => void classes.delete(c),
        contains: (c: string) => classes.has(c),
      },
    },
  };
}

function storeWith(theme: string | null): Storage {
  return { getItem: () => theme } as unknown as Storage;
}

const throwingStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
} as unknown as Storage;

describe('themeBootstrap', () => {
  it('adds theme-dark when the saved theme is dark', () => {
    const doc = makeDoc();
    themeBootstrap(doc as unknown as Document, storeWith('dark'), false);
    expect(doc.classes.has('theme-dark')).toBe(true);
  });

  it('removes theme-dark when the saved theme is light', () => {
    const doc = makeDoc(['theme-dark']);
    themeBootstrap(doc as unknown as Document, storeWith('light'), true);
    expect(doc.classes.has('theme-dark')).toBe(false);
  });

  it('falls back to the system preference when nothing is saved', () => {
    const doc = makeDoc();
    themeBootstrap(doc as unknown as Document, storeWith(null), true);
    expect(doc.classes.has('theme-dark')).toBe(true);
  });

  it('falls back to the system preference when storage throws', () => {
    const doc = makeDoc();
    themeBootstrap(doc as unknown as Document, throwingStorage, true);
    expect(doc.classes.has('theme-dark')).toBe(true);
  });

  it('is self-contained when serialized', () => {
    const doc = makeDoc();
    const fn = new Function('doc', 'storage', `(${themeBootstrap.toString()})(doc, storage, false)`);
    fn(doc, storeWith('dark'));
    expect(doc.classes.has('theme-dark')).toBe(true);
  });
});

describe('MainHead theme script', () => {
  const src = readFileSync('src/components/MainHead.astro', 'utf8');

  // The server renders every page without theme-dark, and Astro copies the incoming page's
  // <html> attributes on swap. Theming only after the swap flips the persisted toggle to
  // light and back. The incoming document has to be themed before the swap.
  it('themes the incoming document before a View Transition swap', () => {
    expect(src).toMatch(/themeBootstrap/);
    expect(src).toMatch(/astro:before-swap[^)]*\)\s*\{\s*tb\(e\.newDocument\)/);
  });
});
