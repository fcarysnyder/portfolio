import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Lightbox from '../Lightbox';

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
        className="carousel-trigger group relative mt-8 block w-full cursor-pointer border-none bg-transparent p-0"
        aria-label="View all screenshots"
      >
        <img
          src={images[0].src}
          alt={images[0].alt}
          className="h-auto w-full rounded-2xl elevation-md [transition:box-shadow_var(--theme-transition)] group-hover:elevation-lg"
        />
        <span className="carousel-badge mt-4 block text-center font-mono text-xs/[inherit] text-gray-400">
          {images.length} screenshots - click to browse
        </span>
      </button>

      {modalIndex !== null &&
        createPortal(
          <Lightbox
            overlayRef={overlayRef}
            onClose={close}
            onPrev={goPrev}
            onNext={goNext}
            prevLabel="Previous"
            nextLabel="Next"
          >
            <div onClick={(e) => e.stopPropagation()} className="cursor-default text-center">
              <img
                src={images[modalIndex].src}
                alt={images[modalIndex].alt}
                className="max-h-[85vh] max-w-[90vw] object-contain"
              />
              <p className="mt-3 text-sm/[inherit] text-[rgba(255,255,255,0.6)]">
                {modalIndex + 1} / {images.length} - {images[modalIndex].alt}
              </p>
            </div>
          </Lightbox>,
          document.body,
        )}
    </>
  );
}
