import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, parseColor, pillTextColor, PILL_TEXT_DARK, PILL_TEXT_LIGHT } from '../../src/lib/pill-text';

const WORK = join(__dirname, '..', '..', 'src', 'content', 'work');

/** Each work entry's front-matter `color`, which may sit on the line after the key. */
function workColors(): { file: string; color: string }[] {
  return readdirSync(WORK).flatMap((file) => {
    const front = readFileSync(join(WORK, file), 'utf8').split(/^---$/m)[1] ?? '';
    const m = front.match(/^color:[ \t]*(?:\n[ \t]+)?(.+)$/m);
    return m ? [{ file, color: m[1].trim().replace(/^["']|["']$/g, '') }] : [];
  });
}

describe('pill text', () => {
  it('parses hex, rgb and hsl', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#46D501')).toEqual([70, 213, 1]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(parseColor('hsla(0, 0%, 0%, 1.00)')).toEqual([0, 0, 0]);
    expect(parseColor('hsl(0 100% 50%)')!.map(Math.round)).toEqual([255, 0, 0]);
    expect(parseColor('var(--x)')).toBeUndefined();
  });

  it('picks the more readable of white and near-black', () => {
    expect(pillTextColor('hsla(0, 0%, 0%, 1.00)')).toBe(PILL_TEXT_LIGHT);
    expect(pillTextColor('#46D501')).toBe(PILL_TEXT_DARK);
    expect(pillTextColor('var(--x)')).toBeUndefined();
  });

  it('finds the work colors (the scan is not blind)', () => {
    expect(workColors().length).toBeGreaterThanOrEqual(3);
  });

  it('gives every project pill readable text (AA, 4.5:1, for its 12px label)', () => {
    for (const { file, color } of workColors()) {
      const text = pillTextColor(color);
      expect(text, `${file}: unparseable color ${color}`).toBeDefined();
      expect(contrastRatio(text!, color), `${file}: ${text} on ${color}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
