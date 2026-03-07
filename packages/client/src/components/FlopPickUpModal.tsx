import React, { useState } from 'react';
import type { Card as CardType, GameState, GameVariant } from '@shit-head-palace/engine';
import { matchesPowerRank } from '@shit-head-palace/engine';
import { Card } from './Card';
import { ModalWrapper } from './ModalWrapper';
import { ModalButton } from './ModalButton';

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

  // Flatten all pile entries into a single card array for display
  const pileCards = state.pile.flatMap((entry) => entry.cards);

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
    <ModalWrapper
      title="Ramassage"
      subtitle="Vous ne pouvez rien jouer. Ramassez la pile, ou prenez aussi des cartes de votre flop de même valeur."
    >
      {/* Pile display */}
      {pileCards.length > 0 && (
        <div className="w-full mb-3">
          <p className="text-xs text-gray-400 mb-2">Pile ({pileCards.length} carte{pileCards.length > 1 ? 's' : ''}) :</p>
          <div className="flex gap-1 flex-wrap justify-center max-h-[120px] overflow-y-auto">
            {pileCards.map((card) => (
              <Card key={card.id} card={card} size="xs" noLayout />
            ))}
          </div>
        </div>
      )}

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
      <p className={`text-xs min-h-[1.25rem] mt-2 ${selected.length > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
        {selected.length > 0
          ? `${selected.length} carte${selected.length > 1 ? 's' : ''} s\u00e9lectionn\u00e9e${selected.length > 1 ? 's' : ''}`
          : 'S\u00e9lectionnez des cartes de m\u00eame valeur (optionnel)'}
      </p>

      <div className="flex gap-3 w-full mt-4">
        <div className="flex-1">
          <ModalButton variant="cancel" onClick={onPickUpOnly}>
            Ramasser la pile
          </ModalButton>
        </div>
        <div className="flex-1">
          <ModalButton
            variant="confirm"
            disabled={!canConfirm}
            onClick={() => canConfirm && onPickUpWithFlop(selected)}
          >
            Ramasser + flop
          </ModalButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
