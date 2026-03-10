import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, Power, Rank, Suit, UniquePowerType } from '@shit-head-palace/engine';
import { DEFAULT_UNIQUE_POWER_SUITS } from '@shit-head-palace/engine';
import { Card } from './Card';
import { useTheme } from '../themes/ThemeContext';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

// ─── Compact power list (single column for narrow panel) ────────────────────

const POWER_NAMES: Record<Power, string> = {
  burn: 'Burn', reset: 'Reset', under: 'Under', skip: 'Skip', mirror: 'Mirror', target: 'Target',
  revolution: 'Révolution', superRevolution: 'Super Révo.', manouche: 'Manouche',
  superManouche: 'Super Man.', flopReverse: 'Flop Rev.', flopRemake: 'Flop Remake',
  shifumi: 'Shifumi', superShifumi: 'Super Shif.',
};

const SUIT_DISPLAY: Record<string, { symbol: string; color: string }> = {
  diamonds: { symbol: '♦', color: 'text-red-400' },
  spades: { symbol: '♠', color: 'text-gray-200' },
  hearts: { symbol: '♥', color: 'text-red-400' },
  clubs: { symbol: '♣', color: 'text-gray-200' },
};

const RANK_SORT: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

interface PowerRow { label: string; labelColor: string; name: string; sortKey: number }

function buildPowerRows(variant: GameState['variant']): PowerRow[] {
  const rows: PowerRow[] = [];
  for (const [power, rankOrRanks] of Object.entries(variant.powerAssignments)) {
    if (rankOrRanks === undefined) continue;
    const ranks: Rank[] = Array.isArray(rankOrRanks) ? rankOrRanks : [rankOrRanks];
    for (const rank of ranks) {
      rows.push({ label: rank, labelColor: 'text-gray-100', name: POWER_NAMES[power as Power] ?? power, sortKey: RANK_SORT[rank] ?? 0 });
    }
  }
  const ua = variant.uniquePowerAssignments ?? ({ J: DEFAULT_UNIQUE_POWER_SUITS } as Partial<Record<Rank, Record<Suit, UniquePowerType>>>);
  for (const [rank, suitMap] of Object.entries(ua)) {
    if (!suitMap) continue;
    for (const [suit, power] of Object.entries(suitMap)) {
      const si = SUIT_DISPLAY[suit];
      if (!si) continue;
      rows.push({ label: `${rank}${si.symbol}`, labelColor: si.color, name: POWER_NAMES[power as Power] ?? power, sortKey: RANK_SORT[rank] ?? 0 });
    }
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Zone = 'hand' | 'faceUp';

interface SelectedCard {
  id: string;
  zone: Zone;
}

interface SwapPhaseProps {
  state: GameState;
  humanId: string;
  roomName: string | null;
  onSwap: (handCardId: string, flopCardId: string) => void;
  onReady: () => void;
}

export function SwapPhase({ state, humanId, roomName, onSwap, onReady }: SwapPhaseProps) {
  const { theme } = useTheme();
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
    <div className="h-screen flex flex-col bg-casino-room">
      {/* Header */}
      <SiteHeader currentScreen="lobby" onNavigate={() => {}} navDisabled />

      {/* Table surface */}
      <div
        className="flex-1 min-h-0 relative flex flex-col overflow-hidden
          rounded-xl sm:rounded-[2rem] md:rounded-[2.5rem]
          mx-1 my-1 sm:mx-2 sm:my-1.5 md:mx-3 md:my-2
          border-4 sm:border-[5px] md:border-[6px] border-[#333333]
          shadow-[inset_0_0_40px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.7)] md:shadow-[inset_0_0_80px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.7)]"
        style={{
          backgroundImage: `url(${theme.bgImage})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
          backgroundSize: '512px 512px',
          backgroundColor: theme.bgColor,
        }}
      >
        {/* Bordure dorée intérieure */}
        <div className="absolute inset-0 rounded-lg sm:rounded-[1.5rem] md:rounded-[2rem] border border-gold/30 pointer-events-none" />
        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.9) 100%)' }}
        />

        <div className="relative z-[2] flex flex-col items-center justify-center flex-1 p-4 gap-4 w-full overflow-y-auto min-h-0">
        {/* Titre */}
        <div className="text-center">
          <h1 className="font-serif text-3xl text-[#c9a84c] mb-2">Phase de préparation</h1>
          <p className="text-gray-300 text-sm max-w-md leading-relaxed">
            Échangez vos cartes entre votre main et votre flop visible.
            Cliquez sur une carte pour la sélectionner, puis sur une autre pour les échanger.
            Placez vos meilleures cartes sur le flop !
          </p>
        </div>

        {/* 3-column layout */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[200px_1fr_200px] gap-4 items-start">

          {/* ── Left column: game info ── */}
          <div className="hidden md:block bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              {roomName ?? 'Partie'}
            </h3>
            <div className="space-y-1">
              {state.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.isReady ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span className={`text-xs truncate ${p.id === humanId ? 'text-[#c9a84c] font-semibold' : 'text-gray-400'}`}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Center column: cards ── */}
          <div className="flex flex-col gap-5 items-center">
            {/* Flop + dark flop stacked */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Votre flop</p>
              {/* Cards: dark flop behind, flop in front */}
              <div className="flex gap-3">
                {flopCards.map((card, i) => (
                  <div key={card.id} className="relative">
                    {/* Dark flop card behind */}
                    {human.faceDown[i] && (
                      <div className="relative z-0">
                        <Card card={human.faceDown[i]} faceDown size="md" noLayout />
                      </div>
                    )}
                    {/* Flop card overlapping on top */}
                    <div className="relative z-10 -mt-[4.5rem]">
                      <AnimatePresence mode="popLayout">
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
                      </AnimatePresence>
                    </div>
                  </div>
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

            {/* Instruction contextuelle */}
            <AnimatePresence>
              {selected && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="text-[#c9a84c] text-sm"
                >
                  Cliquez une autre carte pour échanger
                </motion.p>
              )}
            </AnimatePresence>

            {/* Bouton prêt */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={onReady}
                disabled={isReady}
                className={`px-10 py-3 rounded-full font-semibold text-lg shadow-lg transition-colors ${
                  isReady
                    ? 'bg-emerald-500 text-white cursor-default'
                    : 'bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900'
                }`}
              >
                {isReady ? 'Prêt !' : 'Je suis prêt'}
              </motion.button>
              {isReady && (
                <p className="text-gray-500 text-xs">En attente des autres joueurs...</p>
              )}
            </div>
          </div>

          {/* ── Right column: power summary (single column) ── */}
          <div className="hidden md:block bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] overflow-hidden">
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Pouvoirs
            </h3>
            <div className="flex flex-col gap-0.5">
              {buildPowerRows(state.variant).map((row, i) => (
                <div key={i} className="flex items-center gap-1 text-[9px] leading-tight">
                  <span className={`font-bold ${row.labelColor} min-w-[1.6rem] text-right`}>{row.label}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-gray-300 truncate">{row.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>

      <SiteFooter />
    </div>
  );
}

export default SwapPhase;
