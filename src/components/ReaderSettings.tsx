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
  applyReaderPrefs,
  loadSerifFont,
  parseReaderPrefs,
  saveReaderPrefs,
  stepOption,
  type ReaderFont,
  type ReaderPrefs,
} from '../lib/reader-prefs';
import '../styles/global.css';

// One style for every control in the panel: a bordered tile that tints on hover (ink turns the
// link red), presses in slightly, and shows its selected state with a red border. The global
// focus ring marks keyboard focus. At either end of a range a stepper is aria-disabled, not
// disabled: a disabled button drops keyboard focus out of the panel the moment it hits the end.
const SEGMENT =
  'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-800 bg-transparent text-gray-300 select-none motion-safe:[transition:color_var(--theme-transition),background-color_var(--theme-transition),border-color_var(--theme-transition),transform_0.1s_ease-out] not-aria-disabled:hover:bg-accent-overlay-hover not-aria-disabled:hover:text-accent-text motion-safe:not-aria-disabled:active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-pressed:border-accent-text aria-pressed:text-gray-0 forced-colors:aria-pressed:[outline:2px_solid_Highlight]';

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

/** Three lines, close together or far apart, with a caret: the spacing buttons' glyph. */
function SpacingGlyph({ loose }: { loose: boolean }) {
  const ys = loose ? [3, 9, 15] : [5, 9, 13];
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true">
      {ys.map((y) => (
        <line key={y} x1="1" x2="21" y1={y} y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <path d={loose ? 'M27 11l3-4 3 4z' : 'M27 7l3 4 3-4z'} fill="currentColor" />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
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
  const isDefault =
    prefs.font === READER_DEFAULTS.font && prefs.size === READER_DEFAULTS.size && prefs.leading === READER_DEFAULTS.leading;

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
                  className={SEGMENT}
                  aria-pressed={prefs.font === o.value}
                  aria-label={o.label}
                  title={o.label}
                  onClick={() => update({ font: o.value })}
                >
                  <span className={`${o.className} text-(length:--text-xl) leading-none`}>Aa</span>
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
                <SpacingGlyph loose={false} />
              </button>
              <button
                type="button"
                className={SEGMENT}
                aria-label="Looser line spacing"
                title="Looser"
                aria-disabled={prefs.leading === LEADINGS[LEADINGS.length - 1]}
                onClick={() => update({ leading: stepOption(LEADINGS, prefs.leading, 1) })}
              >
                <SpacingGlyph loose />
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
