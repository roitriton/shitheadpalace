import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from './Card';
import type { Card as CardType } from '@shit-head-palace/engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FlyingCardAnim {
  id: string;
  card: CardType;
  faceDown: boolean;
  from: { x: number; y: number; scale: number };
  to: { x: number; y: number; scale: number };
  duration: number;
  flipDuringFlight?: boolean;
  delay?: number;
}

interface Props {
  animations: FlyingCardAnim[];
  onComplete: (id: string) => void;
}

// ─── Ghost card (single flying card) ────────────────────────────────────────

function GhostCard({ anim, onComplete }: { anim: FlyingCardAnim; onComplete: () => void }) {
  const [faceDown, setFaceDown] = React.useState(
    anim.flipDuringFlight ? true : anim.faceDown,
  );

  React.useEffect(() => {
    if (anim.flipDuringFlight) {
      const flipDelay = (anim.delay ?? 0) + anim.duration * 0.4;
      const timer = setTimeout(() => setFaceDown(false), flipDelay);
      return () => clearTimeout(timer);
    }
  }, [anim.flipDuringFlight, anim.duration, anim.delay]);

  return (
    <motion.div
      className="absolute"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
      initial={{
        x: anim.from.x,
        y: anim.from.y,
        scale: anim.from.scale,
      }}
      animate={{
        x: anim.to.x,
        y: anim.to.y,
        scale: anim.to.scale,
      }}
      transition={{
        duration: anim.duration / 1000,
        ease: [0.25, 0.1, 0.25, 1],
        delay: (anim.delay ?? 0) / 1000,
      }}
      onAnimationComplete={onComplete}
    >
      <Card card={anim.card} faceDown={faceDown} size="md" noLayout noMotion ghost />
    </motion.div>
  );
}

// ─── Animation layer (fixed overlay) ────────────────────────────────────────

export function CardAnimationLayer({ animations, onComplete }: Props) {
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {animations.map((anim) => (
          <GhostCard key={anim.id} anim={anim} onComplete={() => onComplete(anim.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
