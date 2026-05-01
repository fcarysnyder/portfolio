import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PasswordModalProps {
  onSubmit: (password: string) => void;
  errorMessage: string | null;
  isSubmitting: boolean;
  onDismiss: () => void;
}

const MAILTO_HREF =
  'mailto:fcarysnyder@gmail.com' +
  '?subject=' + encodeURIComponent('Synthetic Readings Case Study - Access Request') +
  '&body=' + encodeURIComponent(
    "Hi Cary,\n\n" +
    "I'd like access to the Synthetic Readings case study on your portfolio.\n\n" +
    "About me / why I'm reading: \n\n" +
    "Thanks,\n",
  );

export default function PasswordModal({ onSubmit, errorMessage, isSubmitting, onDismiss }: PasswordModalProps) {
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        padding: '1.5rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--gray-999)',
          border: '1px solid var(--gray-800)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-md)',
          padding: '2rem',
          width: '100%',
          maxWidth: '28rem',
          fontFamily: 'var(--font-family-body)',
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-block',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--accent-regular)',
            textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          &larr; Back
        </a>
        <h2
          id="gate-title"
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 600,
            color: 'var(--gray-0)',
            marginBottom: '0.5rem',
          }}
        >
          Password required
        </h2>
        <p
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--gray-300)',
            marginBottom: '1.5rem',
            lineHeight: 1.6,
          }}
        >
          This case study is password-protected. Enter the password you received to read the full write-up.
        </p>

        <label
          htmlFor="gate-password"
          style={{
            display: 'block',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--gray-200)',
            marginBottom: '0.5rem',
          }}
        >
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
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: 'var(--font-size-base)',
            background: 'var(--gray-900)',
            border: `1px solid ${displayedError ? 'hsl(0 80% 60%)' : 'var(--gray-800)'}`,
            borderRadius: '0.5rem',
            color: 'var(--gray-0)',
            fontFamily: 'var(--font-family-mono)',
            marginBottom: '0.5rem',
          }}
        />

        {displayedError && (
          <p
            id="gate-error"
            role="alert"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'hsl(0 80% 65%)',
              marginBottom: '1rem',
            }}
          >
            {displayedError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: 'var(--font-size-base)',
            background: 'var(--accent-regular)',
            color: 'var(--accent-text-over)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isSubmitting ? 'wait' : 'pointer',
            fontWeight: 500,
            marginTop: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {isSubmitting ? 'Unlocking…' : 'Unlock case study'}
        </button>

        <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--gray-400)' }}>Don't have a password?</span>
          <a href={MAILTO_HREF} style={{ color: 'var(--accent-regular)', textDecoration: 'none' }}>
            Ask for access →
          </a>
        </p>
      </form>
    </div>,
    document.body,
  );
}
