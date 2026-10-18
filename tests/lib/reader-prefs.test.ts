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
    expect(parseReaderPrefs('{"font":"serif","size":20,"leading":1.9}')).toEqual({ font: 'serif', size: 20, leading: 1.9 }));

  it('falls back per field', () => {
    expect(parseReaderPrefs('{"font":"comic","size":17}')).toEqual(READER_DEFAULTS);
    expect(parseReaderPrefs('{"font":"serif","size":17,"leading":1.5}')).toEqual({ font: 'serif', size: 16, leading: 1.5 });
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
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 18, leading: 1.5 });
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 18, leading: 1.5 });
    expect(doc.attrs).toEqual({ 'data-reader-font': 'serif', 'data-reader-size': '18', 'data-reader-leading': '1.5' });
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
    saveReaderPrefs(storage, { font: 'serif', size: 20, leading: 1.9 });
    expect(JSON.parse(written[READER_STORAGE_KEY])).toEqual({ font: 'serif', size: 20, leading: 1.9 });
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
    expect(doc.attrs['data-reader-size']).toBe('16');
    expect(doc.attrs['data-reader-font']).toBe('sans');
    expect(doc.attrs['data-reader-leading']).toBe('1.7');
  });

  it('is self-contained when serialized', () => {
    const fn = new Function('doc', 'storage', `(${readerBootstrap.toString()})(doc, storage)`);
    fn(doc, storeWith('{"font":"serif"}'));
    expect(doc.attrs['data-reader-font']).toBe('serif');
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0].href).toBe(LITERATA_HREF);
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
    applyReaderPrefs(asDoc(doc), { font: 'serif', size: 16, leading: 1.7 });
    expect(doc.links).toHaveLength(1);
  });

  it('agrees with parseReaderPrefs on the same inputs', () => {
    const inputs = [
      null,
      '{oops',
      '{}',
      '{"font":"serif","size":20,"leading":1.9}',
      '{"font":"comic","size":17,"leading":2}',
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
      });
    }
  });
});
