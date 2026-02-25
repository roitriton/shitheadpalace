import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, PileEntry, Card as CardType } from '@shit-head-palace/engine';
import { Card } from './Card';

// ─── DebugToolbar ───────────────────────────────────────────────────────────

interface DebugToolbarProps {
  revealHands: boolean;
  onToggleRevealHands: () => void;
}

export function DebugToolbar({
  revealHands,
  onToggleRevealHands,
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
    </div>
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
