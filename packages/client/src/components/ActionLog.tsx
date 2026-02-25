import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LogEntry } from '@shit-head-palace/engine';

// ─── Log formatting ─────────────────────────────────────────────────────────

function formatRanks(ranks: string[]): string {
  return ranks.join(', ');
}

function formatLogEntry(entry: LogEntry): string {
  const name = entry.playerName ?? 'Systeme';
  const d = entry.data;

  switch (entry.type) {
    case 'play': {
      const ranks = (d.ranks as string[] | undefined) ?? [];
      const zone = d.zone as string | undefined;
      const zoneLabel = zone === 'faceUp' ? ' (flop)' : zone === 'faceDown' ? ' (dark)' : '';
      return `${name} joue ${formatRanks(ranks)}${zoneLabel}`;
    }
    case 'darkPlay': {
      const ranks = (d.ranks as string[] | undefined) ?? [];
      return `${name} joue a l'aveugle ${formatRanks(ranks)}`;
    }
    case 'darkPlayFail':
      return `${name} echoue (dark flop) et ramasse`;
    case 'pickUp':
      return `${name} ramasse la pile (${d.cardCount ?? '?'} cartes)`;
    case 'burn':
      return `${name} brule la pile`;
    case 'reset':
      return `${name} reset (pile a zero)`;
    case 'skip':
      return `${name} skip (${d.skipCount ?? 1}x)`;
    case 'under':
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
      return `${name} Revolution !`;
    case 'superRevolution':
      return `${name} Super Revolution !`;
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
      return `Shifumi : egalite !`;
    case 'superShifumiResolved':
      return `${name} perd le Super Shifumi — Shit Head !`;
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

function getLogEntryColor(type: string): string {
  switch (type) {
    case 'burn':
      return 'text-red-400';
    case 'skip':
      return 'text-orange-400';
    case 'reset':
      return 'text-cyan-400';
    case 'under':
      return 'text-amber-300';
    case 'target':
    case 'targetChoice':
      return 'text-yellow-300';
    case 'mirror':
      return 'text-purple-300';
    case 'revolution':
    case 'superRevolution':
      return 'text-violet-400';
    case 'manouche':
    case 'superManouche':
    case 'manouchePick':
    case 'superManouchePick':
      return 'text-emerald-400';
    case 'flopReverse':
    case 'flopReverseTarget':
    case 'flopRemake':
    case 'flopRemakeTarget':
    case 'flopRemakeDone':
      return 'text-teal-400';
    case 'shifumiTarget':
    case 'shifumiChoice':
    case 'shifumiResolved':
    case 'shifumiTie':
    case 'superShifumiResolved':
      return 'text-pink-400';
    case 'playerFinished':
    case 'gameStart':
    case 'gameOver':
      return 'text-[#c9a84c]';
    case 'darkPlayFail':
      return 'text-red-300';
    default:
      return 'text-gray-300';
  }
}

// ─── ActionLog ──────────────────────────────────────────────────────────────

interface ActionLogProps {
  log: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
  /** When true, panel starts below the 2rem debug toolbar */
  debugBarOffset?: boolean;
}

export function ActionLog({ log, isOpen, onToggle, debugBarOffset }: ActionLogProps) {
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
            className={`fixed right-0 bottom-14 z-[45] w-72 sm:w-80 bg-gray-900/95 backdrop-blur border-l border-[#c9a84c]/20 flex flex-col ${debugBarOffset ? 'top-8' : 'top-0'}`}
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
                  <span className={getLogEntryColor(entry.type)}>
                    {formatLogEntry(entry)}
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
