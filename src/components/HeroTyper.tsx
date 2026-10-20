import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import ScrambleText from './ScrambleText';

// `button` / `secondary` stay as hook classes (swiss.css targets .button); the look is utilities.
const BUTTON =
  'button mt-5 inline-flex h-10 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-accent-fill px-4 text-sm/5 font-semibold text-on-accent uppercase no-underline hover:bg-accent-fill-hover';
const BUTTON_SECONDARY =
  'button secondary mt-5 inline-flex h-10 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-transparent px-4 text-sm/5 font-semibold text-accent-text uppercase no-underline hover:bg-accent-overlay-hover hover:text-accent-text-hover';

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
      flexWrap: 'wrap'
  };

  return (
    <div style={containerStyle}>
        {/* Ghost Layer - RESERVES SPACE */}
        <div style={ghostStyle} aria-hidden="true" className="flex flex-col gap-2">
            <h1 className="title">{title}</h1>
            <p className="tagline">
                {taglinePart1}
                <a href={linkUrl} className="company-link">{linkText}</a>
            </p>
            <div style={buttonContainerStyle} className="mt-5 flex gap-4">
                <a className={BUTTON}>
                    See selected work <ArrowRight size="1em" />
                </a>
                <a className={BUTTON_SECONDARY}>
                    Drop me a line <Mail size="1em" />
                </a>
            </div>
        </div>

        {/* Active Layer - ANIMATION */}
        <div style={activeStyle} className="flex flex-col gap-2">
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
            
            <div className="mt-5 flex gap-4" style={{
                ...buttonContainerStyle,
                opacity: showButtons ? 1 : 0,
                transition: 'opacity 0.8s ease',
                visibility: step >= 3 ? 'visible' : 'hidden'
            }}>
                <a href="/work/" className={BUTTON}>
                    See selected work <ArrowRight size="1em" />
                </a>
                <a href="mailto:fcarysnyder@gmail.com?subject=Saw%20your%20website!" className={BUTTON_SECONDARY}>
                    Drop me a line <Mail size="1em" />
                </a>
            </div>
        </div>
    </div>
  );
};

export default HeroTyper;
