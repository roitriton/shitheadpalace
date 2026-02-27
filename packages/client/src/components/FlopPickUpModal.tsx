import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, GameState, GameVariant } from '@shit-head-palace/engine';
import { matchesPowerRank } from '@shit-head-palace/engine';
import { Card } from './Card';

interface FlopPickUpModalProps {
  state: GameState;
  humanId: string;
  onPickUpOnly: () => void;
  onPickUpWithFlop: (flopCardIds: string[]) => void;
}

/**
 * Returns true when the selected cards form a valid same-rank group
 * (mirrors act as jokers and can join any rank or be selected alone).
 */
function isValidGroup(selected: string[], flopCards: CardType[], variant: GameVariant): boolean {
  if (selected.length === 0) return false;
  const cards = selected.map((id) => flopCards.find((c) => c.id === id)!);
  const isMirror = (c: CardType) => matchesPowerRank(c.rank, variant, 'mirror');
  const nonMirrors = cards.filter((c) => !isMirror(c));
  if (nonMirrors.length === 0) return true; // all mirrors → valid
  const baseRank = nonMirrors[0]!.rank;
  return nonMirrors.every((c) => c.rank === baseRank);
}

export function FlopPickUpModal({ state, humanId, onPickUpOnly, onPickUpWithFlop }: FlopPickUpModalProps) {
  const human = state.players.find((p) => p.id === humanId)!;
  const flopCards = human.faceUp;
  const [selected, setSelected] = useState<string[]>([]);

  const isMirror = (c: CardType) => matchesPowerRank(c.rank, state.variant, 'mirror');

  const handleCardClick = (cardId: string) => {
    if (selected.includes(cardId)) {
      // Deselect
      setSelected((prev) => prev.filter((id) => id !== cardId));
      return;
    }

    const card = flopCards.find((c) => c.id === cardId)!;
    const newSelected = [...selected, cardId];

    // If this card is a mirror, it can join any group
    if (isMirror(card)) {
      setSelected(newSelected);
      return;
    }

    // Check if the new selection forms a valid group
    const nonMirrors = newSelected
      .map((id) => flopCards.find((c) => c.id === id)!)
      .filter((c) => !isMirror(c));

    if (nonMirrors.length <= 1) {
      // First non-mirror card → always valid
      setSelected(newSelected);
      return;
    }

    // Multiple non-mirrors: must share same rank
    const baseRank = nonMirrors[0]!.rank;
    if (card.rank === baseRank) {
      setSelected(newSelected);
    } else {
      // Different rank: reset selection to just this card (+ any mirrors)
      const keptMirrors = selected.filter((id) => {
        const c = flopCards.find((fc) => fc.id === id);
        return c && isMirror(c);
      });
      setSelected([...keptMirrors, cardId]);
    }
  };

  const canConfirm = selected.length > 0 && isValidGroup(selected, flopCards, state.variant);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
        <h3 className="font-serif text-xl text-gold">Ramassage</h3>
        <p className="text-sm text-gray-300 text-center">
          Vous ne pouvez rien jouer. Ramassez la pile, ou prenez aussi des cartes de votre flop de
          m&ecirc;me valeur.
        </p>

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">Votre flop :</p>
          <div className="flex gap-2 flex-wrap justify-center min-h-[64px]">
            {flopCards.map((card) => (
              <Card
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                size="sm"
                noLayout
                onClick={() => handleCardClick(card.id)}
              />
            ))}
          </div>
        </div>

        {/* Instruction contextuelle */}
        <p className={`text-xs min-h-[1.25rem] ${selected.length > 0 ? 'text-gold' : 'text-gray-500'}`}>
          {selected.length > 0
            ? `${selected.length} carte${selected.length > 1 ? 's' : ''} s\u00e9lectionn\u00e9e${selected.length > 1 ? 's' : ''}`
            : 'S\u00e9lectionnez des cartes de m\u00eame valeur (optionnel)'}
        </p>

        <div className="flex gap-3 w-full">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPickUpOnly}
            className="flex-1 px-4 py-2.5 rounded-full bg-red-700 text-white font-semibold text-sm hover:bg-red-600"
          >
            Ramasser la pile
          </motion.button>
          <motion.button
            whileHover={canConfirm ? { scale: 1.03 } : {}}
            whileTap={canConfirm ? { scale: 0.97 } : {}}
            onClick={() => canConfirm && onPickUpWithFlop(selected)}
            disabled={!canConfirm}
            className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-sm ${
              canConfirm
                ? 'bg-gold text-gray-900 hover:bg-yellow-400'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Ramasser + flop
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
