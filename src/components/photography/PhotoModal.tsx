import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../../data/photos';

interface PhotoModalProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function PhotoModal({ photos, currentIndex, onClose, onNavigate }: PhotoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const photo = photos[currentIndex];

  const goNext = useCallback(() => {
    onNavigate((currentIndex + 1) % photos.length);
  }, [currentIndex, photos.length, onNavigate]);

  const goPrev = useCallback(() => {
    onNavigate((currentIndex - 1 + photos.length) % photos.length);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    overlayRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'Tab':
          // Trap focus within modal
          e.preventDefault();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [onClose, goNext, goPrev]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      onClick={handleBackdropClick}
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

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '2rem',
          cursor: 'pointer',
          padding: '0.5rem',
          lineHeight: 1,
          opacity: 0.7,
          zIndex: 1,
        }}
      >
        &#x2715;
      </button>

      {/* Previous arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        aria-label="Previous photo"
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '2.5rem',
          cursor: 'pointer',
          padding: '0.5rem',
          lineHeight: 1,
          opacity: 0.7,
          zIndex: 1,
        }}
      >
        &#x2039;
      </button>

      {/* Next arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        aria-label="Next photo"
        style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '2.5rem',
          cursor: 'pointer',
          padding: '0.5rem',
          lineHeight: 1,
          opacity: 0.7,
          zIndex: 1,
        }}
      >
        &#x203A;
      </button>

      {/* Image */}
      <img
        src={photo.src}
        alt={photo.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
    </div>,
    document.body
  );
}
