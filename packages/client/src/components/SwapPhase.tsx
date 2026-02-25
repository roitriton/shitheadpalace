import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState } from '@shit-head-palace/engine';
import { Card } from './Card';

type Zone = 'hand' | 'faceUp';

interface SelectedCard {
  id: string;
  zone: Zone;
}

interface SwapPhaseProps {
  state: GameState;
  humanId: string;
  onSwap: (handCardId: string, flopCardId: string) => void;
  onReady: () => void;
}

export function SwapPhase({ state, humanId, onSwap, onReady }: SwapPhaseProps) {
  const human = state.players.find((p) => p.id === humanId);

  const [selected, setSelected] = useState<SelectedCard | null>(null);

  // Local order state for same-zone reordering
  const [handOrder, setHandOrder] = useState<string[]>(() =>
    human ? human.hand.map((c) => c.id) : [],
  );
  const [flopOrder, setFlopOrder] = useState<string[]>(() =>
    human ? human.faceUp.map((c) => c.id) : [],
  );

  // Sync local order when server state changes (after a cross-zone swap)
  const handIds = useMemo(() => (human ? human.hand.map((c) => c.id).join(',') : ''), [human?.hand]);
  const flopIds = useMemo(() => (human ? human.faceUp.map((c) => c.id).join(',') : ''), [human?.faceUp]);

  useEffect(() => {
    if (human) setHandOrder(human.hand.map((c) => c.id));
  }, [handIds]);

  useEffect(() => {
    if (human) setFlopOrder(human.faceUp.map((c) => c.id));
  }, [flopIds]);

  if (!human) return null;

  // Build ordered card arrays from local order
  const handCards = handOrder
    .map((id) => human.hand.find((c) => c.id === id))
    .filter((c): c is CardType => c !== undefined);
  const flopCards = flopOrder
    .map((id) => human.faceUp.find((c) => c.id === id))
    .filter((c): c is CardType => c !== undefined);

  const handleCardClick = (cardId: string, zone: Zone) => {
    if (!selected) {
      setSelected({ id: cardId, zone });
      return;
    }

    // Clicking the same card: deselect
    if (selected.id === cardId) {
      setSelected(null);
      return;
    }

    if (selected.zone !== zone) {
      // Cross-zone swap: hand ↔ flop
      const handCardId = selected.zone === 'hand' ? selected.id : cardId;
      const flopCardId = selected.zone === 'faceUp' ? selected.id : cardId;
      onSwap(handCardId, flopCardId);
    } else {
      // Same-zone reorder
      const setter = zone === 'hand' ? setHandOrder : setFlopOrder;
      setter((prev) => {
        const arr = [...prev];
        const i = arr.indexOf(selected.id);
        const j = arr.indexOf(cardId);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
      });
    }
    setSelected(null);
  };

  const isReady = human.isReady === true;

  return (
    <div className="min-h-screen bg-casino-room flex flex-col items-center justify-center p-6 gap-8">
      {/* Titre */}
      <div className="text-center">
        <h1 className="font-serif text-3xl text-gold mb-1">Phase de préparation</h1>
        <p className="text-felt-light text-sm">
          Cliquez une carte pour la sélectionner, puis une autre pour les échanger.
        </p>
      </div>

      <div className="flex flex-col gap-6 items-center">
        {/* FLOP (face visible) */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Votre flop (visible)</p>
          <div className="flex gap-3">
            <AnimatePresence mode="popLayout">
              {flopCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <Card
                    card={card}
                    selected={selected?.id === card.id}
                    onClick={() => handleCardClick(card.id, 'faceUp')}
                    size="md"
                    noLayout
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Flop caché — slots affichés comme dos de carte */}
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-2">
            Votre dark flop (caché)
          </p>
          <div className="flex gap-3">
            {human.faceDown.map((card) => (
              <Card key={card.id} card={card} faceDown size="md" noLayout />
            ))}
          </div>
        </div>

        {/* Main du joueur */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Votre main</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <AnimatePresence mode="popLayout">
              {handCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <Card
                    card={card}
                    selected={selected?.id === card.id}
                    onClick={() => handleCardClick(card.id, 'hand')}
                    size="md"
                    noLayout
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Instruction contextuelle */}
      <AnimatePresence>
        {selected && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="text-gold text-sm"
          >
            Cliquez une autre carte pour échanger
          </motion.p>
        )}
      </AnimatePresence>

      {/* Bouton prêt */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={onReady}
        disabled={isReady}
        className={`px-10 py-3 rounded-full font-semibold text-lg shadow-lg transition-colors ${
          isReady
            ? 'bg-green-700 text-green-200 cursor-default'
            : 'bg-gold text-gray-900 hover:bg-yellow-400'
        }`}
      >
        {isReady ? '✓ Prêt !' : 'Je suis prêt'}
      </motion.button>
    </div>
  );
}

export default SwapPhase;
