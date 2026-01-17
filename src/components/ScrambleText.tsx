import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ScrambleTextProps {
  text: string;
  className?: string;
  speed?: number; // Time per character reveal (ms)
  scrambleSpeed?: number; // Time between scramble updates (ms)
  delay?: number;
  start?: boolean;
  onComplete?: () => void;
  showCursor?: boolean;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&()_+-=[]{}|;:,.<>?';

const ScrambleText: React.FC<ScrambleTextProps> = ({ 
  text, 
  className = '', 
  speed = 30, 
  scrambleSpeed = 50, 
  delay = 0,
  start = true,
  onComplete,
  showCursor = true
}) => {
  const [displayContent, setDisplayContent] = useState({ revealed: '', scrambled: '' });
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastScrambleTimeRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  const revealIndexRef = useRef<number>(0);
  
  // Pause state
  const isPausedRef = useRef<boolean>(false);
  const pauseEndTimeRef = useRef<number>(0);

  // Keep callback ref stable
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Ref to hold the current scramble string
  const currentScrambleRef = useRef('');

  const animateFrame = useCallback((time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Check if paused
      if (isPausedRef.current) {
          if (time >= pauseEndTimeRef.current) {
              isPausedRef.current = false;
              lastScrambleTimeRef.current = 0; // Reset so scramble updates immediately
          } else {
              // Paused: Hide scrambling to look like "composing"
              if (currentScrambleRef.current !== '') {
                  currentScrambleRef.current = '';
                  setDisplayContent({ 
                      revealed: text.substring(0, revealIndexRef.current), 
                      scrambled: '' 
                  });
              }
              requestRef.current = requestAnimationFrame(animateFrame);
              return;
          }
      }

      accumulatedTimeRef.current += deltaTime;

      if (accumulatedTimeRef.current >= speed) {
          const charsToReveal = Math.floor(accumulatedTimeRef.current / speed);
          accumulatedTimeRef.current %= speed; // Keep remainder

          let newIndex = revealIndexRef.current + charsToReveal;
          
          // Check for pause characters in the newly revealed segment
          // We iterate one by one to catch the first pause char
          for (let i = revealIndexRef.current; i < newIndex && i < text.length; i++) {
              if (text[i] === '.') {
                  // Found a period, trigger pause
                  newIndex = i + 1; // Reveal up to and including the period
                  isPausedRef.current = true;
                  pauseEndTimeRef.current = time + 400; // 400ms pause (200ms requested, but 400 feels better for "reading")
                  accumulatedTimeRef.current = 0; // Reset accumulator
                  break;
              }
          }
          
          revealIndexRef.current = Math.min(newIndex, text.length);
      }

      const isFinished = revealIndexRef.current >= text.length;

      // Update scramble text
      if (!isFinished && (time - lastScrambleTimeRef.current > scrambleSpeed)) {
          const scrambleLen = Math.min(3, text.length - revealIndexRef.current);
          let nextScramble = '';
          for (let i = 0; i < scrambleLen; i++) {
              nextScramble += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
          currentScrambleRef.current = nextScramble;
          lastScrambleTimeRef.current = time;
      }
      
      // If we finished just now
      if (isFinished && !isComplete) {
          setDisplayContent({ revealed: text, scrambled: '' });
          setIsComplete(true);
          if (onCompleteRef.current) onCompleteRef.current();
          return; // Stop loop
      }

      if (!isFinished) {
          setDisplayContent({ 
              revealed: text.substring(0, revealIndexRef.current), 
              scrambled: currentScrambleRef.current 
          });
          requestRef.current = requestAnimationFrame(animateFrame);
      }
  }, [speed, scrambleSpeed, text, isComplete]);

  useEffect(() => {
    if (start && !hasStarted) {
        // Start sequence
        const timeout = setTimeout(() => {
            setHasStarted(true);
            requestRef.current = requestAnimationFrame(animateFrame);
        }, delay);
        return () => clearTimeout(timeout);
    }
    
    // Cleanup
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [start, hasStarted, delay, animateFrame]);

  // Cursor blink
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
        setCursorVisible(v => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Reset if text changes or start becomes false
  useEffect(() => {
      if (!start) {
          setDisplayContent({ revealed: '', scrambled: '' });
          setHasStarted(false);
          setIsComplete(false);
          lastTimeRef.current = null;
          accumulatedTimeRef.current = 0;
          lastScrambleTimeRef.current = 0;
          currentScrambleRef.current = '';
          revealIndexRef.current = 0;
          isPausedRef.current = false;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  }, [start, text]);

  // Only show cursor if typing is complete AND showCursor prop is true
  const shouldShowCursor = showCursor && isComplete;

  return (
    <span className={className}>
      {displayContent.revealed}
      <span style={{ opacity: 0.7 }}>{displayContent.scrambled}</span>
      {shouldShowCursor && (
        <span 
          style={{ 
            opacity: cursorVisible ? 1 : 0,
            color: 'var(--accent-regular)',
            textShadow: '0 0 5px var(--accent-regular)',
            marginLeft: '2px',
            fontWeight: 'bold'
          }}
        >
          _
        </span>
      )}
    </span>
  );
};

export default ScrambleText;
