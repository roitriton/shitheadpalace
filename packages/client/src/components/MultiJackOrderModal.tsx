import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, GameState, MultiJackSequenceEntry, PendingMultiJackOrder } from '@shit-head-palace/engine';
import { Card } from './Card';
import { ModalWrapper } from './ModalWrapper';
import { ModalButton } from './ModalButton';

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

/** Unicode symbol for a suit. */
function suitSymbol(suit: CardType['suit']): string {
  switch (suit) {
    case 'hearts':   return '♥';
    case 'diamonds': return '♦';
    case 'spades':   return '♠';
    case 'clubs':    return '♣';
  }
}

/** Ordinal label for slot index. */
function slotLabel(index: number): string {
  switch (index) {
    case 0: return '1er';
    case 1: return '2ème';
    case 2: return '3ème';
    default: return `${index + 1}ème`;
  }
}

export function MultiJackOrderModal({ state, humanId, onSubmit }: MultiJackOrderModalProps) {
  const pending = state.pendingAction as PendingMultiJackOrder;
  const { jacks, mirrors } = pending;
  const hasMirror = mirrors.length > 0;
  const mirrorCard = mirrors[0] ?? null;

  // Which jack gets the mirror (null = none assigned yet)
  const [mirrorAssignedTo, setMirrorAssignedTo] = useState<string | null>(null);
  // Ordered list of jack card IDs (in resolution order) — corresponds to filled slots
  const [orderedJackIds, setOrderedJackIds] = useState<string[]>([]);

  // Jacks not yet assigned to a slot
  const availableJacks = useMemo(
    () => jacks.filter((j) => !orderedJackIds.includes(j.id)),
    [jacks, orderedJackIds],
  );

  // Click a jack in the available pool → assign to next free slot
  const handleAssignJack = useCallback((jackId: string) => {
    if (orderedJackIds.includes(jackId)) return;
    if (orderedJackIds.length >= jacks.length) return;
    setOrderedJackIds((prev) => [...prev, jackId]);
  }, [orderedJackIds, jacks.length]);

  // Click a jack in a slot → remove from slot (and all after)
  const handleRemoveFromSlot = useCallback((slotIndex: number) => {
    setOrderedJackIds((prev) => prev.slice(0, slotIndex));
  }, []);

  // Drag and drop support
  const handleDragStart = useCallback((e: React.DragEvent, jackId: string) => {
    e.dataTransfer.setData('text/plain', jackId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleSlotDrop = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    const jackId = e.dataTransfer.getData('text/plain');
    if (!jackId) return;
    // Only allow drop if slot is the next free slot and jack is available
    if (slotIndex !== orderedJackIds.length) return;
    if (orderedJackIds.includes(jackId)) return;
    setOrderedJackIds((prev) => [...prev, jackId]);
  }, [orderedJackIds]);

  const handleSlotDragOver = useCallback((e: React.DragEvent, slotIndex: number) => {
    if (slotIndex === orderedJackIds.length) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }, [orderedJackIds]);

  const handleMirrorToggle = (jackId: string) => {
    setMirrorAssignedTo((prev) => (prev === jackId ? null : jackId));
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
    <ModalWrapper title="Ordre des Valets" subtitle="Choisissez l'ordre de résolution des valets.">
      {/* ── Numbered slots ─────────────────────────────────────────── */}
      <div className="w-full">
        <p className="text-xs text-gray-400 mb-2">Ordre de résolution :</p>
        <div className="flex gap-3 justify-center">
          {jacks.map((_, slotIndex) => {
            const jackId = orderedJackIds[slotIndex];
            const jack = jackId ? jacks.find((j) => j.id === jackId) : null;
            const hasThisMirror = jack ? mirrorAssignedTo === jack.id : false;
            const powerName = jack ? suitToPower(jack.suit, hasThisMirror) : '';
            const colorClass = jack ? suitPowerColor(jack.suit) : '';
            const isFilled = !!jack;

            return (
              <div
                key={`slot-${slotIndex}`}
                className="flex flex-col items-center gap-1"
                onDrop={(e) => handleSlotDrop(e, slotIndex)}
                onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
              >
                {/* Slot label */}
                <span className="text-[10px] text-gray-500 font-semibold">
                  {slotLabel(slotIndex)}
                </span>

                {/* Slot content */}
                {isFilled ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative cursor-pointer"
                    onClick={() => handleRemoveFromSlot(slotIndex)}
                  >
                    <Card card={jack!} size="sm" noLayout selected />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 text-gray-900 flex items-center justify-center text-xs font-bold">
                      {slotIndex + 1}
                    </div>
                  </motion.div>
                ) : (
                  <div
                    className={`w-[52px] h-[73px] rounded-lg flex items-center justify-center text-gray-600 text-lg ${
                      slotIndex === orderedJackIds.length
                        ? 'border-2 border-dashed border-amber-400/40'
                        : 'border-2 border-dashed border-gray-700'
                    }`}
                  >
                    {slotIndex + 1}
                  </div>
                )}

                {/* Power name under filled slot */}
                {isFilled && (
                  <span className={`text-[10px] font-semibold ${colorClass}`}>
                    {powerName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Available jacks pool ─────────────────────────────────── */}
      {availableJacks.length > 0 && (
        <div className="w-full mt-4">
          <p className="text-xs text-gray-400 mb-2">
            Valets disponibles — cliquez ou glissez :
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {availableJacks.map((jack) => {
              const powerName = suitToPower(jack.suit, false);
              const colorClass = suitPowerColor(jack.suit);

              return (
                <div key={jack.id} className="flex flex-col items-center gap-1">
                  <div
                    className="cursor-pointer"
                    draggable
                    onDragStart={(e) => handleDragStart(e, jack.id)}
                    onClick={() => handleAssignJack(jack.id)}
                  >
                    <Card card={jack} size="sm" noLayout />
                  </div>
                  <span className={`text-[10px] font-semibold ${colorClass}`}>
                    J{suitSymbol(jack.suit)} — {powerName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mirror assignment (below slots, J+J+9 only) ─────────── */}
      {hasMirror && mirrorCard && (
        <div className="w-full border-t border-gray-700 pt-3 mt-4">
          <div className="flex items-center gap-2 mb-2 justify-center">
            <Card card={mirrorCard} size="xs" noLayout />
            <p className="text-xs text-gray-300">
              Attribuez le 9 à un valet pour déclencher sa version Super
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            {jacks.map((jack) => {
              const superName = suitToPower(jack.suit, true);
              const isAssigned = mirrorAssignedTo === jack.id;
              return (
                <button
                  key={`mirror-${jack.id}`}
                  onClick={() => handleMirrorToggle(jack.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isAssigned
                      ? 'bg-amber-400 text-gray-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isAssigned ? '\u2713 ' : '\u2192 '}{superName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status message ──────────────────────────────────────── */}
      <p className={`text-xs min-h-[1.25rem] mt-2 ${canConfirm ? 'text-amber-400' : 'text-gray-500'}`}>
        {!mirrorOk
          ? 'Attribuez le 9 à un valet.'
          : !allJacksOrdered
            ? 'Placez les valets dans les slots.'
            : 'Prêt à confirmer !'}
      </p>

      {/* ── Confirm button ──────────────────────────────────────── */}
      <div className="mt-4">
        <ModalButton variant="confirm" disabled={!canConfirm} onClick={handleConfirm}>
          Confirmer l&apos;ordre
        </ModalButton>
      </div>
    </ModalWrapper>
  );
}
