import React, { useState, useEffect, useRef } from 'react';
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
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Helper to render the content (used for both ghost and active layers)
  const renderContent = (isGhost: boolean) => (
    <span
      className={`socials-container inline-flex flex-wrap items-center gap-1 ${
        isGhost ? 'invisible pointer-events-none' : 'visible pointer-events-auto'
      }`}
    >
      <span className="socials-label mr-2">
        {isGhost ? initialText : (
          <ScrambleText 
              text={initialText} 
              start={isVisible} 
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
          
          return (
            <React.Fragment key={link.label}>
                {!isFirst && (
                    <span className="mx-1 select-none separator">
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
                <a 
                    href={link.url} 
                    className="social-link text-accent-text underline decoration-1 decoration-transparent underline-offset-[0.25em] [transition:text-decoration-color_var(--theme-transition)] hover:text-accent-text-hover hover:decoration-accent-text-hover focus:text-accent-text-hover focus:decoration-accent-text-hover"
                    aria-label={`Visit my ${link.label} profile`}
                >
                    {isGhost ? link.label : (
                      <ScrambleText 
                          text={link.label} 
                          start={currentStep >= linkStartStep}
                          onComplete={() => setCurrentStep(linkStartStep + 1)}
                          showCursor={false} 
                      />
                    )}
                </a>
            </React.Fragment>
          );
      })}
    </span>
  );

  return (
    <div ref={containerRef} className="grid grid-cols-[1fr]">
        {/* Ghost Layer - Reserves space to prevent "right-to-left" typing shift */}
        <div className="col-start-1 row-start-1 opacity-0" aria-hidden="true">
            {renderContent(true)}
        </div>
        
        {/* Active Layer - The actual animation */}
        <div className="z-1 col-start-1 row-start-1">
            {renderContent(false)}
        </div>
    </div>
  );
};

export default FooterSocials;
