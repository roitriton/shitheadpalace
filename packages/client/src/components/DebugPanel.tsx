import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, LogEntry, PileEntry, Card as CardType } from '@shit-head-palace/engine';
import { Card } from './Card';

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

// ─── DebugToolbar ───────────────────────────────────────────────────────────

interface DebugToolbarProps {
  revealHands: boolean;
  onToggleRevealHands: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function DebugToolbar({
  revealHands,
  onToggleRevealHands,
  panelOpen,
  onTogglePanel,
}: DebugToolbarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-8 z-[60] bg-gray-800/90 backdrop-blur-sm border-b border-gold/20 flex items-center px-4 gap-4 text-xs select-none">
      <span className="font-mono font-bold text-gold tracking-wider">DEBUG</span>

      <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white transition-colors">
        <span>Mains</span>
        <div
          className={`relative w-8 h-4 rounded-full transition-colors ${revealHands ? 'bg-gold' : 'bg-gray-600'}`}
          onClick={onToggleRevealHands}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${revealHands ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </div>
      </label>

      <button
        className={`px-2 py-0.5 rounded text-xs transition-colors ${panelOpen ? 'bg-gold text-gray-900 font-bold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        onClick={onTogglePanel}
      >
        Log
      </button>
    </div>
  );
}

// ─── DebugLogPanel ──────────────────────────────────────────────────────────

interface DebugLogPanelProps {
  log: LogEntry[];
  isOpen: boolean;
}

export function DebugLogPanel({ log, isOpen }: DebugLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [log.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-8 right-0 w-80 h-[calc(100vh-2rem)] z-[45] bg-gray-900/95 backdrop-blur-sm border-l border-gold/20 flex flex-col"
        >
          <div className="px-3 py-2 border-b border-gold/20 flex-none">
            <h3 className="font-serif text-sm text-gold">Action Log</h3>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {log.map((entry, i) => (
              <div
                key={entry.id}
                className="py-1.5 px-3 text-xs border-b border-gray-800/50 text-gray-300"
              >
                <span className="text-gray-500 mr-1.5 font-mono">{i + 1}.</span>
                {formatLogEntry(entry)}
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

// ─── ZoneInspectorModal ─────────────────────────────────────────────────────

export type InspectZone = 'deck' | 'pile' | 'graveyard';

interface ZoneInspectorModalProps {
  zone: InspectZone;
  state: GameState;
  onClose: () => void;
}

const ZONE_TITLES: Record<InspectZone, string> = {
  deck: 'Pioche',
  pile: 'Pile',
  graveyard: 'Cimetiere',
};

function PileEntryRow({ entry }: { entry: PileEntry }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-800/50">
      <span className="text-xs text-gray-400 w-20 flex-none truncate">{entry.playerName}</span>
      <div className="flex gap-1 flex-wrap">
        {entry.cards.map((card) => (
          <Card key={card.id} card={card} size="sm" />
        ))}
      </div>
      {entry.effectiveRank && (
        <span className="text-[10px] text-gold/60 ml-auto flex-none">
          → {entry.effectiveRank}
        </span>
      )}
    </div>
  );
}

function CardGrid({ cards, emptyText }: { cards: CardType[]; emptyText: string }) {
  if (cards.length === 0) {
    return <div className="text-xs text-gray-500 italic py-4 text-center">{emptyText}</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {cards.map((card) => (
        <Card key={card.id} card={card} size="sm" />
      ))}
    </div>
  );
}

export function ZoneInspectorModal({ zone, state, onClose }: ZoneInspectorModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-lg w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-serif text-xl text-gold">{ZONE_TITLES[zone]}</h2>

          {zone === 'deck' && (
            <>
              <span className="text-xs text-gray-400">{state.deck.length} cartes</span>
              <div className="max-h-[60vh] overflow-y-auto w-full px-2">
                <CardGrid cards={state.deck} emptyText="Pioche vide" />
              </div>
            </>
          )}

          {zone === 'pile' && (
            <>
              <span className="text-xs text-gray-400">{state.pile.length} entrees</span>
              <div className="max-h-[60vh] overflow-y-auto w-full px-2">
                {state.pile.length === 0 ? (
                  <div className="text-xs text-gray-500 italic py-4 text-center">Pile vide</div>
                ) : (
                  state.pile.map((entry, i) => <PileEntryRow key={i} entry={entry} />)
                )}
              </div>
            </>
          )}

          {zone === 'graveyard' && (
            <>
              <span className="text-xs text-gray-400">{state.graveyard.length} cartes</span>
              <div className="max-h-[60vh] overflow-y-auto w-full px-2">
                <CardGrid cards={state.graveyard} emptyText="Cimetiere vide" />
              </div>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-2 rounded-xl bg-gold text-gray-900 font-bold text-sm"
            onClick={onClose}
          >
            Fermer
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
