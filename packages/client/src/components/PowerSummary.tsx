import type { GameVariant, Power, Rank } from '@shit-head-palace/engine';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PowerSummaryProps {
  variant: GameVariant;
}

// ─── Display constants ───────────────────────────────────────────────────────

/** French display names for each power. */
const POWER_NAMES: Record<Power, string> = {
  burn: 'Burn',
  reset: 'Reset',
  under: 'Under',
  skip: 'Skip',
  mirror: 'Mirror',
  target: 'Target',
  revolution: 'Révolution',
  superRevolution: 'Super Révolution',
  manouche: 'Manouche',
  superManouche: 'Super Manouche',
  flopReverse: 'Flop Reverse',
  flopRemake: 'Flop Remake',
  shifumi: 'Shifumi',
  superShifumi: 'Super Shifumi',
};

/** Suit info for Jack-based power display. */
const SUIT_DISPLAY: Record<string, { symbol: string; color: string }> = {
  diamonds: { symbol: '♦', color: 'text-red-400' },
  spades: { symbol: '♠', color: 'text-gray-200' },
  hearts: { symbol: '♥', color: 'text-red-400' },
  clubs: { symbol: '♣', color: 'text-gray-200' },
};

/**
 * Jack power mapping: suit → base power.
 * Will be moved to the variant config when custom unique powers are implemented.
 */
const JACK_POWER_MAP: { suit: string; power: Power }[] = [
  { suit: 'diamonds', power: 'revolution' },
  { suit: 'spades', power: 'manouche' },
  { suit: 'hearts', power: 'flopReverse' },
  { suit: 'clubs', power: 'shifumi' },
];

/** Rank sort order for display. */
const RANK_SORT: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PowerEntry {
  label: string;
  labelColor: string;
  name: string;
  sortKey: number;
  /** 'classic' = all cards of a rank carry this power; 'unique' = one specific card */
  category: 'classic' | 'unique';
}

/** Builds the list of active power entries from the variant config. */
function buildPowerEntries(variant: GameVariant): PowerEntry[] {
  const classic: PowerEntry[] = [];
  const unique: PowerEntry[] = [];

  // 1. Configurable powers from powerAssignments → classic
  for (const [power, rankOrRanks] of Object.entries(variant.powerAssignments)) {
    if (rankOrRanks === undefined) continue;
    const powerName = POWER_NAMES[power as Power] ?? power;
    const ranks: Rank[] = Array.isArray(rankOrRanks) ? rankOrRanks : [rankOrRanks];
    for (const rank of ranks) {
      classic.push({
        label: rank,
        labelColor: 'text-gray-100',
        name: powerName,
        sortKey: RANK_SORT[rank] ?? 0,
        category: 'classic',
      });
    }
  }

  // 2. Jack-only powers (suit-based) → unique
  for (const { suit, power } of JACK_POWER_MAP) {
    const suitInfo = SUIT_DISPLAY[suit];
    if (!suitInfo) continue;
    unique.push({
      label: `J${suitInfo.symbol}`,
      labelColor: suitInfo.color,
      name: POWER_NAMES[power] ?? power,
      sortKey: RANK_SORT['J'] ?? 11,
      category: 'unique',
    });
  }

  // Sort each group by rank value ascending
  classic.sort((a, b) => a.sortKey - b.sortKey);
  unique.sort((a, b) => a.sortKey - b.sortKey);

  // Classic first, then unique
  return [...classic, ...unique];
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Displays a summary of all active powers read dynamically from the variant. */
export function PowerSummary({ variant }: PowerSummaryProps) {
  const entries = buildPowerEntries(variant);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] text-gray-500 italic">Aucun pouvoir configuré</span>
      </div>
    );
  }

  // Balanced 2-column split: col1 = first half, col2 = second half
  const half = Math.ceil(entries.length / 2);
  const col1 = entries.slice(0, half);
  const col2 = entries.slice(half);

  return (
    <div className="flex flex-col items-center gap-1 w-full px-1">
      <div className="flex w-full gap-x-2">
        <div className="flex-1 flex flex-col gap-0.5">
          {col1.map((entry, idx) => (
            <PowerEntryRow key={idx} entry={entry} />
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          {col2.map((entry, idx) => (
            <PowerEntryRow key={idx + half} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PowerEntryRow({ entry }: { entry: PowerEntry }) {
  return (
    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] leading-tight">
      <span className={`font-bold ${entry.labelColor} min-w-[1.8rem] text-right`}>
        {entry.label}
      </span>
      <span className="text-gray-500">→</span>
      <span className="text-gray-300 truncate">{entry.name}</span>
    </div>
  );
}
