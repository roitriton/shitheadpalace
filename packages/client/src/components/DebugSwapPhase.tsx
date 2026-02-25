import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, GameState, Suit, Rank } from '@shit-head-palace/engine';
import { SUITS, RANKS } from '@shit-head-palace/engine';
import { Card } from './Card';

// ─── Constantes ─────────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

type Zone = 'hand' | 'faceUp' | 'faceDown';

const ZONE_LABELS: Record<Zone, string> = {
  hand: 'Main',
  faceUp: 'Flop',
  faceDown: 'Dark Flop',
};

interface SelectedZoneCard {
  id: string;
  zone: Zone;
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface DebugSwapPhaseProps {
  state: GameState;
  humanId: string;
  onCompose: (hand: string[], faceUp: string[], faceDown: string[]) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Generate the 52-card reference deck (deckIndex 0). */
function buildFullDeck(): CardType[] {
  const cards: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}-${suit}-0`, suit, rank });
    }
  }
  return cards;
}

const FULL_DECK = buildFullDeck();

// ─── Component ──────────────────────────────────────────────────────────────────

export function DebugSwapPhase({ state, humanId, onCompose }: DebugSwapPhaseProps) {
  const human = state.players.find((p) => p.id === humanId);

  // Initialize zones with the player's currently dealt cards
  const [hand, setHand] = useState<CardType[]>(() => (human ? [...human.hand] : []));
  const [faceUp, setFaceUp] = useState<CardType[]>(() => (human ? [...human.faceUp] : []));
  const [faceDown, setFaceDown] = useState<CardType[]>(() => (human ? [...human.faceDown] : []));
  const [activeZone, setActiveZone] = useState<Zone>('hand');
  const [selected, setSelected] = useState<SelectedZoneCard | null>(null);

  if (!human) return null;

  // All assigned card IDs
  const assignedIds = new Set([
    ...hand.map((c) => c.id),
    ...faceUp.map((c) => c.id),
    ...faceDown.map((c) => c.id),
  ]);

  const findZone = (cardId: string): Zone | null => {
    if (hand.some((c) => c.id === cardId)) return 'hand';
    if (faceUp.some((c) => c.id === cardId)) return 'faceUp';
    if (faceDown.some((c) => c.id === cardId)) return 'faceDown';
    return null;
  };

  const removeFromZone = (cardId: string) => {
    setHand((prev) => prev.filter((c) => c.id !== cardId));
    setFaceUp((prev) => prev.filter((c) => c.id !== cardId));
    setFaceDown((prev) => prev.filter((c) => c.id !== cardId));
  };

  const getZoneSetter = (zone: Zone) => {
    if (zone === 'hand') return setHand;
    if (zone === 'faceUp') return setFaceUp;
    return setFaceDown;
  };

  const getZoneCards = (zone: Zone): CardType[] => {
    if (zone === 'hand') return hand;
    if (zone === 'faceUp') return faceUp;
    return faceDown;
  };

  const handleZoneCardClick = (cardId: string, zone: Zone) => {
    if (!selected) {
      setSelected({ id: cardId, zone });
      return;
    }

    // Clicking the same card: deselect
    if (selected.id === cardId) {
      setSelected(null);
      return;
    }

    if (selected.zone === zone) {
      // Same zone: swap positions
      const setter = getZoneSetter(zone);
      setter((prev) => {
        const arr = [...prev];
        const i = arr.findIndex((c) => c.id === selected.id);
        const j = arr.findIndex((c) => c.id === cardId);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
      });
    } else {
      // Cross-zone: swap cards between zones
      const card1 = getZoneCards(selected.zone).find((c) => c.id === selected.id)!;
      const card2 = getZoneCards(zone).find((c) => c.id === cardId)!;

      const setter1 = getZoneSetter(selected.zone);
      const setter2 = getZoneSetter(zone);

      setter1((prev) => prev.map((c) => (c.id === selected.id ? card2 : c)));
      setter2((prev) => prev.map((c) => (c.id === cardId ? card1 : c)));
    }
    setSelected(null);
  };

  const handleGridClick = (card: CardType) => {
    // Clear zone selection when interacting with the grid
    setSelected(null);

    const currentZone = findZone(card.id);
    if (currentZone) {
      // Already assigned: remove it
      removeFromZone(card.id);
      return;
    }

    // Check zone limits
    if (activeZone === 'faceUp' && faceUp.length >= 3) return;
    if (activeZone === 'faceDown' && faceDown.length >= 3) return;

    // Add to active zone
    if (activeZone === 'hand') setHand((prev) => [...prev, card]);
    else if (activeZone === 'faceUp') setFaceUp((prev) => [...prev, card]);
    else setFaceDown((prev) => [...prev, card]);
  };

  const handleSubmit = () => {
    const handIds = hand.map((c) => c.id);
    const faceUpIds = faceUp.map((c) => c.id);
    const faceDownIds = faceDown.map((c) => c.id);
    onCompose(handIds, faceUpIds, faceDownIds);
  };

  const canSubmit = faceUp.length === 3 && faceDown.length === 3 && hand.length > 0;

  // Zone count helpers
  const zoneCount = (zone: Zone): number => {
    if (zone === 'hand') return hand.length;
    if (zone === 'faceUp') return faceUp.length;
    return faceDown.length;
  };

  const zoneMax = (zone: Zone): string => {
    if (zone === 'hand') return '';
    return '/3';
  };

  const zoneCards = (zone: Zone): CardType[] => {
    if (zone === 'hand') return hand;
    if (zone === 'faceUp') return faceUp;
    return faceDown;
  };

  return (
    <div className="min-h-screen bg-casino-room flex flex-col items-center p-4 gap-4 overflow-y-auto">
      {/* Titre */}
      <div className="text-center">
        <h1 className="font-serif text-2xl text-gold mb-1">Debug — Composition libre</h1>
        <p className="text-felt-light text-sm">
          Composez librement la main, le flop et le dark flop depuis les 52 cartes.
        </p>
        <p className="text-felt-light text-xs mt-1">
          Dans les zones ci-dessous, cliquez une carte puis une autre pour les échanger.
        </p>
      </div>

      {/* Zone tabs */}
      <div className="flex gap-2">
        {(['hand', 'faceUp', 'faceDown'] as Zone[]).map((zone) => (
          <button
            key={zone}
            onClick={() => setActiveZone(zone)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              activeZone === zone
                ? 'bg-gold text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {ZONE_LABELS[zone]} ({zoneCount(zone)}
            {zoneMax(zone)})
          </button>
        ))}
      </div>

      {/* Zone previews with click-to-swap */}
      <div className="flex gap-8 flex-wrap justify-center">
        {(['hand', 'faceUp', 'faceDown'] as Zone[]).map((zone) => (
          <div
            key={zone}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
              activeZone === zone ? 'border-gold/50 bg-gold/5' : 'border-gray-700/50'
            }`}
            onClick={() => setActiveZone(zone)}
          >
            <p className="text-xs text-gray-400 uppercase tracking-widest">
              {ZONE_LABELS[zone]}
            </p>
            <div className="flex gap-1 flex-wrap justify-center min-h-[64px] min-w-[50px]">
              {zoneCards(zone).map((card) => (
                <div
                  key={card.id}
                  className="transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoneCardClick(card.id, zone);
                  }}
                >
                  <Card
                    card={card}
                    selected={selected?.id === card.id}
                    size="sm"
                    noLayout
                  />
                </div>
              ))}
              {zoneCards(zone).length === 0 && (
                <span className="text-gray-600 text-xs italic self-center">vide</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Instruction contextuelle pour le swap */}
      {selected && (
        <p className="text-gold text-xs">Cliquez une autre carte dans les zones pour échanger</p>
      )}

      {/* Card grid (52 cards, organized by suit) */}
      <div className="w-full max-w-2xl">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 text-center">
          Cliquez pour ajouter/retirer — zone active : {ZONE_LABELS[activeZone]}
        </p>
        <div className="flex flex-col gap-1 items-center">
          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-1">
              {RANKS.map((rank) => {
                const id = `${rank}-${suit}-0`;
                const card = FULL_DECK.find((c) => c.id === id)!;
                const zone = findZone(id);
                const isAssigned = zone !== null;
                return (
                  <div
                    key={id}
                    onClick={() => handleGridClick(card)}
                    className={`cursor-pointer transition-all ${
                      isAssigned ? 'opacity-30 scale-95' : 'hover:scale-110'
                    }`}
                    title={
                      isAssigned
                        ? `${card.rank}${SUIT_SYMBOL[card.suit]} → ${ZONE_LABELS[zone]}`
                        : `${card.rank}${SUIT_SYMBOL[card.suit]}`
                    }
                  >
                    <Card card={card} size="sm" noLayout />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <motion.button
        whileHover={canSubmit ? { scale: 1.04 } : {}}
        whileTap={canSubmit ? { scale: 0.97 } : {}}
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`px-10 py-3 rounded-full font-semibold text-lg shadow-lg transition-colors ${
          canSubmit
            ? 'bg-gold text-gray-900 hover:bg-yellow-400'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {canSubmit ? 'Prêt (debug)' : `Flop: ${faceUp.length}/3 · Dark: ${faceDown.length}/3 · Main: ${hand.length}`}
      </motion.button>
    </div>
  );
}

export default DebugSwapPhase;
