import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LogEntry } from '@shit-head-palace/engine';

// ─── Suit symbols & colors (shared with MiniLog) ────────────────────────────

const LOG_SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

const LOG_SUIT_COLOR: Record<string, string> = {
  hearts: 'text-red-400', diamonds: 'text-red-400',
  clubs: 'text-white', spades: 'text-white',
};

// ─── Log formatting ─────────────────────────────────────────────────────────

const ACTION_LOG_POWER_LABELS: Record<string, string> = {
  burn: 'Burn !',
  reset: 'Reset !',
  skip: 'Skip !',
  under: 'Under !',
  target: 'Target !',
  mirror: 'Mirror !',
  revolution: 'Révolution !',
  superRevolution: 'Super Révolution !',
  manouche: 'Manouche !',
  superManouche: 'Super Manouche !',
  flopReverse: 'Flop Reverse !',
  flopRemake: 'Flop Remake !',
  shifumi: 'Shifumi !',
  superShifumi: 'Super Shifumi !',
};

/** Render card symbols (rank + colored suit) as JSX spans. */
function renderCardSymbols(ranks: string[], suits: string[]): React.ReactNode {
  return ranks.map((rank, ri) => {
    const suit = suits[ri] ?? '';
    const symbol = LOG_SUIT_SYMBOL[suit] ?? '';
    const suitColor = LOG_SUIT_COLOR[suit] ?? 'text-white';
    return (
      <span key={ri}>
        {ri > 0 && ' '}
        <span className={`font-bold ${suitColor}`}>{rank}{symbol}</span>
      </span>
    );
  });
}

/** Render a log entry as JSX — uses card symbols for play/darkPlay entries. */
function renderLogEntry(entry: LogEntry): React.ReactNode {
  // Power entries: just the power label, no player name
  if (entry.entryType === 'power') {
    return ACTION_LOG_POWER_LABELS[entry.type] ?? entry.type;
  }

  // Effect entries with pre-formatted message
  if (entry.entryType === 'effect' && entry.data.message) {
    return entry.data.message as string;
  }

  const name = entry.playerName ?? 'Systeme';
  const d = entry.data;

  switch (entry.type) {
    case 'play':
    case 'darkPlay': {
      const ranks = (d.ranks as string[] | undefined) ?? [];
      const suits = (d.suits as string[] | undefined) ?? [];
      return (
        <>
          <span className="font-semibold">{name}</span>{' '}joue{' '}
          {renderCardSymbols(ranks, suits)}
        </>
      );
    }
    case 'darkPlayFail':
      return <><span className="font-semibold">{name}</span> échoue (dark)</>;

    case 'pickUp': {
      const count = d.cardCount as number | undefined;
      return <><span className="font-semibold">{name}</span> ramasse {count ?? '?'} {count === 1 ? 'carte' : 'cartes'}</>;
    }
    case 'burn':
    case 'burnEffect':
      return `${name} brule la pile`;
    case 'reset':
    case 'resetEffect':
      return `${name} reset (pile a zero)`;
    case 'skip':
    case 'skipEffect':
      return `${name} skip (${d.skipCount ?? 1}x)`;
    case 'under':
    case 'underEffect':
      return `${name} pose Under (max ${d.underValue ?? '?'})`;
    case 'target':
      return `${name} pose un As (Target)`;
    case 'targetChoice': {
      const targetName = d.targetPlayerName as string | undefined;
      return `${name} cible ${targetName ?? '?'}`;
    }
    case 'mirror':
      return `${name} Mirror → valeur ${d.effectiveRank ?? '?'}`;
    case 'revolution':
    case 'revolutionEffect':
      return `${name} Revolution`;
    case 'superRevolution':
    case 'superRevolutionEffect':
      return `${name} Super Revolution`;
    case 'manouche':
    case 'superManouche':
      return `${name} ${entry.type === 'superManouche' ? 'Super ' : ''}Manouche`;
    case 'manouchePick':
      return `${name} echange (Manouche)`;
    case 'superManouchePick':
      return `${name} echange (Super Manouche)`;
    case 'shifumiTarget':
      return `${name} lance un Shifumi`;
    case 'shifumiChoice':
      return `${name} choisit (Shifumi)`;
    case 'shifumiResolved':
      return `${name} perd le Shifumi, ramasse la pile`;
    case 'shifumiTie':
      return `Shifumi : egalite`;
    case 'superShifumiResolved':
      return `${name} perd le Super Shifumi — Shit Head`;
    case 'flopReverse':
      return `${name} Flop Reverse`;
    case 'flopReverseTarget':
      return `${name} retourne le flop`;
    case 'flopRemake':
      return `${name} Flop Remake`;
    case 'flopRemakeTarget':
      return `${name} cible pour Flop Remake`;
    case 'flopRemakeDone':
      return `${name} redistribue son flop`;
    case 'playerFinished': {
      const place = d.place as number | undefined;
      return `${name} termine ${place ?? '?'}${place === 1 ? 'er' : 'e'}`;
    }
    case 'gameStart':
      return 'Partie lancee';
    case 'gameOver':
      return 'Partie terminee';
    case 'skipTurn': {
      const msg = d.message as string | undefined;
      return msg ?? `${name} ne peut pas jouer`;
    }
    case 'swap':
      return `${name} echange (swap)`;
    case 'firstPlayerShifumiStart':
      return 'Shifumi pour le premier joueur';
    case 'firstPlayerShifumiChoice':
      return `${name} a choisi (shifumi)`;
    case 'firstPlayerShifumiDraw':
      return 'Egalite — nouvelle manche';
    case 'firstPlayerShifumiNextRound':
      return 'Prochaine manche du shifumi';
    case 'firstPlayerShifumiWin':
      return 'Premier joueur determine';
    default:
      return `${name}: ${entry.type}`;
  }
}

// ─── Color mapping ──────────────────────────────────────────────────────────

function getLogEntryColor(entry: LogEntry): string {
  // entryType-based colors — match MiniLog exactly
  if (entry.entryType === 'power') return 'text-amber-400';
  if (entry.entryType === 'effect') return 'text-emerald-400';
  // System events (gold)
  if (entry.type === 'playerFinished' || entry.type === 'gameStart' || entry.type === 'gameOver') {
    return 'text-[#c9a84c]';
  }
  // Action entries — match MiniLog's text-gray-200
  return 'text-gray-200';
}

// ─── ActionLog ──────────────────────────────────────────────────────────────

interface ActionLogProps {
  log: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
  /** When true, panel starts below the top bar (h-14) */
  topBarOffset?: boolean;
}

export function ActionLog({ log, isOpen, onToggle, topBarOffset }: ActionLogProps) {
  const reversed = useMemo(
    () => [...log].reverse().map((entry, i) => ({ entry, num: log.length - i })),
    [log],
  );

  return (
    <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className={`fixed right-0 bottom-14 z-[45] w-72 sm:w-80 bg-gray-900/95 backdrop-blur border-l border-[#c9a84c]/20 flex flex-col ${topBarOffset ? 'top-14' : 'top-0'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a84c]/20">
              <h2 className="font-serif text-[#c9a84c] text-lg">Journal</h2>
              <button
                type="button"
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Log entries — newest first */}
            <div className="flex-1 overflow-y-auto">
              {reversed.map(({ entry, num }) => (
                <div
                  key={entry.id}
                  className="py-1.5 px-3 text-xs border-b border-gray-800/50"
                >
                  <span className="text-gray-500 mr-1.5 font-mono">{num}.</span>
                  <span className={getLogEntryColor(entry)}>
                    {renderLogEntry(entry)}
                  </span>
                </div>
              ))}
              {log.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-500 italic">Aucune action</div>
              )}
            </div>
          </motion.div>
        )}
    </AnimatePresence>
  );
}
