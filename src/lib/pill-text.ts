/**
 * Picks the pill text color for a project's front-matter `color`: white or black, whichever
 * contrasts more. Runs at build time in Pill.astro, so each project color gets readable text
 * without a per-project override (main hard-coded black for CrossnoKaye's green).
 */

export const PILL_TEXT_LIGHT = '#ffffff';
export const PILL_TEXT_DARK = '#000000';

/** Parses #rgb, #rrggbb, rgb()/rgba() and hsl()/hsla() into 0–255 channels; alpha is ignored. */
export function parseColor(color: string): [number, number, number] | undefined {
	const c = color.trim().toLowerCase();
	const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
	if (hex) {
		const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join('') : hex[1];
		return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
	}
	const fn = c.match(/^(rgb|hsl)a?\(([^)]*)\)$/);
	if (!fn) return undefined;
	const parts = fn[2].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
	if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return undefined;
	if (fn[1] === 'rgb') return [parts[0], parts[1], parts[2]];
	const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
	return [f(0), f(8), f(4)].map((v) => v * 255) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
	const [R, G, B] = [r, g, b].map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(a: string, b: string): number {
	const [la, lb] = [a, b].map((x) => luminance(parseColor(x)!));
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The better of white and near-black on `background`, or undefined when the color can't be parsed. */
export function pillTextColor(background: string): string | undefined {
	if (!parseColor(background)) return undefined;
	return contrastRatio(PILL_TEXT_LIGHT, background) >= contrastRatio(PILL_TEXT_DARK, background)
		? PILL_TEXT_LIGHT
		: PILL_TEXT_DARK;
}
