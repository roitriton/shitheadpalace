import { useRef, useState, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LastPowerTriggered, Player } from '@shit-head-palace/engine';

// ─── Power display config ────────────────────────────────────────────────────

interface PowerDisplay {
  icon: string;
  label: (power: LastPowerTriggered, players: Player[]) => string;
}

function playerName(id: string, players: Player[]): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

const POWER_DISPLAY: Record<LastPowerTriggered['type'], PowerDisplay> = {
  burn: {
    icon: '\uD83D\uDD25',
    label: () => 'Burn !',
  },
  reset: {
    icon: '\uD83D\uDD04',
    label: () => 'Reset !',
  },
  under: {
    icon: '\u2B07\uFE0F',
    label: () => 'Under !',
  },
  skip: {
    icon: '\u274C',
    label: (p) => (p.skipCount && p.skipCount > 1 ? `Skip x${p.skipCount} !` : 'Skip !'),
  },
  target: {
    icon: '\uD83C\uDFAF',
    label: (p, players) =>
      p.targetId
        ? `Target ! ${playerName(p.playerId, players)} \u2192 ${playerName(p.targetId, players)} !`
        : 'Target !',
  },
  revolution: {
    icon: '\u2666\uFE0F',
    label: () => 'R\u00e9volution !',
  },
  superRevolution: {
    icon: '\u2666\uFE0F\u26A1',
    label: () => 'Super R\u00e9volution !',
  },
  manouche: {
    icon: '\u2660\uFE0F',
    label: (p, players) =>
      p.targetId
        ? `Manouche ! ${playerName(p.playerId, players)} \u2192 ${playerName(p.targetId, players)} !`
        : 'Manouche !',
  },
  superManouche: {
    icon: '\u2660\uFE0F\u26A1',
    label: (p, players) =>
      p.targetId
        ? `Super Manouche ! ${playerName(p.playerId, players)} \u2192 ${playerName(p.targetId, players)} !`
        : 'Super Manouche !',
  },
  flopReverse: {
    icon: '\u2665\uFE0F',
    label: (p, players) =>
      p.targetId ? `Flop Reverse ! ${playerName(p.targetId, players)} !` : 'Flop Reverse !',
  },
  flopRemake: {
    icon: '\u2665\uFE0F\u26A1',
    label: (p, players) =>
      p.targetId ? `Flop Remake ! ${playerName(p.targetId, players)} !` : 'Flop Remake !',
  },
  shifumi: {
    icon: '\u2663\uFE0F',
    label: (p, players) =>
      p.players && p.players.length === 2
        ? `Shifumi ! ${playerName(p.players[0]!, players)} VS ${playerName(p.players[1]!, players)} !`
        : 'Shifumi !',
  },
  superShifumi: {
    icon: '\u2663\uFE0F\u26A1',
    label: (p, players) =>
      p.players && p.players.length === 2
        ? `Super Shifumi ! ${playerName(p.players[0]!, players)} VS ${playerName(p.players[1]!, players)} !`
        : 'Super Shifumi !',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface PowerOverlayProps {
  power: LastPowerTriggered | null;
  players: Player[];
}

/**
 * Renders a power icon overlay centered on the latest pile card using
 * position: fixed with JS-calculated coordinates from [data-pile-latest].
 */
export function PowerOverlay({ power, players }: PowerOverlayProps) {
  // Stable key counter: increments each time a new power arrives,
  // so AnimatePresence treats each trigger as a distinct animation cycle.
  const counterRef = useRef(0);
  const prevPowerRef = useRef<LastPowerTriggered | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (power && power !== prevPowerRef.current) {
    counterRef.current += 1;
  }
  prevPowerRef.current = power;

  // Compute position from [data-pile-latest] element's bounding rect
  useLayoutEffect(() => {
    if (!power) return; // Keep old position for exit animation
    const el = document.querySelector('[data-pile-latest]');
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      // Fallback: center of viewport (e.g. pile empty after burn)
      setPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [power]);

  return (
    <div
      style={{
        position: 'fixed',
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {power && pos && (
          <motion.div
            key={counterRef.current}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 3.5 }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
              exit: { duration: 0.6, ease: 'easeIn' },
            }}
            style={{
              transformOrigin: 'center center',
              willChange: 'transform, opacity',
              width: 0,
              height: 0,
              overflow: 'visible',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="text-5xl drop-shadow-lg">
              {POWER_DISPLAY[power.type].icon}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
