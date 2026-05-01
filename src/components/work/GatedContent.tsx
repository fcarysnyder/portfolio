import { useEffect, useRef, useState } from 'react';
import PasswordModal from './PasswordModal';
import type { LockedFile } from '../../lib/crypto/schema';

const SESSION_KEY = 'unlock:synthetic-readings';

interface Props {
  lockedDataUrl: string;
}

type Status = 'loading' | 'locked' | 'unlocking' | 'unlocked' | 'load-error';

export default function GatedContent({ lockedDataUrl }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [html, setHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const lockedFileRef = useRef<LockedFile | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // On mount: check sessionStorage; otherwise fetch locked.json + auto-open modal.
  useEffect(() => {
    let cancelled = false;

    const cached = (() => {
      try {
        return sessionStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    })();

    if (cached) {
      setHtml(cached);
      setStatus('unlocked');
      return;
    }

    fetch(lockedDataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        return res.json();
      })
      .then((data: LockedFile) => {
        if (cancelled) return;
        lockedFileRef.current = data;
        setStatus('locked');
        setShowModal(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[gate] locked.json fetch failed', err);
        setStatus('load-error');
      });

    return () => {
      cancelled = true;
    };
  }, [lockedDataUrl]);

  const handleSubmit = (password: string) => {
    if (!lockedFileRef.current) return;
    setErrorMessage(null);
    setStatus('unlocking');

    // Lazily create the worker
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../lib/crypto/decrypt.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }
    const worker = workerRef.current;

    const timeout = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setErrorMessage('Something went wrong. Try refreshing.');
      setStatus('locked');
    }, 10000);

    const handleMessage = (event: MessageEvent) => {
      clearTimeout(timeout);
      worker.removeEventListener('message', handleMessage);
      const result = event.data as { ok: true; html: string } | { ok: false };
      if (result.ok) {
        try {
          sessionStorage.setItem(SESSION_KEY, result.html);
        } catch {
          // sessionStorage disabled or quota exceeded; continue without caching
        }
        setHtml(result.html);
        setStatus('unlocked');
        setShowModal(false);
      } else {
        setErrorMessage('Incorrect password.');
        setStatus('locked');
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ password, file: lockedFileRef.current });
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  if (status === 'unlocked') {
    return (
      <div className="gated-content" dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  if (status === 'load-error') {
    return (
      <div className="gated-placeholder">
        <p>We couldn't load this case study. Try refreshing, or <a href="mailto:fcarysnyder@gmail.com">email me</a>.</p>
      </div>
    );
  }

  return (
    <>
      <div className="gated-placeholder">
        {status === 'loading' && <p>Loading…</p>}
        {(status === 'locked' || status === 'unlocking') && (
          <>
            <p>This case study is password-protected.</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'var(--accent-regular)',
                color: 'var(--accent-text-over)',
                border: 'none',
                borderRadius: '0.5rem',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
              }}
            >
              Enter password
            </button>
          </>
        )}
      </div>
      {showModal && lockedFileRef.current && (
        <PasswordModal
          onSubmit={handleSubmit}
          errorMessage={errorMessage}
          isSubmitting={status === 'unlocking'}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
