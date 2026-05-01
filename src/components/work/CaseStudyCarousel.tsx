import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  images: { src: string; alt: string }[];
}

export default function CaseStudyCarousel({ images }: Props) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const goNext = useCallback(() => {
    setModalIndex((i) => (i !== null ? (i + 1) % images.length : null));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setModalIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null));
  }, [images.length]);

  const close = useCallback(() => setModalIndex(null), []);

  useEffect(() => {
    if (modalIndex === null) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    overlayRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': close(); break;
        case 'ArrowRight': goNext(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'Tab': e.preventDefault(); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [modalIndex, close, goNext, goPrev]);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalIndex(0)}
        className="carousel-trigger"
        aria-label="View all screenshots"
      >
        <img src={images[0].src} alt={images[0].alt} />
        <span className="carousel-badge">{images.length} screenshots - click to browse</span>
      </button>

      {modalIndex !== null &&
        createPortal(
          <div
            ref={overlayRef}
            tabIndex={-1}
            onClick={(e) => { if (e.target === overlayRef.current) close(); }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.9)',
              animation: 'modalFadeIn 0.2s ease-out',
              cursor: 'zoom-out',
            }}
          >
            <style>{`
              @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>

            <button
              onClick={close}
              aria-label="Close"
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', color: 'white',
                fontSize: '2rem', cursor: 'pointer', padding: '0.5rem',
                lineHeight: 1, opacity: 0.7, zIndex: 1,
              }}
            >
              &#x2715;
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="Previous"
              style={{
                position: 'absolute', left: '1rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', color: 'white', fontSize: '2.5rem',
                cursor: 'pointer', padding: '0.5rem', lineHeight: 1,
                opacity: 0.7, zIndex: 1,
              }}
            >
              &#x2039;
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="Next"
              style={{
                position: 'absolute', right: '1rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', color: 'white', fontSize: '2.5rem',
                cursor: 'pointer', padding: '0.5rem', lineHeight: 1,
                opacity: 0.7, zIndex: 1,
              }}
            >
              &#x203A;
            </button>

            <div onClick={(e) => e.stopPropagation()} style={{ cursor: 'default', textAlign: 'center' }}>
              <img
                src={images[modalIndex].src}
                alt={images[modalIndex].alt}
                style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
              />
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                {modalIndex + 1} / {images.length} - {images[modalIndex].alt}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
