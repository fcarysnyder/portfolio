import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PasswordModalProps {
  onSubmit: (password: string) => void;
  errorMessage: string | null;
  isSubmitting: boolean;
  onDismiss: () => void;
  caseStudyTitle?: string;
}

export default function PasswordModal({ onSubmit, errorMessage, isSubmitting, onDismiss, caseStudyTitle }: PasswordModalProps) {
  const title = caseStudyTitle ?? 'Case Study';
  const mailtoHref =
    'mailto:fcarysnyder@gmail.com' +
    '?subject=' + encodeURIComponent(`${title} - Access Request`) +
    '&body=' + encodeURIComponent(
      "Hi Cary,\n\n" +
      `I'd like access to the ${title} case study on your portfolio.\n\n` +
      "About me / why I'm reading: \n\n" +
      "Thanks,\n",
    );
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
          'input, button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [onDismiss]);

  useEffect(() => {
    if (errorMessage) {
      setPassword('');
      inputRef.current?.focus();
    }
  }, [errorMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError('Enter a password to continue.');
      return;
    }
    setLocalError(null);
    onSubmit(password);
  };

  const displayedError = localError ?? errorMessage;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(0,0,0,0.7)] p-6 backdrop-blur-[4px]"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-999 p-8 font-sans elevation-md"
      >
        <a href="/" className="mb-6 inline-block text-sm/[inherit] font-medium text-accent-text no-underline">
          &larr; Back
        </a>
        <h2 id="gate-title" className="t-subheading mb-2">
          Password required
        </h2>
        <p className="mb-6 text-base/[1.6] text-gray-300">
          This case study is password-protected. Enter the password you received to read the full write-up.
        </p>

        <label htmlFor="gate-password" className="mb-2 block text-sm/[inherit] text-gray-200">
          Password
        </label>
        <input
          ref={inputRef}
          id="gate-password"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(displayedError)}
          aria-describedby={displayedError ? 'gate-error' : undefined}
          className={`mb-2 w-full rounded-lg border bg-gray-900 p-3 font-mono text-base/[inherit] text-gray-0 ${
            displayedError ? 'border-accent-text' : 'border-gray-800'
          }`}
        />

        {displayedError && (
          <p id="gate-error" role="alert" className="mb-4 text-sm/[inherit] text-accent-text">
            {displayedError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`mt-2 mb-6 w-full rounded-lg border-none bg-accent-fill p-3 text-base/[inherit] font-medium text-on-accent ${
            isSubmitting ? 'cursor-wait' : 'cursor-pointer'
          }`}
        >
          {isSubmitting ? 'Unlocking…' : 'Unlock case study'}
        </button>

        <p className="mt-2 flex items-center justify-between text-sm/[inherit]">
          <span className="text-gray-400">Don't have a password?</span>
          <a href={mailtoHref} className="text-accent-text no-underline">
            Ask for access →
          </a>
        </p>
      </form>
    </div>,
    document.body,
  );
}
