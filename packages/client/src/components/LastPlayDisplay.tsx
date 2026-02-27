import type { LogEntry, Suit, Rank } from '@shit-head-palace/engine';
import { Card } from './Card';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LastPlayDisplayProps {
  log: LogEntry[];
}

// ─── Power log type detection ────────────────────────────────────────────────

const POWER_LOG_TYPES = new Set([
  'burn', 'reset', 'under', 'skip', 'target',
  'revolution', 'superRevolution', 'manouche', 'superManouche',
  'flopReverse', 'flopRemake', 'shifumi', 'superShifumi',
]);

const POWER_LABELS: Record<string, string> = {
  burn: 'Burn !',
  reset: 'Reset !',
  under: 'Under !',
  skip: 'Skip !',
  target: 'Target !',
  revolution: 'Révolution !',
  superRevolution: 'Super Révolution !',
  manouche: 'Manouche !',
  superManouche: 'Super Manouche !',
  flopReverse: 'Flop Reverse !',
  flopRemake: 'Flop Remake !',
  shifumi: 'Shifumi !',
  superShifumi: 'Super Shifumi !',
};

// ─── Component ───────────────────────────────────────────────────────────────

/** Displays the last played move with player name, card images, and triggered power. */
export function LastPlayDisplay({ log }: LastPlayDisplayProps) {
  // Find the last action entry (play, darkPlay, darkPlayFail, pickUp)
  let lastActionIdx = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    const t = log[i]!.type;
    if (t === 'play' || t === 'darkPlay' || t === 'darkPlayFail' || t === 'pickUp') {
      lastActionIdx = i;
      break;
    }
  }

  if (lastActionIdx < 0) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="text-[10px] text-gray-500 italic">{"Aucun coup joué"}</span>
      </div>
    );
  }

  const lastAction = log[lastActionIdx]!;
  const name = lastAction.playerName ?? '?';

  // Collect power entries logged after the last action
  const powerLabels: string[] = [];
  for (let i = lastActionIdx + 1; i < log.length; i++) {
    const entry = log[i]!;
    if (POWER_LOG_TYPES.has(entry.type)) {
      const label = POWER_LABELS[entry.type];
      if (label) powerLabels.push(label);
    }
  }

  // ── Pick-up ──
  if (lastAction.type === 'pickUp') {
    const count = lastAction.data.cardCount as number | undefined;
    return (
      <div className="flex flex-col items-center gap-0.5 py-1">
        <span className="text-[10px] sm:text-xs font-semibold text-gray-200 truncate max-w-full">
          {name}
        </span>
        <span className="text-[10px] text-orange-400 font-medium">
          {`a ramassé la pile${count ? ` (${count})` : ''}`}
        </span>
      </div>
    );
  }

  // ── Dark flop fail ──
  if (lastAction.type === 'darkPlayFail') {
    return (
      <div className="flex flex-col items-center gap-0.5 py-1">
        <span className="text-[10px] sm:text-xs font-semibold text-gray-200 truncate max-w-full">
          {name}
        </span>
        <span className="text-[10px] text-red-400 font-medium">{"Échec dark flop !"}</span>
      </div>
    );
  }

  // ── Play or dark play ──
  const ranks = (lastAction.data.ranks as string[] | undefined) ?? [];
  const suits = (lastAction.data.suits as string[] | undefined) ?? [];
  const cards = ranks.map((rank, i) => ({
    id: `last-play-${i}`,
    suit: (suits[i] ?? 'spades') as Suit,
    rank: rank as Rank,
  }));

  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <span className="text-[10px] sm:text-xs font-semibold text-gray-200 truncate max-w-full">
        {name} joue
      </span>
      <div className="flex items-center justify-center gap-0.5 flex-wrap">
        {cards.map((card) => (
          <Card key={card.id} card={card} size="xs" noMotion noLayout disabled />
        ))}
      </div>
      {powerLabels.length > 0 && (
        <span className="text-[10px] font-bold text-amber-400 text-center leading-tight">
          {powerLabels.join(' ')}
        </span>
      )}
    </div>
  );
}
