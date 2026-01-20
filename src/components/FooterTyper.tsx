import React, { useState } from 'react';
import ScrambleText from './ScrambleText';

interface FooterTyperProps {
  initialText: string;
  showCursor?: boolean;
  delay?: number;
}

const FooterTyper: React.FC<FooterTyperProps> = ({ initialText, showCursor = false, delay = 0 }) => {
  return (
    <span style={{ display: 'grid', gridTemplateColumns: '1fr', width: 'fit-content' }}>
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
          start={true}
          delay={delay}
        />
      </span>
    </span>
  );
};

export default FooterTyper;
