/**
 * Applies the saved theme (or the system preference) as `.theme-dark` on <html>.
 *
 * Serialized with `.toString()` into an inline <head> script by MainHead.astro, so it must be
 * self-contained: no references to anything outside this function body. The parameters exist
 * for tests and for theming the incoming document before a View Transition swap.
 */
export function themeBootstrap(doc?: Document, storage?: Storage, prefersDark?: boolean): void {
	var d = doc || document;
	var saved = null;
	try {
		saved = (storage || localStorage).getItem('theme');
	} catch (e) {
		// Storage blocked (e.g. Safari with site data disabled): fall through to the system preference.
	}
	var dark =
		saved === 'dark' ||
		(saved !== 'light' &&
			(prefersDark !== undefined
				? prefersDark
				: window.matchMedia('(prefers-color-scheme: dark)').matches));
	d.documentElement.classList[dark ? 'add' : 'remove']('theme-dark');
}
