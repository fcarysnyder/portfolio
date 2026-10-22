import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../../data/photos';
import Lightbox from '../Lightbox';

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

  return createPortal(
    <Lightbox
      overlayRef={overlayRef}
      onClose={onClose}
      onPrev={goPrev}
      onNext={goNext}
      prevLabel="Previous photo"
      nextLabel="Next photo"
    >
      <img
        src={photo.src}
        alt={photo.title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] cursor-default object-contain"
      />
    </Lightbox>,
    document.body
  );
}
