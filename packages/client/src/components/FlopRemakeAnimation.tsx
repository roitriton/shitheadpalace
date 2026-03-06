import React from 'react';
import { motion } from 'framer-motion';

interface FlopRemakeCardOverlayProps {
  /** Total duration of the animation in seconds */
  duration?: number;
  /** If true, this instance triggers onComplete at the end */
  onComplete?: () => void;
}

/**
 * Per-card rainbow gradient overlay for Flop Remake animation.
 * Phase 1 (0→0.5s):  fade in  (opacity 0→1)
 * Phase 2 (0.5→2.0s): gradient scrolls top→bottom
 * Phase 3 (2.0→2.5s): fade out (opacity 1→0)
 *
 * Must be placed inside a container with overflow:hidden and rounded-lg
 * to clip to the card shape.
 */
export function FlopRemakeCardOverlay({ duration = 2.5, onComplete }: FlopRemakeCardOverlayProps) {
  React.useEffect(() => {
    if (!onComplete) return;
    const timer = setTimeout(onComplete, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  // Timing breakpoints as fractions of total duration
  const fadeInEnd = 0.5 / duration;   // 0 → 0.2
  const fadeOutStart = 2.0 / duration; // 0.8
  // fadeOutEnd = 1.0

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(180deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0088)',
        backgroundSize: '100% 300%',
      }}
      initial={{ opacity: 0, backgroundPosition: '0% 100%' }}
      animate={{
        opacity: [0, 1, 1, 0],
        backgroundPosition: ['0% 100%', '0% 100%', '0% 0%', '0% 0%'],
      }}
      transition={{
        duration,
        times: [0, fadeInEnd, fadeOutStart, 1],
        ease: 'easeInOut',
      }}
    />
  );
}
