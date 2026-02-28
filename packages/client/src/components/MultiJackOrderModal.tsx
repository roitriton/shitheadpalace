import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, GameState, MultiJackSequenceEntry, PendingMultiJackOrder } from '@shit-head-palace/engine';
import { Card } from './Card';

interface MultiJackOrderModalProps {
  state: GameState;
  humanId: string;
  onSubmit: (sequence: MultiJackSequenceEntry[]) => void;
}

/** Maps a jack's suit to its power name. */
function suitToPower(suit: CardType['suit'], hasSuper: boolean): string {
  switch (suit) {
    case 'diamonds': return hasSuper ? 'Super Révolution' : 'Révolution';
    case 'spades':   return hasSuper ? 'Super Manouche'   : 'Manouche';
    case 'hearts':   return hasSuper ? 'Flop Remake'      : 'Flop Reverse';
    case 'clubs':    return hasSuper ? 'Super Shifumi'    : 'Shifumi';
  }
}

/** Color class for each suit power. */
function suitPowerColor(suit: CardType['suit']): string {
  switch (suit) {
    case 'diamonds': return 'text-purple-400';
    case 'spades':   return 'text-blue-400';
    case 'hearts':   return 'text-pink-400';
    case 'clubs':    return 'text-green-400';
  }
}

export function MultiJackOrderModal({ state, humanId, onSubmit }: MultiJackOrderModalProps) {
  const pending = state.pendingAction as PendingMultiJackOrder;
  const { jacks, mirrors } = pending;
  const hasMirror = mirrors.length > 0;
  const mirrorCard = mirrors[0] ?? null;

  // Which jack gets the mirror (null = none assigned yet)
  const [mirrorAssignedTo, setMirrorAssignedTo] = useState<string | null>(null);
  // Ordered list of jack card IDs (in resolution order)
  const [orderedJackIds, setOrderedJackIds] = useState<string[]>([]);

  // Derive the order number for each jack
  const jackOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    orderedJackIds.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [orderedJackIds]);

  const handleJackClick = (jackId: string) => {
    if (orderedJackIds.includes(jackId)) {
      // Remove this jack and all after it from the order
      const idx = orderedJackIds.indexOf(jackId);
      setOrderedJackIds(orderedJackIds.slice(0, idx));
    } else {
      // Add to order
      setOrderedJackIds([...orderedJackIds, jackId]);
    }
  };

  const handleMirrorToggle = (jackId: string) => {
    if (mirrorAssignedTo === jackId) {
      setMirrorAssignedTo(null);
    } else {
      setMirrorAssignedTo(jackId);
    }
  };

  const allJacksOrdered = orderedJackIds.length === jacks.length;
  const mirrorOk = !hasMirror || mirrorAssignedTo !== null;
  const canConfirm = allJacksOrdered && mirrorOk;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const sequence: MultiJackSequenceEntry[] = orderedJackIds.map((jackId) => {
      const jackCard = jacks.find((j) => j.id === jackId)!;
      const entry: MultiJackSequenceEntry = { jackCard };
      if (hasMirror && mirrorAssignedTo === jackId) {
        entry.mirrorCard = mirrorCard!;
      }
      return entry;
    });
    onSubmit(sequence);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-md w-full mx-4">
        <h3 className="font-serif text-xl text-gold">Multi-Valets</h3>

        {hasMirror && (
          <p className="text-sm text-gray-300 text-center">
            Attribuez le 9 à un valet, puis choisissez l&apos;ordre de résolution.
          </p>
        )}
        {!hasMirror && (
          <p className="text-sm text-gray-300 text-center">
            Choisissez l&apos;ordre de résolution des valets.
          </p>
        )}

        {/* Mirror assignment */}
        {hasMirror && mirrorCard && (
          <div className="w-full">
            <p className="text-xs text-gray-400 mb-2">Mirror (9) :</p>
            <div className="flex justify-center mb-2">
              <Card card={mirrorCard} size="sm" noLayout selected={mirrorAssignedTo !== null} />
            </div>
            <div className="flex gap-2 justify-center">
              {jacks.map((jack) => (
                <motion.button
                  key={`mirror-${jack.id}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleMirrorToggle(jack.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    mirrorAssignedTo === jack.id
                      ? 'bg-gold text-gray-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mirrorAssignedTo === jack.id ? '✓ ' : ''}J{suitSymbol(jack.suit)}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Jack cards with order */}
        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">
            Cliquez pour choisir l&apos;ordre ({orderedJackIds.length}/{jacks.length}) :
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {jacks.map((jack) => {
              const orderNum = jackOrderMap.get(jack.id);
              const isOrdered = orderNum !== undefined;
              const hasThisMirror = mirrorAssignedTo === jack.id;
              const powerName = suitToPower(jack.suit, hasThisMirror);
              const colorClass = suitPowerColor(jack.suit);

              return (
                <div key={jack.id} className="flex flex-col items-center gap-1">
                  <div className="relative cursor-pointer" onClick={() => handleJackClick(jack.id)}>
                    <Card card={jack} size="sm" noLayout selected={isOrdered} />
                    {isOrdered && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold text-gray-900 flex items-center justify-center text-xs font-bold">
                        {orderNum}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold ${colorClass}`}>
                    {powerName}
                  </span>
                  {hasThisMirror && (
                    <span className="text-[9px] text-gold">+ Mirror</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status message */}
        <p className={`text-xs min-h-[1.25rem] ${canConfirm ? 'text-gold' : 'text-gray-500'}`}>
          {!mirrorOk
            ? 'Attribuez le 9 à un valet.'
            : !allJacksOrdered
              ? `Cliquez les valets dans l'ordre voulu.`
              : 'Prêt à confirmer !'}
        </p>

        {/* Confirm button */}
        <motion.button
          whileHover={canConfirm ? { scale: 1.03 } : {}}
          whileTap={canConfirm ? { scale: 0.97 } : {}}
          onClick={handleConfirm}
          disabled={!canConfirm}
          className={`w-full px-4 py-2.5 rounded-full font-semibold text-sm ${
            canConfirm
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirmer l&apos;ordre
        </motion.button>
      </div>
    </motion.div>
  );
}

/** Unicode symbol for a suit. */
function suitSymbol(suit: CardType['suit']): string {
  switch (suit) {
    case 'hearts':   return '♥';
    case 'diamonds': return '♦';
    case 'spades':   return '♠';
    case 'clubs':    return '♣';
  }
}
