import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Photo } from '../../data/photos';
import PhotoModal from './PhotoModal';

interface PhotoGalleryProps {
  photos: Photo[];
  years: number[];
}

type ViewMode = 'grid' | 'piles';

function seededRandom(index: number): number {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function getAspectValue(ratio: '3:2' | '4:5'): number {
  return ratio === '3:2' ? 3 / 2 : 4 / 5;
}

const GAP = 10;
const RADIUS = 10;

export default function PhotoGallery({ photos, years }: PhotoGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
        setViewMode('grid');
      } else if (yearValue === 'year') {
        setSelectedYear(null);
        setViewMode('piles');
      }
    };

    const filterBar = document.getElementById('filter-options');
    filterBar?.addEventListener('click', handler);
    return () => filterBar?.removeEventListener('click', handler);
  }, []);

  const handlePileClick = useCallback((year: number) => {
    setSelectedYear(year);
    setViewMode('grid');

    // Set "Grid" button active since we're switching to grid view
    document.querySelectorAll('.filter-option').forEach((btn) => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-year') === 'all') {
        btn.classList.add('active');
      }
    });
  }, []);

  // ── Grid renderer ──
  // Photos paired into rows of 2. Both photos in a row share the same
  // height — flex-grow is proportional to aspect ratio so a portrait
  // is narrow and a landscape is wide, but they're the same height.
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

    // Chunk items into pairs for a year group
    const chunkPairs = (items: { photo: Photo; idx: number }[]) => {
      const rows: { photo: Photo; idx: number }[][] = [];
      for (let i = 0; i < items.length; i += 2) {
        const row = [items[i]];
        if (i + 1 < items.length) row.push(items[i + 1]);
        rows.push(row);
      }
      return rows;
    };

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
          <div key={group.year} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

  // ── Pile renderer ──
  // 2 piles per row using the same flex layout as the photo grid.
  // Each pile card matches the row height of two 3:2 photos side by side.
  // Photos inside piles all use uniform 3:2 boxes for consistency.
  const renderPiles = () => {
    const photosByYear = new Map<number, { photo: Photo; originalIndex: number }[]>();
    photos.forEach((photo, idx) => {
      const list = photosByYear.get(photo.year) || [];
      list.push({ photo, originalIndex: idx });
      photosByYear.set(photo.year, list);
    });

    // Chunk years into rows of 2
    const pileRows: number[][] = [];
    for (let i = 0; i < years.length; i += 2) {
      const row = [years[i]];
      if (i + 1 < years.length) row.push(years[i + 1]);
      pileRows.push(row);
    }

    // Each pile is flex:1 in a 2-per-row layout (= half container width).
    // The grid's first row has a portrait (4:5=0.8) + landscape (3:2=1.5).
    // Row height = fullWidth / (0.8 + 1.5) = W / 2.3
    // Each pile width = W/2 (roughly, minus gap).
    // So pile aspect = (W/2) / (W/2.3) = 2.3/2 = 1.15
    // But the pile also includes the h2 label (~2rem) so we need slightly wider.
    const pileAspect = 1.15;

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
        {pileRows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: 'flex',
              gap: `${GAP}px`,
            }}
          >
            {row.map((year) => {
              const yearPhotos = photosByYear.get(year) || [];

              return (
                <div
                  key={year}
                  onClick={() => handlePileClick(year)}
                  style={{
                    width: `calc(50% - ${GAP / 2}px)`,
                    aspectRatio: `${pileAspect}`,
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Scattered photos — all uniform 3:2 boxes */}
                  {yearPhotos.map(({ photo, originalIndex }, stackIdx) => {
                    const rotation = (seededRandom(originalIndex) - 0.5) * 16;
                    const offsetX = (seededRandom(originalIndex + 100) - 0.5) * 10;
                    const offsetY = (seededRandom(originalIndex + 200) - 0.5) * 10;

                    return (
                      <div
                        key={originalIndex}
                        style={{
                          position: 'absolute',
                          width: '55%',
                          aspectRatio: '3 / 2',
                          transform: `translate(${offsetX}%, ${offsetY}%) rotate(${rotation}deg)`,
                          zIndex: stackIdx,
                          overflow: 'hidden',
                          borderRadius: `${RADIUS}px`,
                          boxShadow: 'var(--shadow-md)',
                          transition: 'transform 0.3s ease',
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

                  {/* Year label — centered below pile */}
                  <h2
                    style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 'var(--text-xl)',
                      color: 'var(--gray-0)',
                      margin: 0,
                      zIndex: yearPhotos.length + 1,
                    }}
                  >
                    {year}
                  </h2>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div style={{ width: '100%' }}>
        {viewMode === 'piles' ? renderPiles() : renderGrid()}
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
