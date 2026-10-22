// src/components/ReaderSettings.tsx
//
// "Aa" reading settings in the nav. Lives in the persisted Nav, so it mounts once and survives
// View Transition navigations: visibility is recomputed on astro:after-swap and astro:page-load,
// and the panel closes before a navigation so a portaled panel is never left in a replaced body.
//
// A Popover, not a menu: the panel holds toggle and stepper buttons, which a menu can't contain.

import * as Popover from '@radix-ui/react-popover';
import { ALargeSmall, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import {
  LEADINGS,
  READER_DEFAULTS,
  READER_STORAGE_KEY,
  SIZES,
  WIDTHS,
  applyReaderPrefs,
  loadSerifFont,
  parseReaderPrefs,
  saveReaderPrefs,
  stepOption,
  type ReaderFont,
  type ReaderPrefs,
} from '../lib/reader-prefs';
import '../styles/global.css';

// One style for every control in the panel: a bordered tile that tints on hover (ink and border
// turn red), presses in slightly, and shows its selected state with a red border. The global
// focus ring marks keyboard focus. At either end of a range a stepper is aria-disabled, not
// disabled: a disabled button drops keyboard focus out of the panel the moment it hits the end.
const TILE =
  'flex cursor-pointer items-center justify-center rounded-lg border border-gray-800 bg-transparent text-gray-300 select-none motion-safe:[transition:color_var(--theme-transition),background-color_var(--theme-transition),border-color_var(--theme-transition),transform_0.1s_ease-out] not-aria-disabled:hover:bg-accent-overlay-hover not-aria-disabled:hover:text-accent-text not-aria-disabled:hover:border-accent-text motion-safe:not-aria-disabled:active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-pressed:border-accent-text aria-pressed:text-gray-0 forced-colors:aria-pressed:[outline:2px_solid_Highlight]';

const SEGMENT = `${TILE} h-10 gap-2`;

/** The font tiles: taller, with the face's name in a small caption under its "Aa". */
const SEGMENT_FONT = `${TILE} h-16 flex-col gap-1`;

/** The Reset button: the same tile with a text label. */
const SEGMENT_TEXT = `${SEGMENT} font-sans text-(length:--text-sm)`;

const FONT_OPTIONS: { value: ReaderFont; label: string; className: string }[] = [
  { value: 'sans', label: 'Sans serif', className: 'font-sans' },
  { value: 'serif', label: 'Serif', className: 'font-serif' },
];

/** Reading localStorage can itself throw (Safari with site data blocked), so never let it escape. */
function readStoredPrefs(): ReaderPrefs {
  try {
    return parseReaderPrefs(localStorage.getItem(READER_STORAGE_KEY));
  } catch {
    return { ...READER_DEFAULTS };
  }
}

function writeStoredPrefs(prefs: ReaderPrefs): void {
  try {
    saveReaderPrefs(localStorage, prefs);
  } catch {
    // localStorage global unavailable: the prefs still apply for this page view.
  }
}

/**
 * Three lines of text with a caret (▴ more, ▾ less): the spacing and width steppers' glyph.
 * Spacing moves the lines apart; width makes them longer.
 */
function LinesGlyph({ up, ys, span }: { up: boolean; ys: number[]; span: [number, number] }) {
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true">
      {ys.map((y) => (
        <line key={y} x1={span[0]} x2={span[1]} y1={y} y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <path d={up ? 'M27 11l3-4 3 4z' : 'M27 7l3 4 3-4z'} fill="currentColor" />
    </svg>
  );
}

/** A labelled row. `largeOnly` hides it below 60em, where the setting has no effect. */
function Row({ label, largeOnly, children }: { label: string; largeOnly?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={`${largeOnly ? 'hidden lg:grid' : 'grid'} grid-cols-[4.5rem_1fr] items-center gap-3`}
    >
      <span id={id} className="t-eyebrow">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function ReaderSettings() {
  const [visible, setVisible] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(READER_DEFAULTS);
  const [open, setOpen] = useState(false);

  // The persisted Nav is not re-rendered on navigation, so decide visibility from the live page.
  useEffect(() => {
    const sync = () => {
      setVisible(!!document.querySelector('[data-reader-enabled]'));
      setPrefs(readStoredPrefs());
    };
    sync();
    // after-swap shows the button with the new page; page-load stays as the catch-all (first load, back/forward).
    document.addEventListener('astro:after-swap', sync);
    document.addEventListener('astro:page-load', sync);
    return () => {
      document.removeEventListener('astro:after-swap', sync);
      document.removeEventListener('astro:page-load', sync);
    };
  }, []);

  // Back/forward (or any navigation) with the panel open: close it so the portaled panel
  // doesn't outlive the page it was opened on.
  useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener('astro:before-preparation', close);
    return () => document.removeEventListener('astro:before-preparation', close);
  }, []);

  const commit = useCallback((next: ReaderPrefs) => {
    applyReaderPrefs(document, next);
    writeStoredPrefs(next);
    setPrefs(next);
  }, []);

  const update = (patch: Partial<ReaderPrefs>) => commit({ ...prefs, ...patch });
  const isDefault = (Object.keys(READER_DEFAULTS) as (keyof ReaderPrefs)[]).every((k) => prefs[k] === READER_DEFAULTS[k]);

  // An empty fragment, not null: Astro's React renderer only recognizes a component that
  // returns an element, and a null return during SSR makes it log "Invalid hook call".
  if (!visible) return <></>;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Pick up changes made in another tab, and load Literata so the serif "Aa" shows in it.
          setPrefs(readStoredPrefs());
          loadSerifFont(document);
        }
      }}
    >
      <Popover.Trigger className="reader-trigger icon-control" aria-label="Reading settings">
        <span className="flex size-8 p-2 text-(length:--text-base)">
          <ALargeSmall size="1em" aria-hidden="true" />
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="reader-content z-10000 flex w-[18rem] flex-col gap-4 rounded-xl border border-gray-800 bg-gray-999 p-4 elevation-lg motion-safe:animate-reader-fade-in"
          sideOffset={8}
          align="end"
          collisionPadding={16}
          aria-label="Reading settings"
        >
          <Row label="Font">
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={SEGMENT_FONT}
                  aria-pressed={prefs.font === o.value}
                  aria-label={o.label}
                  onClick={() => update({ font: o.value })}
                >
                  <span className={`${o.className} text-(length:--text-xl) leading-none`} aria-hidden="true">
                    Aa
                  </span>
                  {/* The visible caption repeats the aria-label; it follows the tile's color (red on hover). */}
                  <span className="font-sans text-(length:--text-xs) leading-none" aria-hidden="true">
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
          </Row>

          <Row label="Size">
            <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
              <button
                type="button"
                className={SEGMENT}
                aria-label="Smaller text"
                aria-disabled={prefs.size === SIZES[0]}
                onClick={() => update({ size: stepOption(SIZES, prefs.size, -1) })}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              {/* Keyed by value so each change replays the fade-in: the number visibly ticks. */}
              <output
                key={prefs.size}
                aria-live="polite"
                className="text-center font-sans text-(length:--text-sm) font-semibold text-gray-0 tabular-nums motion-safe:animate-reader-fade-in"
              >
                {prefs.size}px
              </output>
              <button
                type="button"
                className={SEGMENT}
                aria-label="Larger text"
                aria-disabled={prefs.size === SIZES[SIZES.length - 1]}
                onClick={() => update({ size: stepOption(SIZES, prefs.size, 1) })}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </Row>

          <Row label="Spacing">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={SEGMENT}
                aria-label="Tighter line spacing"
                title="Tighter"
                aria-disabled={prefs.leading === LEADINGS[0]}
                onClick={() => update({ leading: stepOption(LEADINGS, prefs.leading, -1) })}
              >
                <LinesGlyph up={false} ys={[5, 9, 13]} span={[1, 21]} />
              </button>
              <button
                type="button"
                className={SEGMENT}
                aria-label="Looser line spacing"
                title="Looser"
                aria-disabled={prefs.leading === LEADINGS[LEADINGS.length - 1]}
                onClick={() => update({ leading: stepOption(LEADINGS, prefs.leading, 1) })}
              >
                <LinesGlyph up ys={[3, 9, 15]} span={[1, 21]} />
              </button>
            </div>
          </Row>

          <Row label="Width" largeOnly>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={SEGMENT}
                aria-label="Narrower column"
                title="Narrower"
                aria-disabled={prefs.width === WIDTHS[0]}
                onClick={() => update({ width: stepOption(WIDTHS, prefs.width, -1) })}
              >
                <LinesGlyph up={false} ys={[5, 9, 13]} span={[6, 16]} />
              </button>
              <button
                type="button"
                className={SEGMENT}
                aria-label="Wider column"
                title="Wider, up to the page width"
                aria-disabled={prefs.width === WIDTHS[WIDTHS.length - 1]}
                onClick={() => update({ width: stepOption(WIDTHS, prefs.width, 1) })}
              >
                <LinesGlyph up ys={[5, 9, 13]} span={[1, 21]} />
              </button>
            </div>
          </Row>

          <button
            type="button"
            className={SEGMENT_TEXT}
            aria-disabled={isDefault}
            onClick={() => commit({ ...READER_DEFAULTS })}
          >
            Reset to default
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
