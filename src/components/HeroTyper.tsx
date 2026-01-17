import React, { useState, useEffect } from 'react';
import ScrambleText from './ScrambleText';

interface HeroTyperProps {
  title: string;
  taglinePart1: string;
  linkText: string;
  linkUrl: string;
}

// Arrow Right Icon SVG
const ArrowRightIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 256 256"
    width="1em" 
    height="1em" 
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
     <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" d="M40 128h176m-72-72 72 72-72 72"/>
  </svg>
);

// Envelope Icon SVG
const EnvelopeIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 256 256"
    width="1em" 
    height="1em" 
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" d="M32,56H224a8,8,0,0,1,8,8V192a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V64A8,8,0,0,1,32,56Z"/>
    <polyline fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" points="224 64 128 128 32 64"/>
  </svg>
);

const HeroTyper: React.FC<HeroTyperProps> = ({ 
  title, 
  taglinePart1, 
  linkText, 
  linkUrl 
}) => {
  const [step, setStep] = useState(0);
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => setShowButtons(true), 500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle Title completion with a delay before starting Tagline
  const handleTitleComplete = () => {
    // Add a 500ms pause after the header "Snyder" before moving to step 1 (tagline)
    setTimeout(() => {
        setStep(1);
    }, 500);
  };

  const ghostStyle: React.CSSProperties = {
      gridArea: '1 / 1',
      visibility: 'hidden',
      pointerEvents: 'none', 
      userSelect: 'none',
  };

  const activeStyle: React.CSSProperties = {
      gridArea: '1 / 1',
      zIndex: 1, 
      width: '100%' 
  };

  const containerStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: '100%',
  };

  const buttonContainerStyle: React.CSSProperties = {
      marginTop: '20px',
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap'
  };

  return (
    <div style={containerStyle}>
        {/* Ghost Layer - RESERVES SPACE */}
        <div style={ghostStyle} aria-hidden="true" className="stack gap-2">
            <h1 className="title">{title}</h1>
            <p className="tagline">
                {taglinePart1}
                <a href={linkUrl} className="company-link">{linkText}</a>
            </p>
            <div style={buttonContainerStyle}>
                <a className="button">
                    See selected work <ArrowRightIcon />
                </a>
                <a className="button secondary">
                    Drop me a line <EnvelopeIcon />
                </a>
            </div>
        </div>

        {/* Active Layer - ANIMATION */}
        <div style={activeStyle} className="stack gap-2">
            <h1 className="title">
                <ScrambleText 
                    text={title} 
                    start={step >= 0} 
                    showCursor={false} 
                    onComplete={handleTitleComplete}
                />
            </h1>
            <p className="tagline">
                <ScrambleText 
                    text={taglinePart1} 
                    start={step >= 1} 
                    showCursor={false} 
                    onComplete={() => setStep(2)}
                />
                <a href={linkUrl} className="company-link">
                    <ScrambleText 
                        text={linkText} 
                        start={step >= 2} 
                        showCursor={true} 
                        onComplete={() => setStep(3)}
                    />
                </a>
            </p>
            
            <div style={{ 
                ...buttonContainerStyle,
                opacity: showButtons ? 1 : 0, 
                transition: 'opacity 0.8s ease',
                visibility: step >= 3 ? 'visible' : 'hidden' 
            }}>
                <a href="/work/" className="button">
                    See selected work <ArrowRightIcon />
                </a>
                <a href="mailto:fcarysnyder@gmail.com?subject=Saw%20your%20website!" className="button secondary">
                    Drop me a line <EnvelopeIcon />
                </a>
            </div>
        </div>
    </div>
  );
};

export default HeroTyper;
