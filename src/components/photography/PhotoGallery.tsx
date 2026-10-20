import { useState, useEffect, useRef, useMemo } from 'react';
import type { Photo } from '../../data/photos';
import PhotoModal from './PhotoModal';

interface PhotoGalleryProps {
  photos: Photo[];
  years: number[];
}

function getAspectValue(ratio: '3:2' | '4:5'): number {
  return ratio === '3:2' ? 3 / 2 : 4 / 5;
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const visiblePhotos = useMemo(() => {
    if (selectedYear !== null) {
      return photos.filter((p) => p.year === selectedYear);
    }
    return photos;
  }, [photos, selectedYear]);

  // Listen for filter clicks from the Astro page
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.matches('.filter-option')) return;

      document.querySelectorAll('.filter-option').forEach((btn) => btn.classList.remove('active'));
      target.classList.add('active');

      setModalIndex(null);
      const yearValue = target.getAttribute('data-year');
      if (yearValue === 'all') {
        setSelectedYear(null);
      } else {
        setSelectedYear(Number(yearValue));
      }
    };

    const filterBar = document.getElementById('filter-options');
    filterBar?.addEventListener('click', handler);
    return () => filterBar?.removeEventListener('click', handler);
  }, []);

  // Chunk items into pairs for row layout
  const chunkPairs = (items: { photo: Photo; idx: number }[]) => {
    const rows: { photo: Photo; idx: number }[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      const row = [items[i]];
      if (i + 1 < items.length) row.push(items[i + 1]);
      rows.push(row);
    }
    return rows;
  };

  const renderGrid = () => {
    if (visiblePhotos.length === 0) return null;

    // Group photos by year (descending)
    const yearGroups: { year: number; items: { photo: Photo; idx: number }[] }[] = [];
    const seenYears = new Set<number>();
    visiblePhotos.forEach((photo, idx) => {
      if (!seenYears.has(photo.year)) {
        seenYears.add(photo.year);
        yearGroups.push({ year: photo.year, items: [] });
      }
      yearGroups.find((g) => g.year === photo.year)!.items.push({ photo, idx });
    });
    yearGroups.sort((a, b) => b.year - a.year);

    return (
      <div ref={containerRef} className="flex w-full flex-col gap-[10px]">
        {yearGroups.map((group) => (
          <div key={group.year} className="flex flex-col gap-[10px]">
            <h2 className="t-subheading m-0">{group.year}</h2>
            {chunkPairs(group.items).map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-[10px]">
                {row.map(({ photo, idx }) => {
                  const aspect = getAspectValue(photo.aspectRatio);
                  return (
                    <div
                      key={`${photo.src}-${idx}`}
                      className="photo-card aspect-(--aspect) flex-(--aspect) cursor-zoom-in overflow-hidden rounded-[10px] elevation-sm [transition:box-shadow_var(--theme-transition)] hover:elevation-md"
                      onClick={() => setModalIndex(idx)}
                      style={{ '--aspect': aspect } as React.CSSProperties}
                    >
                      <img
                        src={photo.src}
                        alt={photo.title}
                        loading="lazy"
                        decoding="async"
                        className="block h-full w-full object-cover object-center"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="w-full">
        {renderGrid()}
      </div>

      {modalIndex !== null && (
        <PhotoModal
          photos={visiblePhotos}
          currentIndex={modalIndex}
          onClose={() => setModalIndex(null)}
          onNavigate={setModalIndex}
        />
      )}
    </>
  );
}
