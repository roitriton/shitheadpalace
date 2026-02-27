import { useRef } from 'react';
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

export function PowerOverlay({ power, players }: PowerOverlayProps) {
  // Stable key counter: increments each time a new power arrives,
  // so AnimatePresence treats each trigger as a distinct animation cycle.
  const counterRef = useRef(0);
  const prevPowerRef = useRef<LastPowerTriggered | null>(null);
  if (power && power !== prevPowerRef.current) {
    counterRef.current += 1;
  }
  prevPowerRef.current = power;

  return (
    <AnimatePresence>
      {power && (
        <motion.div
          key={counterRef.current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full flex items-center justify-center py-1"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.15, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
              exit: { duration: 0.5, ease: 'easeIn' },
            }}
            style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-3xl drop-shadow-lg">
              {POWER_DISPLAY[power.type].icon}
            </span>
            <span className="font-serif text-xs font-bold text-white drop-shadow-lg text-center px-1 leading-tight">
              {POWER_DISPLAY[power.type].label(power, players)}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
