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

const GAP = 10;
const RADIUS = 10;

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
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${GAP}px`,
          width: '100%',
        }}
      >
        <style>{`
          .photo-card {
            box-shadow: var(--shadow-sm);
            transition: box-shadow var(--theme-transition);
          }
          .photo-card:hover {
            box-shadow: var(--shadow-md);
          }
        `}</style>
        {yearGroups.map((group) => (
          <div key={group.year} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
            <h2
              style={{
                fontSize: 'var(--text-xl)',
                color: 'var(--gray-0)',
                margin: 0,
              }}
            >
              {group.year}
            </h2>
            {chunkPairs(group.items).map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: 'flex',
              gap: `${GAP}px`,
            }}
          >
            {row.map(({ photo, idx }) => {
              const aspect = getAspectValue(photo.aspectRatio);
              return (
                <div
                  key={`${photo.src}-${idx}`}
                  className="photo-card"
                  onClick={() => setModalIndex(idx)}
                  style={{
                    flex: `${aspect}`,
                    aspectRatio: `${aspect}`,
                    borderRadius: `${RADIUS}px`,
                    overflow: 'hidden',
                    cursor: 'zoom-in',
                  }}
                >
                  <img
                    src={photo.src}
                    alt={photo.title}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      display: 'block',
                    }}
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
      <div style={{ width: '100%' }}>
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
