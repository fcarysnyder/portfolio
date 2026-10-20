// src/components/ReaderSettings.tsx
//
// "Aa" reading settings in the nav. Lives in the persisted Nav, so it mounts once and survives
// View Transition navigations: visibility is recomputed on astro:after-swap and astro:page-load,
// and the panel closes before a navigation so a portaled menu is never left in a replaced body.

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ALargeSmall, Check } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import {
  READER_DEFAULTS,
  READER_STORAGE_KEY,
  applyReaderPrefs,
  parseReaderPrefs,
  saveReaderPrefs,
  type ReaderFont,
  type ReaderLeading,
  type ReaderPrefs,
  type ReaderSize,
} from '../lib/reader-prefs';
import '../styles/global.css';

// Reader settings: the "Aa" trigger matches ThemeToggle's 2rem circle; the panel matches the nav menu.
// An option row's horizontal padding is added where it is used: the Reset row indents its label
// to line up with the option labels (check slot width plus gaps), so it can't share px-2.
// A checked row is bold and gray-0, but a highlighted row's accent color wins (not-data-highlighted).
// The focus ring is off (outline: none) because the highlight is the focus indicator.
const ITEM =
  'flex cursor-pointer items-center gap-2 rounded-md py-1.5 font-sans text-(length:--text-sm) leading-[1.4] text-gray-300 [outline:none] select-none data-highlighted:bg-accent-overlay-hover data-highlighted:text-accent-text data-[state=checked]:font-semibold data-[state=checked]:not-data-highlighted:text-gray-0 forced-colors:data-highlighted:[outline:2px_solid_Highlight]';

const FONT_OPTIONS: { value: ReaderFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
];

const SIZE_OPTIONS: { value: ReaderSize; label: string }[] = [
  { value: 14, label: 'S' },
  { value: 16, label: 'M' },
  { value: 18, label: 'L' },
  { value: 20, label: 'XL' },
];

const LEADING_OPTIONS: { value: ReaderLeading; label: string }[] = [
  { value: 1.5, label: 'Tight' },
  { value: 1.7, label: 'Normal' },
  { value: 1.9, label: 'Loose' },
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

interface OptionGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Show the raw value (e.g. "14px") next to the label. */
  showValue?: (value: T) => string;
}

function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  showValue,
}: OptionGroupProps<T>) {
  const labelId = useId();
  return (
    <>
      <DropdownMenu.Label className="t-eyebrow px-2 pt-2 pb-1" id={labelId}>
        {label}
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={String(value)}
        onValueChange={(next) => {
          const match = options.find((o) => String(o.value) === next);
          if (match) onChange(match.value);
        }}
        aria-labelledby={labelId}
      >
        {options.map((o) => (
          <DropdownMenu.RadioItem
            key={String(o.value)}
            value={String(o.value)}
            className={`${ITEM} px-2`}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="inline-flex size-3.5 text-accent-text">
              <DropdownMenu.ItemIndicator>
                <Check size={14} aria-hidden="true" />
              </DropdownMenu.ItemIndicator>
            </span>
            <span>{o.label}</span>
            {showValue && <span className="ml-auto font-normal text-gray-400">{showValue(o.value)}</span>}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
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

  // Back/forward (or any navigation) with the panel open: close it so the portaled menu
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
  const reset = () => commit({ ...READER_DEFAULTS });

  // An empty fragment, not null: Astro's React renderer only recognizes a component that
  // returns an element, and a null return during SSR makes it log "Invalid hook call".
  if (!visible) return <></>;

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Pick up changes made in another tab before showing the current values.
        if (next) setPrefs(readStoredPrefs());
      }}
    >
      <DropdownMenu.Trigger
        className="reader-trigger icon-control"
        aria-label="Reading settings"
      >
        <span className="flex size-8 p-2 text-(length:--text-base)">
          <ALargeSmall size="1em" aria-hidden="true" />
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="reader-content z-10000 min-w-[14rem] rounded-xl border border-gray-800 bg-gray-999 p-2 elevation-lg motion-safe:animate-reader-fade-in"
          sideOffset={8}
          align="end"
          collisionPadding={16}
        >
          <OptionGroup
            label="Font"
            value={prefs.font}
            options={FONT_OPTIONS}
            onChange={(font) => update({ font })}
          />
          <OptionGroup
            label="Size"
            value={prefs.size}
            options={SIZE_OPTIONS}
            onChange={(size) => update({ size })}
            showValue={(v) => `${v}px`}
          />
          <OptionGroup
            label="Spacing"
            value={prefs.leading}
            options={LEADING_OPTIONS}
            onChange={(leading) => update({ leading })}
          />
          <DropdownMenu.Separator className="mx-1 my-2 h-px bg-gray-800" />
          <DropdownMenu.Item
            className={`${ITEM} pr-2 pl-[calc(0.5rem_+_0.875rem_+_0.5rem)]`}
            onSelect={(e) => {
              e.preventDefault();
              reset();
            }}
          >
            Reset to default
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
