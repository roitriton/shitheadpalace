import { useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ShifumiLoserOverlayProps {
  playerId: string;
  isSuper: boolean;
  onComplete: () => void;
}

/**
 * Overlay displayed on the avatar of the shifumi loser.
 * Shows a crying face (normal) or skull (super) with a scale+fade animation.
 */
export function ShifumiLoserOverlay({ playerId, isSuper, onComplete }: ShifumiLoserOverlayProps) {
  const [pos, setPos] = useState<{ x: number; y: number; size: number } | null>(null);

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-player-avatar="${playerId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: Math.max(rect.width, rect.height),
      });
    }
  }, [playerId]);

  if (!pos) return null;

  const icon = isSuper ? '\u2620\uFE0F' : '\uD83D\uDE2D';
  const overlaySize = Math.max(pos.size, 48) + 8;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.2, 1, 1, 0.8],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: 2,
          times: [0, 0.15, 0.2, 0.85, 1],
          ease: 'easeOut',
        }}
        onAnimationComplete={onComplete}
        style={{
          width: 0,
          height: 0,
          overflow: 'visible',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: overlaySize,
            height: overlaySize,
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ fontSize: overlaySize * 0.55 }} className="drop-shadow-lg">
            {icon}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
