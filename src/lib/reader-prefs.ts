/*
 * Reader preferences: font, text size and line spacing for blog posts and case studies.
 *
 * Stored in localStorage and applied as data-reader-* attributes on <html>. The CSS hooks
 * in prose.css only act inside [data-reader-enabled], so a saved preference never restyles
 * other pages.
 */

export type ReaderFont = 'sans' | 'serif';
export type ReaderSize = 14 | 16 | 18 | 20;
export type ReaderLeading = 1.5 | 1.7 | 1.9;

export interface ReaderPrefs {
	font: ReaderFont;
	size: ReaderSize;
	leading: ReaderLeading;
}

export const READER_DEFAULTS: ReaderPrefs = { font: 'sans', size: 18, leading: 1.7 };

export const READER_STORAGE_KEY = 'reader-prefs';

export const LITERATA_HREF =
	'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap';

const SERIF_LINK_ID = 'reader-serif-font';

const FONTS: readonly ReaderFont[] = ['sans', 'serif'];
export const SIZES: readonly ReaderSize[] = [14, 16, 18, 20];
export const LEADINGS: readonly ReaderLeading[] = [1.5, 1.7, 1.9];

/** Parse stored preferences. Each field falls back to its default on its own. Never throws. */
export function parseReaderPrefs(raw: string | null): ReaderPrefs {
	let data: unknown = null;
	try {
		data = raw ? JSON.parse(raw) : null;
	} catch {
		data = null;
	}
	const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
	return {
		font: FONTS.includes(o.font as ReaderFont) ? (o.font as ReaderFont) : READER_DEFAULTS.font,
		size: SIZES.includes(o.size as ReaderSize) ? (o.size as ReaderSize) : READER_DEFAULTS.size,
		leading: LEADINGS.includes(o.leading as ReaderLeading)
			? (o.leading as ReaderLeading)
			: READER_DEFAULTS.leading,
	};
}

/** Add the Literata stylesheet once. Also used by the settings panel so its serif "Aa" renders in Literata. */
export function loadSerifFont(doc: Document): void {
	if (doc.getElementById(SERIF_LINK_ID)) return;
	const link = doc.createElement('link');
	link.id = SERIF_LINK_ID;
	link.rel = 'stylesheet';
	link.href = LITERATA_HREF;
	doc.head.appendChild(link);
}

/** Set the data-reader-* attributes on <html>, and add the Literata stylesheet once when serif is active. */
export function applyReaderPrefs(doc: Document, prefs: ReaderPrefs): void {
	const root = doc.documentElement;
	root.setAttribute('data-reader-font', prefs.font);
	root.setAttribute('data-reader-size', String(prefs.size));
	root.setAttribute('data-reader-leading', String(prefs.leading));
	if (prefs.font === 'serif') loadSerifFont(doc);
}

/** The next allowed value in `options` after `value` (direction 1) or before it (-1), clamped at the ends. */
export function stepOption<T>(options: readonly T[], value: T, direction: 1 | -1): T {
	const i = options.indexOf(value);
	const next = Math.min(options.length - 1, Math.max(0, (i < 0 ? 0 : i) + direction));
	return options[next];
}

export function saveReaderPrefs(storage: Storage, prefs: ReaderPrefs): void {
	try {
		storage.setItem(READER_STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Storage can be unavailable (private mode, blocked site data). Preferences just won't persist.
	}
}

/*
 * Runs inline in <head> before paint, and again after each View Transition swap.
 *
 * Serialized with .toString() into an inline script, so it must stay self-contained: literal key,
 * literal URL, literal allowed values, its own validation, no references to anything in this module.
 * Keep the allowed values identical to parseReaderPrefs (a test compares the two).
 */
export function readerBootstrap(doc: Document = document, storage?: Storage): void {
	let raw: string | null = null;
	try {
		// Touching the localStorage global can itself throw (Safari with site data blocked), so resolve it here.
		raw = (storage || localStorage).getItem('reader-prefs');
	} catch {
		raw = null;
	}
	let data: any = null;
	try {
		data = raw ? JSON.parse(raw) : null;
	} catch {
		data = null;
	}
	const o = data && typeof data === 'object' ? data : {};
	const font = ['sans', 'serif'].indexOf(o.font) !== -1 ? o.font : 'sans';
	const size = [14, 16, 18, 20].indexOf(o.size) !== -1 ? o.size : 18;
	const leading = [1.5, 1.7, 1.9].indexOf(o.leading) !== -1 ? o.leading : 1.7;
	const root = doc.documentElement;
	root.setAttribute('data-reader-font', font);
	root.setAttribute('data-reader-size', String(size));
	root.setAttribute('data-reader-leading', String(leading));
	if (font === 'serif' && !doc.getElementById('reader-serif-font')) {
		const link = doc.createElement('link');
		link.id = 'reader-serif-font';
		link.rel = 'stylesheet';
		link.href =
			'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap';
		doc.head.appendChild(link);
	}
}
