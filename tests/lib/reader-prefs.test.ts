import { describe, it, expect, beforeEach } from 'vitest';
import {
  READER_DEFAULTS,
  READER_STORAGE_KEY,
  LITERATA_HREF,
  parseReaderPrefs,
  applyReaderPrefs,
  saveReaderPrefs,
  readerBootstrap,
} from '../../src/lib/reader-prefs';

interface FakeEl {
  id?: string;
  rel?: string;
  href?: string;
}

/** Just enough of Document for the reader-prefs code: no DOM library in the node test environment. */
function makeDoc() {
  const attrs: Record<string, string> = {};
  const links: FakeEl[] = [];
  const doc = {
    attrs,
    links,
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
      getAttribute: (k: string) => attrs[k] ?? null,
    },
    head: {
      appendChild: (el: FakeEl) => {
        links.push(el);
        return el;
      },
    },
    createElement: (_tag: string): FakeEl => ({}),
    getElementById: (id: string) => links.find((l) => l.id === id) ?? null,
  };
  return doc;
}

function storeWith(raw: string | null): Storage {
  return {
    getItem: (k: string) => (k === 'reader-prefs' ? raw : null),
    setItem: () => {},
  } as unknown as Storage;
}

const throwingStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
} as unknown as Storage;

let doc: ReturnType<typeof makeDoc>;
beforeEach(() => {
  doc = makeDoc();
});

const asDoc = (d: ReturnType<typeof makeDoc>) => d as unknown as Document;

describe('parseReaderPrefs', () => {
  it('parses valid prefs', () =>
    expect(parseReaderPrefs('{"font":"serif","size":20,"leading":1.9,"width":"wide"}')).toEqual({ font: 'serif', size: 20, leading: 1.9, width: 'wide' }));

  it('falls back per field', () => {
    expect(parseReaderPrefs('{"font":"comic","size":17}')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs('{"font":"serif","size":17,"leading":1.5,"width":"huge"}')).toEqual({ font: 'serif', size: 18, leading: 1.5, width: 'normal' });
  });

  it('rejects wrong types', () => {
    expect(parseReaderPrefs('{"size":"20"}')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs('[1,2]')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs('null')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs('42')).toEqual(READER_DEFAULTS);
  });

  it('survives invalid JSON and null', () => {
    expect(parseReaderPrefs('{oops')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs(null)).toEqual(READER_DEFAULTS);
  });
});

describe('applyReaderPrefs', () => {
  it('applies attributes and loads Literata only once for serif', () => {
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 18, leading: 1.5, width: 'narrow' });
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 18, leading: 1.5, width: 'narrow' });
    expect(doc.attrs).toEqual({ 'data-reader-font': 'serif', 'data-reader-size': '18', 'data-reader-leading': '1.5', 'data-reader-width': 'narrow' });
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0]).toMatchObject({ id: 'reader-serif-font', rel: 'stylesheet', href: LITERATA_HREF });
  });

  it('does not load Literata for sans', () => {
    applyReaderPrefs(asDoc(doc), READER_DEFAULTS);
    expect(doc.links).toHaveLength(0);
  });
});

describe('saveReaderPrefs', () => {
  it('writes JSON under the storage key', () => {
    const written: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string) => (written[k] = v) } as unknown as Storage;
    saveReaderPrefs(storage, { font: 'serif', size: 20, leading: 1.9, width: 'wide' });
    expect(JSON.parse(written[READER_STORAGE_KEY])).toEqual({ font: 'serif', size: 20, leading: 1.9, width: 'wide' });
  });

  it('swallows storage errors', () => {
    expect(() => saveReaderPrefs(throwingStorage, READER_DEFAULTS)).not.toThrow();
  });
});

describe('readerBootstrap', () => {
  it('applies saved prefs', () => {
    readerBootstrap(asDoc(doc), storeWith('{"size":14}'));
    expect(doc.attrs['data-reader-size']).toBe('14');
  });

  it('survives a throwing storage', () => {
    readerBootstrap(asDoc(doc), throwingStorage);
    expect(doc.attrs['data-reader-size']).toBe('18');
    expect(doc.attrs['data-reader-font']).toBe('sans');
    expect(doc.attrs['data-reader-leading']).toBe('1.7');
    expect(doc.attrs['data-reader-width']).toBe('normal');
  });

  it('is self-contained when serialized', () => {
    const fn = new Function('doc', 'storage', `(${readerBootstrap.toString()})(doc, storage)`);
    fn(doc, storeWith('{"font":"serif"}'));
    expect(doc.attrs['data-reader-font']).toBe('serif');
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0].href).toBe(LITERATA_HREF);
  });

  it('prepares an incoming document before a View Transition swap', () => {
    const current = makeDoc();
    const incoming = makeDoc();
    const store = storeWith('{"font":"serif","size":18,"leading":1.9,"width":"wide"}');
    readerBootstrap(asDoc(current), store);
    readerBootstrap(asDoc(incoming), store);
    expect(incoming.attrs).toEqual({ 'data-reader-font': 'serif', 'data-reader-size': '18', 'data-reader-leading': '1.9', 'data-reader-width': 'wide' });
    expect(incoming.links).toHaveLength(1);
    expect(incoming.links[0]).toMatchObject({ id: 'reader-serif-font', href: LITERATA_HREF });
    // The safety-net run after the swap does not duplicate the link
    readerBootstrap(asDoc(incoming), store);
    expect(incoming.links).toHaveLength(1);
  });

  it('re-adds the Literata link only when missing', () => {
    readerBootstrap(asDoc(doc), storeWith('{"font":"serif"}'));
    readerBootstrap(asDoc(doc), storeWith('{"font":"serif"}'));
    expect(doc.links).toHaveLength(1);
    doc.links.length = 0; // a View Transition head merge dropped it
    readerBootstrap(asDoc(doc), storeWith('{"font":"serif"}'));
    expect(doc.links).toHaveLength(1);
  });

  it('shares one Literata link id with applyReaderPrefs', () => {
    readerBootstrap(asDoc(doc), storeWith('{"font":"serif"}'));
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 16, leading: 1.7, width: 'normal' });
    expect(doc.links).toHaveLength(1);
  });

  it('agrees with parseReaderPrefs on the same inputs', () => {
    const inputs = [
      null,
      '{oops',
      '{}',
      '{"font":"serif","size":20,"leading":1.9,"width":"narrow"}',
      '{"width":"full"}',
      '{"font":"comic","size":17,"leading":2,"width":7}',
      '{"font":"serif","size":17,"leading":1.5}',
      '{"size":"20"}',
      '[1]',
      'null',
    ];
    for (const raw of inputs) {
      const d = makeDoc();
      readerBootstrap(asDoc(d), storeWith(raw));
      const p = parseReaderPrefs(raw);
      expect(d.attrs).toEqual({
        'data-reader-font': p.font,
        'data-reader-size': String(p.size),
        'data-reader-leading': String(p.leading),
        'data-reader-width': p.width,
      });
    }
  });
});

describe('stepOption', () => {
  it('steps through the allowed values and stops at the ends', async () => {
    const { stepOption, SIZES, LEADINGS } = await import('../../src/lib/reader-prefs');
    expect(stepOption(SIZES, 18, 1)).toBe(20);
    expect(stepOption(SIZES, 20, 1)).toBe(20);
    expect(stepOption(SIZES, 14, -1)).toBe(14);
    expect(stepOption(LEADINGS, 1.7, -1)).toBe(1.5);
    const { WIDTHS } = await import('../../src/lib/reader-prefs');
    expect(stepOption(WIDTHS, 'wide', 1)).toBe('full');
    expect(stepOption(WIDTHS, 'full', 1)).toBe('full');
  });
});

describe('loadSerifFont', () => {
  it('adds the Literata stylesheet once', async () => {
    const { loadSerifFont } = await import('../../src/lib/reader-prefs');
    const d = makeDoc();
    loadSerifFont(d as unknown as Document);
    loadSerifFont(d as unknown as Document);
    expect(d.links.map((l) => l.href)).toEqual([LITERATA_HREF]);
  });
});
