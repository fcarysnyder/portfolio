import type { ReactNode, RefObject } from 'react';

/**
 * Shared chrome for the two lightboxes (photography PhotoModal, case-study CaseStudyCarousel):
 * the full-screen backdrop, the close button and the previous / next arrows. Each caller keeps
 * its own focus handling and keyboard shortcuts, and passes its content as children.
 */

interface LightboxProps {
  overlayRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}

const OVERLAY =
  'fixed inset-0 z-[10000] flex animate-modal-fade-in cursor-zoom-out items-center justify-center bg-[rgba(0,0,0,0.9)]';

const CONTROL = 'absolute z-1 cursor-pointer border-none bg-transparent p-2 text-white opacity-70';

export default function Lightbox({
  overlayRef,
  onClose,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  children,
}: LightboxProps) {
  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className={OVERLAY}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className={`${CONTROL} top-4 right-4 text-3xl/none`}
      >
        &#x2715;
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label={prevLabel}
        className={`${CONTROL} top-1/2 left-4 -translate-y-1/2 text-4xl/none`}
      >
        &#x2039;
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label={nextLabel}
        className={`${CONTROL} top-1/2 right-4 -translate-y-1/2 text-4xl/none`}
      >
        &#x203A;
      </button>

      {children}
    </div>
  );
}
