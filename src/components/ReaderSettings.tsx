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
import './ReaderSettings.css';

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
      <DropdownMenu.Label className="t-eyebrow reader-label" id={labelId}>
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
            className="reader-item"
            onSelect={(e) => e.preventDefault()}
          >
            <span className="reader-item-check">
              <DropdownMenu.ItemIndicator>
                <Check size={14} aria-hidden="true" />
              </DropdownMenu.ItemIndicator>
            </span>
            <span>{o.label}</span>
            {showValue && <span className="reader-item-value">{showValue(o.value)}</span>}
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
  // and its scroll lock don't outlive the page they were opened on.
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
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Pick up changes made in another tab before showing the current values.
        if (next) setPrefs(readStoredPrefs());
      }}
    >
      <DropdownMenu.Trigger className="reader-trigger" aria-label="Reading settings">
        <span className="reader-trigger-icon">
          <ALargeSmall size="1em" aria-hidden="true" />
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="reader-content"
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
          <DropdownMenu.Separator className="reader-separator" />
          <DropdownMenu.Item
            className="reader-item reader-reset"
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
