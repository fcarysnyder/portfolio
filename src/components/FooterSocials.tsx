import React, { useState } from 'react';
import ScrambleText from './ScrambleText';

interface SocialLink {
  label: string;
  url: string;
}

interface FooterSocialsProps {
  initialText: string;
  links: SocialLink[];
  delay?: number;
}

const FooterSocials: React.FC<FooterSocialsProps> = ({ initialText, links, delay = 0 }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Helper to render the content (used for both ghost and active layers)
  const renderContent = (isGhost: boolean) => (
    <span 
      className="socials-container" 
      style={{ 
        display: 'inline-flex', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        gap: '0.25rem',
        visibility: isGhost ? 'hidden' : 'visible',
        pointerEvents: isGhost ? 'none' : 'auto'
      }}
    >
      <span className="socials-label">
        {isGhost ? initialText : (
          <ScrambleText 
              text={initialText} 
              start={true} 
              delay={delay}
              onComplete={() => setCurrentStep(1)}
              showCursor={false}
          />
        )}
      </span>
      
      {links.map((link, index) => {
          const linkStartStep = 1 + (index * 2);
          const separatorStartStep = linkStartStep - 1; 
          const isFirst = index === 0;
          const isLast = index === links.length - 1;
          
          return (
            <React.Fragment key={link.label}>
                {!isFirst && (
                    <span className="separator" style={{ margin: '0 0.25rem', userSelect: 'none' }}>
                        {isGhost ? '·' : (
                          <ScrambleText 
                              text="·" 
                              start={currentStep >= separatorStartStep}
                              speed={10} 
                              onComplete={() => setCurrentStep(separatorStartStep + 1)}
                              showCursor={false}
                          />
                        )}
                    </span>
                )}
                <a href={link.url} className="social-link">
                    {isGhost ? link.label : (
                      <ScrambleText 
                          text={link.label} 
                          start={currentStep >= linkStartStep}
                          onComplete={() => setCurrentStep(linkStartStep + 1)}
                          showCursor={isLast} 
                      />
                    )}
                </a>
            </React.Fragment>
          );
      })}
    </span>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
        {/* Ghost Layer - Reserves space to prevent "right-to-left" typing shift */}
        <div style={{ gridArea: '1 / 1', opacity: 0 }} aria-hidden="true">
            {renderContent(true)}
        </div>
        
        {/* Active Layer - The actual animation */}
        <div style={{ gridArea: '1 / 1', zIndex: 1 }}>
            {renderContent(false)}
        </div>
    </div>
  );
};

export default FooterSocials;
