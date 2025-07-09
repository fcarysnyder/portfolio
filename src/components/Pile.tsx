import { useState } from 'react';
import '../styles/global.css';

interface PileProps {
  images: string[];
  href: string;
  year: string;
  title?: string;
}

/**
 * Pile component - displays a stack of 5 images with navigation buttons that appear on hover.
 * The entire component acts as a link that opens in a new tab.
 * 
 * Usage example:
 * <Pile 
 *   images={['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg', '/path/to/image4.jpg', '/path/to/image5.jpg']} 
 *   href="https://example.com"
 *   year="2023"
 *   title="Project Name"
 * />
 */

export default function Pile({ images, href, year, title = 'Image Stack' }: PileProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleLinkClick = () => {
    window.location.href = href;
  };

  return (
    <div 
      className="pile-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleLinkClick}
      role="button"
      tabIndex={0}
      aria-label={`Open ${title} in new tab`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleLinkClick();
        }
      }}
    >
      <div className="pile-cards">
        <div className="pile-stack">
          {images.map((image, index) => (
            <div
              key={index}
              className={`pile-polaroid-frame pile-polaroid-frame-${index}`}
              style={{
                opacity: currentIndex === index ? 1 : 0,
                zIndex: currentIndex === index ? 10 : 5 - index,
              }}
            >
              <img
                className={`pile-image pile-image-${index}`}
                alt={`${title} image ${index + 1}`}
                src={image}
              />
            </div>
          ))}
        </div>
        
        {isHovered && (
          <>
            <button
              className="pile-nav-button pile-nav-left"
              onClick={prevImage}
              aria-label="Previous image"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" d="M216 128H40m72-72-72 72 72 72"/>
              </svg>
            </button>
            <button
              className="pile-nav-button pile-nav-right"
              onClick={nextImage}
              aria-label="Next image"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" d="M40 128h176m-72-72 72 72-72 72"/>
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="pile-year">{year}</div>
    </div>
  );
} 