import React, { useState, useEffect, useRef } from 'react';
import ScrambleText from './ScrambleText';

interface FooterTyperProps {
  initialText: string;
  showCursor?: boolean;
  delay?: number;
}

const FooterTyper: React.FC<FooterTyperProps> = ({ initialText, showCursor = false, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <span ref={containerRef} style={{ display: 'grid', gridTemplateColumns: '1fr', width: 'fit-content' }}>
       {/* Ghost Layer */}
       <span 
          className="footer-typer-wrapper" 
          style={{ gridArea: '1 / 1', opacity: 0, visibility: 'hidden', pointerEvents: 'none' }} 
          aria-hidden="true"
        >
          {initialText}
       </span>

       {/* Active Layer */}
       <span className="footer-typer-wrapper" style={{ gridArea: '1 / 1', zIndex: 1 }}>
        <ScrambleText 
          text={initialText}
          speed={30}
          scrambleSpeed={50}
          showCursor={showCursor}
          start={isVisible}
          delay={delay}
        />
      </span>
    </span>
  );
};

export default FooterTyper;
