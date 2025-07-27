import { useState } from 'react';
import '../styles/global.css';

interface PileProps {
  images: string[];
  href: string;
  year: string;
  title?: string;
}

/**
 * Pile component - displays a stack of up to 5 images with navigation buttons that appear on hover.
 * Images are stacked at angles with the most recent (index 0) on top.
 * Navigation brings images to the top of the stack.
 * 
 * Usage example:
 * <Pile 
 *   images={['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg']} 
 *   href="https://example.com"
 *   year="2023"
 *   title="Project Name"
 * />
 */

export default function Pile({ images, href, year, title = 'Image Stack' }: PileProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Limit to max 5 images
  const displayImages = images.slice(0, 5);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  // Calculate z-index and positioning for each image
  const getImageStyle = (index: number) => {
    const isActive = index === currentIndex;
    const stackPosition = (index - currentIndex + displayImages.length) % displayImages.length;
    
    // First image (top) is always horizontal (0 degrees)
    // Background images have varied angles like Figma
    const baseAngles = [0, -12, 8, -6, 15];
    const baseOffsets = [
      { x: 0, y: 0 },
      { x: -15, y: -10 },
      { x: 12, y: -8 },
      { x: -8, y: 5 },
      { x: 20, y: -5 }
    ];
    
    // On hover, spread images more
    const hoverMultiplier = isHovered ? 1.6 : 1;
    const angle = stackPosition === 0 ? 0 : (baseAngles[stackPosition] || 0) * hoverMultiplier;
    const offset = baseOffsets[stackPosition] || { x: 0, y: 0 };
    
    return {
      transform: `translate(${offset.x * hoverMultiplier}px, ${offset.y * hoverMultiplier}px) rotate(${angle}deg) scale(${stackPosition === 0 ? 1.1 : 1})`,
      zIndex: isActive ? 10 : 9 - stackPosition,
      transition: 'all 0.3s ease-in-out',
      boxShadow: stackPosition === 0 ? 'var(--shadow-md)' : 'var(--shadow-sm)'
    };
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
          {displayImages.map((image, index) => (
            <div
              key={index}
              className="pile-polaroid-frame"
              style={getImageStyle(index)}
            >
              <img
                className="pile-image"
                alt={`${title} image ${index + 1}`}
                src={image}
              />
            </div>
          ))}
        </div>
        
        {isHovered && (
          <>
            <button
              className="pile-nav-button pile-nav-left glass-button"
              onClick={prevImage}
              aria-label="Previous image"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" d="M216 128H40m72-72-72 72 72 72"/>
              </svg>
            </button>
            <button
              className="pile-nav-button pile-nav-right glass-button"
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