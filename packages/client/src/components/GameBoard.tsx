import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, Player, ShifumiChoice, PendingShifumi } from '@shit-head-palace/engine';
import { getActiveZone, getTopPileValue } from '@shit-head-palace/engine';
import type { InspectZone } from './DebugPanel';
import { Card } from './Card';

// ─── Constantes ────────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

// ─── Zone de joueur (bot ou humain) ───────────────────────────────────────────

interface PlayerZoneProps {
  player: Player;
  isBot: boolean;
  isActive: boolean;
  activeZone: ReturnType<typeof getActiveZone>;
  selectedCards: string[];
  onCardClick?: (card: CardType) => void;
  onFaceDownClick?: (card: CardType) => void;
  debugRevealHands?: boolean;
}

function PlayerZone({
  player,
  isBot,
  isActive,
  activeZone,
  selectedCards,
  onCardClick,
  onFaceDownClick,
  debugRevealHands,
}: PlayerZoneProps) {
  const canClickHand = isActive && activeZone === 'hand' && !isBot;
  const canClickFaceUp = isActive && activeZone === 'faceUp' && !isBot;
  const canClickFaceDown = isActive && activeZone === 'faceDown' && !isBot;

  return (
    <div className={`flex flex-col items-center gap-2 ${isBot ? '' : 'mt-1'}`}>
      {/* Étiquette du joueur */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`text-xs font-semibold px-3 py-0.5 rounded-full ${
            isActive
              ? 'bg-gold text-gray-900 animate-pulse'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {player.name}
        </div>
      </div>

      {/* Main (en haut pour bot, en bas pour humain) */}
      {isBot ? (
        <div className="flex gap-1 mb-1">
          {player.hand.map((card) => (
            <Card key={card.id} card={card} faceDown={!debugRevealHands} size="sm" />
          ))}
          {player.hand.length === 0 && (
            <span className="text-gray-500 text-xs italic">main vide</span>
          )}
        </div>
      ) : null}

      {/* Flop empilé sur dark flop :
          ┌─────────┐  ← dark flop (faceDown), z-0
          │  ╔═════╗│  ← flop (faceUp), décalé de 12 px vers le bas, z-10
          │  ║     ║│    → ~12 px du dark flop dépasse en haut
          └──╚═════╝┘
      */}
      <div className="flex gap-2">
        {(player.faceDown.length > 0 || player.faceUp.length > 0) ? (
          Array.from({ length: Math.max(player.faceDown.length, player.faceUp.length) }).map(
            (_, i) => {
              const fdCard = player.faceDown[i];
              const fuCard = player.faceUp[i];
              return (
                <div key={i} className="relative w-11 h-[76px]">
                  {/* Dark flop — toujours derrière */}
                  {fdCard && (
                    <div className="absolute top-0 z-0">
                      <Card
                        card={fdCard}
                        faceDown={isBot ? !debugRevealHands : true}
                        size="sm"
                        onClick={canClickFaceDown ? () => onFaceDownClick?.(fdCard) : undefined}
                      />
                    </div>
                  )}
                  {/* Flop — décalé de 12 px quand dark flop présent */}
                  {fuCard && (
                    <div className={`absolute z-10 ${fdCard ? 'top-3' : 'top-0'}`}>
                      <Card
                        card={fuCard}
                        size="sm"
                        selected={!isBot && selectedCards.includes(fuCard.id)}
                        onClick={canClickFaceUp ? () => onCardClick?.(fuCard) : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            },
          )
        ) : (
          <div className="w-11 h-[76px] opacity-0" />
        )}
      </div>

      {/* Main humain (en bas) */}
      {!isBot && (
        <div className="flex gap-2 flex-wrap justify-center mt-1">
          <AnimatePresence mode="popLayout">
            {player.hand.map((card) => (
              <motion.div
                key={card.id}
                initial={{ scale: 0.7, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              >
                <Card
                  card={card}
                  selected={selectedCards.includes(card.id)}
                  onClick={canClickHand ? () => onCardClick?.(card) : undefined}
                  disabled={!canClickHand}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Zone centrale ─────────────────────────────────────────────────────────────

interface CenterAreaProps {
  state: GameState;
  onInspectZone?: (zone: InspectZone) => void;
}

function CenterArea({ state, onInspectZone }: CenterAreaProps) {
  const topEntry = state.pile[state.pile.length - 1];
  const topCard = topEntry?.cards[topEntry.cards.length - 1];
  const effectiveRank = topEntry?.effectiveRank;
  const topValue = getTopPileValue(state);

  return (
    <div className="flex items-center justify-center gap-8 py-2">
      {/* Pioche */}
      <div
        className={`flex flex-col items-center gap-1 ${onInspectZone ? 'cursor-pointer' : ''}`}
        onClick={onInspectZone ? () => onInspectZone('deck') : undefined}
      >
        <div className="relative">
          {state.deck.length > 1 && (
            <div className="absolute top-0.5 left-0.5 w-14 h-20 rounded-lg bg-blue-900 border-2 border-blue-800" />
          )}
          <div className="relative">
            <Card
              card={{ id: 'deck', suit: 'spades', rank: '2' }}
              faceDown
              size="md"
            />
          </div>
        </div>
        <span className="text-xs text-gray-400">{state.deck.length} carte{state.deck.length !== 1 ? 's' : ''}</span>
        {onInspectZone && <span className="text-[10px] text-gold/50 hover:text-gold transition-colors">inspecter</span>}
      </div>

      {/* Modifieurs actifs */}
      <div className="flex flex-col items-center gap-1 min-w-[80px]">
        <AnimatePresence>
          {state.pileResetActive && (
            <motion.div
              key="reset"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-bold"
            >
              RESET ★
            </motion.div>
          )}
          {state.activeUnder != null && (
            <motion.div
              key="under"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full font-bold"
            >
              ≤ {state.activeUnder}
            </motion.div>
          )}
          {state.phase === 'revolution' && (
            <motion.div
              key="rev"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full font-bold"
            >
              🔄 RÉVOLUTION
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pile */}
      <div
        className={`flex flex-col items-center gap-1 ${onInspectZone ? 'cursor-pointer' : ''}`}
        onClick={onInspectZone ? () => onInspectZone('pile') : undefined}
      >
        <div className="relative w-14 h-20">
          {/* Cartes "derrière" */}
          {state.pile.length > 2 && (
            <div className="absolute top-1 left-1 w-14 h-20 rounded-lg bg-gray-300 border-2 border-gray-400 opacity-40" />
          )}
          {state.pile.length > 1 && (
            <div className="absolute top-0.5 left-0.5 w-14 h-20 rounded-lg bg-white border-2 border-gray-300 opacity-70" />
          )}

          {/* Carte du dessus */}
          <AnimatePresence mode="wait">
            {topCard ? (
              <motion.div
                key={topCard.id}
                initial={{ scale: 0.7, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="absolute inset-0"
              >
                <Card card={topCard} size="md" />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center"
              >
                <span className="text-gray-600 text-xs">vide</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center">
          <span className="text-xs text-gray-400">
            Pile · {state.pile.length > 0
              ? `valeur ${effectiveRank != null ? `${effectiveRank} (Mirror)` : topValue ?? '?'}`
              : 'vide'}
          </span>
        </div>
        {onInspectZone && <span className="text-[10px] text-gold/50 hover:text-gold transition-colors">inspecter</span>}
      </div>

      {/* Cimetière */}
      <div
        className={`flex flex-col items-center gap-1 ${onInspectZone ? 'cursor-pointer' : ''}`}
        onClick={onInspectZone ? () => onInspectZone('graveyard') : undefined}
      >
        <div
          className="w-14 h-20 rounded-lg border-2 border-dashed border-red-900 bg-red-950/30 flex items-center justify-center"
          title="Cimetière"
        >
          {state.graveyard.length > 0 ? (
            <span className="text-red-400 font-bold text-sm">{state.graveyard.length}</span>
          ) : (
            <span className="text-red-900 text-xs">—</span>
          )}
        </div>
        <span className="text-xs text-gray-500">brûlées</span>
        {onInspectZone && <span className="text-[10px] text-gold/50 hover:text-gold transition-colors">inspecter</span>}
      </div>
    </div>
  );
}

// ─── Barre d'action ────────────────────────────────────────────────────────────

interface ActionBarProps {
  isMyTurn: boolean;
  selectedCards: string[];
  pileEmpty: boolean;
  onPlay: () => void;
  onPickUp: () => void;
  onClearSelection: () => void;
  status: string;
}

function ActionBar({
  isMyTurn,
  selectedCards,
  pileEmpty,
  onPlay,
  onPickUp,
  onClearSelection,
  status,
}: ActionBarProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-gray-300 h-5">{status}</p>
      <div className="flex gap-3">
        <motion.button
          whileHover={isMyTurn && selectedCards.length > 0 ? { scale: 1.05 } : {}}
          whileTap={isMyTurn && selectedCards.length > 0 ? { scale: 0.95 } : {}}
          onClick={onPlay}
          disabled={!isMyTurn || selectedCards.length === 0}
          className={`px-6 py-2 rounded-full font-semibold text-sm shadow transition-colors ${
            isMyTurn && selectedCards.length > 0
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Jouer {selectedCards.length > 0 ? `(${selectedCards.length})` : ''}
        </motion.button>

        {selectedCards.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearSelection}
            className="px-4 py-2 rounded-full text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Annuler
          </motion.button>
        )}

        <motion.button
          whileHover={isMyTurn && !pileEmpty ? { scale: 1.05 } : {}}
          whileTap={isMyTurn && !pileEmpty ? { scale: 0.95 } : {}}
          onClick={onPickUp}
          disabled={!isMyTurn || pileEmpty}
          className={`px-6 py-2 rounded-full font-semibold text-sm shadow transition-colors ${
            isMyTurn && !pileEmpty
              ? 'bg-red-800 text-white hover:bg-red-700'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Ramasser la pile
        </motion.button>
      </div>
    </div>
  );
}

// ─── TargetPickerModal ─────────────────────────────────────────────────────────

interface TargetPickerModalProps {
  title: string;
  description: string;
  players: Player[];
  humanId: string;
  onSelect: (targetId: string) => void;
  onCancel?: () => void;
  /** When true, the human player is included in the target list (e.g. Flop Reverse) */
  includeSelf?: boolean;
}

function TargetPickerModal({
  title,
  description,
  players,
  humanId,
  onSelect,
  onCancel,
  includeSelf,
}: TargetPickerModalProps) {
  const opponents = players.filter((p) => !p.isFinished && (includeSelf || p.id !== humanId));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl min-w-[240px]">
        <h3 className="font-serif text-xl text-gold">{title}</h3>
        <p className="text-sm text-gray-300 text-center">{description}</p>
        <div className="flex flex-col gap-2 w-full">
          {opponents.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(p.id)}
              className="px-4 py-2.5 rounded-full bg-gray-700 text-white hover:bg-gray-600 font-semibold text-sm"
            >
              {p.name}
            </motion.button>
          ))}
        </div>
        {onCancel && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            className="px-6 py-1.5 rounded-full text-sm bg-gray-800 text-gray-400 hover:bg-gray-700"
          >
            Annuler
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── ManouchePickModal ─────────────────────────────────────────────────────────

interface ManouchePickModalProps {
  state: GameState;
  humanId: string;
  onPick: (takeCardId: string, giveCardIds: string[]) => void;
}

function ManouchePickModal({ state, humanId, onPick }: ManouchePickModalProps) {
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(null);
  const [selectedGiveIds, setSelectedGiveIds] = React.useState<string[]>([]);

  const pending = state.pendingAction;
  if (pending?.type !== 'manouche') return null;

  const humanPlayer = state.players.find((p) => p.id === humanId)!;
  const target = state.players.find((p) => p.id === pending.targetId)!;

  // After selecting a give card, only cards of the same rank can be added
  const selectedGiveRank = selectedGiveIds.length > 0
    ? humanPlayer.hand.find((c) => c.id === selectedGiveIds[0])?.rank ?? null
    : null;

  const handleSelectTake = (card: CardType) => {
    if (selectedTakeId === card.id) {
      setSelectedTakeId(null);
      setSelectedGiveIds([]);
    } else {
      setSelectedTakeId(card.id);
      setSelectedGiveIds([]);
    }
  };

  const handleToggleGive = (cardId: string) => {
    setSelectedGiveIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  };

  const canConfirm = selectedTakeId !== null && selectedGiveIds.length > 0;

  const handleConfirm = () => {
    if (canConfirm) {
      onPick(selectedTakeId!, selectedGiveIds);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
        <h3 className="font-serif text-xl text-gold">Manouche ♠</h3>

        {/* Étape 1 : prendre une carte chez l'adversaire */}
        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">
            Prenez une carte chez{' '}
            <span className="font-semibold text-white">{target.name}</span> :
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {target.hand.map((card) => {
              const canTake = !card.hidden;
              const isSelected = selectedTakeId === card.id;
              return (
                <div
                  key={card.id}
                  className={`transition-transform ${
                    canTake
                      ? `cursor-pointer hover:scale-105 ${isSelected ? 'ring-2 ring-gold rounded-lg' : ''}`
                      : 'opacity-30 cursor-not-allowed'
                  }`}
                  onClick={() => canTake && handleSelectTake(card)}
                >
                  <Card card={card} size="md" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Étape 2 : choisir les cartes à donner (même valeur entre elles) */}
        {selectedTakeId && humanPlayer.hand.length > 0 && (
          <div className="w-full">
            <p className="text-xs text-gray-400 mb-2">
              Donnez une ou plusieurs cartes de même valeur :
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {humanPlayer.hand.map((card) => {
                const isSelected = selectedGiveIds.includes(card.id);
                // Once a give card is selected, only same-rank cards can be added
                const canGive = selectedGiveRank === null || card.rank === selectedGiveRank;
                return (
                  <div
                    key={card.id}
                    className={`transition-transform ${
                      canGive
                        ? `cursor-pointer hover:scale-105 ${isSelected ? 'ring-2 ring-gold rounded-lg' : ''}`
                        : `opacity-30 ${isSelected ? '' : 'cursor-not-allowed'}`
                    }`}
                    onClick={() => (canGive || isSelected) && handleToggleGive(card.id)}
                  >
                    <Card card={card} size="md" />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">
              {selectedGiveIds.length} carte(s) sélectionnée(s) (min. 1)
            </p>
          </div>
        )}

        <motion.button
          whileHover={canConfirm ? { scale: 1.05 } : {}}
          whileTap={canConfirm ? { scale: 0.95 } : {}}
          onClick={handleConfirm}
          disabled={!canConfirm}
          className={`px-8 py-2 rounded-full font-semibold text-sm ${
            canConfirm
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirmer l'échange
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── SuperManouchePickModal ────────────────────────────────────────────────────

interface SuperManouchePickModalProps {
  state: GameState;
  humanId: string;
  onPick: (giveCardIds: string[], takeCardIds: string[]) => void;
}

type SmZone = 'mine' | 'theirs';

function SuperManouchePickModal({ state, humanId, onPick }: SuperManouchePickModalProps) {
  const pending = state.pendingAction;
  if (pending?.type !== 'superManouche') return null;

  const humanPlayer = state.players.find((p) => p.id === humanId)!;
  const target = state.players.find((p) => p.id === pending.targetId)!;

  // Local copies for swap tracking — IDs only
  const [myIds, setMyIds] = React.useState<string[]>(() => humanPlayer.hand.map((c) => c.id));
  const [theirIds, setTheirIds] = React.useState<string[]>(() => target.hand.map((c) => c.id));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Card lookup across both hands
  const allCards = [...humanPlayer.hand, ...target.hand];
  const cardById = (id: string) => allCards.find((c) => c.id === id)!;

  const findZone = (cardId: string): SmZone | null => {
    if (myIds.includes(cardId)) return 'mine';
    if (theirIds.includes(cardId)) return 'theirs';
    return null;
  };

  const handleCardClick = (cardId: string) => {
    if (!selectedId) {
      setSelectedId(cardId);
      return;
    }

    // Clicking the same card: deselect
    if (selectedId === cardId) {
      setSelectedId(null);
      return;
    }

    const zone1 = findZone(selectedId)!;
    const zone2 = findZone(cardId)!;

    if (zone1 === zone2) {
      // Same zone: swap positions
      const setter = zone1 === 'mine' ? setMyIds : setTheirIds;
      setter((prev) => {
        const arr = [...prev];
        const i = arr.indexOf(selectedId);
        const j = arr.indexOf(cardId);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
      });
    } else {
      // Cross-zone: swap the two cards between hands
      setMyIds((prev) =>
        prev.map((id) => (id === selectedId ? cardId : id === cardId ? selectedId : id)),
      );
      setTheirIds((prev) =>
        prev.map((id) => (id === selectedId ? cardId : id === cardId ? selectedId : id)),
      );
    }
    setSelectedId(null);
  };

  // Original ID sets for diff
  const originalMyIds = new Set(humanPlayer.hand.map((c) => c.id));
  const originalTheirIds = new Set(target.hand.map((c) => c.id));

  // Confirm is valid when both hands have same count as before
  const isValid =
    myIds.length === humanPlayer.hand.length && theirIds.length === target.hand.length;

  const handleConfirm = () => {
    if (!isValid) return;
    // giveCardIds: cards that were originally mine but are now in their hand
    const giveCardIds = theirIds.filter((id) => originalMyIds.has(id));
    // takeCardIds: cards that were originally theirs but are now in my hand
    const takeCardIds = myIds.filter((id) => originalTheirIds.has(id));
    onPick(giveCardIds, takeCardIds);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
        <h3 className="font-serif text-xl text-gold">Super Manouche ♠</h3>
        <p className="text-sm text-gray-300 text-center">
          Cliquez sur une carte puis sur une autre pour les échanger avec{' '}
          <span className="font-semibold text-white">{target.name}</span>.
        </p>

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">
            Main de {target.name} :
          </p>
          <div className="flex gap-2 flex-wrap min-h-[64px]">
            {theirIds.map((id) => {
              const card = cardById(id);
              return (
                <Card
                  key={id}
                  card={card}
                  selected={selectedId === id}
                  size="sm"
                  noLayout
                  onClick={() => handleCardClick(id)}
                />
              );
            })}
          </div>
        </div>

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">Votre main :</p>
          <div className="flex gap-2 flex-wrap min-h-[64px]">
            {myIds.map((id) => {
              const card = cardById(id);
              return (
                <Card
                  key={id}
                  card={card}
                  selected={selectedId === id}
                  size="sm"
                  noLayout
                  onClick={() => handleCardClick(id)}
                />
              );
            })}
          </div>
        </div>

        {/* Instruction contextuelle — espace réservé pour éviter le redimensionnement */}
        <p className={`text-xs min-h-[1.25rem] ${selectedId ? 'text-gold' : 'text-transparent'}`}>
          Cliquez sur une autre carte pour échanger leurs places
        </p>

        <motion.button
          whileHover={isValid ? { scale: 1.05 } : {}}
          whileTap={isValid ? { scale: 0.95 } : {}}
          onClick={handleConfirm}
          disabled={!isValid}
          className={`px-8 py-2 rounded-full font-semibold text-sm ${
            isValid
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirmer l'échange
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── ShifumiTargetPickerModal ──────────────────────────────────────────────

interface ShifumiTargetPickerModalProps {
  title: string;
  description: string;
  players: Player[];
  onSelect: (player1Id: string, player2Id: string) => void;
}

function ShifumiTargetPickerModal({
  title,
  description,
  players,
  onSelect,
}: ShifumiTargetPickerModalProps) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const active = players.filter((p) => !p.isFinished);

  const handleClick = (playerId: string) => {
    setSelected((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= 2) return prev;
      return [...prev, playerId];
    });
  };

  const canConfirm = selected.length === 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl min-w-[240px]">
        <h3 className="font-serif text-xl text-gold">{title}</h3>
        <p className="text-sm text-gray-300 text-center">{description}</p>
        <div className="flex flex-col gap-2 w-full">
          {active.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleClick(p.id)}
              className={`px-4 py-2.5 rounded-full font-semibold text-sm transition-colors ${
                selected.includes(p.id)
                  ? 'bg-gold text-gray-900 ring-2 ring-gold'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              {p.name}
            </motion.button>
          ))}
        </div>
        <motion.button
          whileHover={canConfirm ? { scale: 1.05 } : {}}
          whileTap={canConfirm ? { scale: 0.95 } : {}}
          onClick={() => canConfirm && onSelect(selected[0]!, selected[1]!)}
          disabled={!canConfirm}
          className={`px-8 py-2 rounded-full font-semibold text-sm ${
            canConfirm
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirmer
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── ShifumiChoiceModal ───────────────────────────────────────────────────

interface ShifumiChoiceModalProps {
  isSuper: boolean;
  onChoice: (choice: ShifumiChoice) => void;
}

function ShifumiChoiceModal({ isSuper, onChoice }: ShifumiChoiceModalProps) {
  const choices: { value: ShifumiChoice; label: string; emoji: string }[] = [
    { value: 'rock', label: 'Pierre', emoji: '🪨' },
    { value: 'paper', label: 'Papier', emoji: '📄' },
    { value: 'scissors', label: 'Ciseaux', emoji: '✂️' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl min-w-[240px]">
        <h3 className="font-serif text-xl text-gold">
          {isSuper ? 'Super Shifumi ♣' : 'Shifumi ♣'}
        </h3>
        <p className="text-sm text-gray-300 text-center">Pierre-papier-ciseaux !</p>
        <div className="flex gap-3">
          {choices.map((c) => (
            <motion.button
              key={c.value}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onChoice(c.value)}
              className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-gray-700 text-white hover:bg-gray-600 font-semibold text-sm"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span>{c.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── FlopRemakeModal ──────────────────────────────────────────────────────

interface FlopRemakeModalProps {
  state: GameState;
  humanId: string;
  onSubmit: (faceUp: string[], faceDown: string[]) => void;
}

function FlopRemakeModal({ state, humanId, onSubmit }: FlopRemakeModalProps) {
  const human = state.players.find((p) => p.id === humanId)!;
  const allCards = [...human.faceUp, ...human.faceDown];

  const [faceUpIds, setFaceUpIds] = React.useState<string[]>(human.faceUp.map((c) => c.id));
  const [faceDownIds, setFaceDownIds] = React.useState<string[]>(human.faceDown.map((c) => c.id));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const findZone = (cardId: string): 'faceUp' | 'faceDown' | null => {
    if (faceUpIds.includes(cardId)) return 'faceUp';
    if (faceDownIds.includes(cardId)) return 'faceDown';
    return null;
  };

  const handleCardClick = (cardId: string) => {
    if (!selectedId) {
      setSelectedId(cardId);
      return;
    }

    // Clicking the same card: deselect
    if (selectedId === cardId) {
      setSelectedId(null);
      return;
    }

    const zone1 = findZone(selectedId)!;
    const zone2 = findZone(cardId)!;

    if (zone1 === zone2) {
      // Same zone: swap positions
      const setter = zone1 === 'faceUp' ? setFaceUpIds : setFaceDownIds;
      setter((prev) => {
        const arr = [...prev];
        const i = arr.indexOf(selectedId);
        const j = arr.indexOf(cardId);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
      });
    } else {
      // Cross-zone: swap the two cards between zones
      setFaceUpIds((prev) =>
        prev.map((id) => (id === selectedId ? cardId : id === cardId ? selectedId : id)),
      );
      setFaceDownIds((prev) =>
        prev.map((id) => (id === selectedId ? cardId : id === cardId ? selectedId : id)),
      );
    }
    setSelectedId(null);
  };

  const isValid =
    faceUpIds.length <= 3 &&
    faceDownIds.length <= 3 &&
    faceUpIds.length + faceDownIds.length === allCards.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
        <h3 className="font-serif text-xl text-gold">Flop Remake ♥</h3>
        <p className="text-sm text-gray-300 text-center">
          Cliquez sur une carte, puis sur une autre pour les échanger.
        </p>

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">
            Face visible ({faceUpIds.length}/3) :
          </p>
          <div className="flex gap-2 flex-wrap min-h-[64px]">
            {faceUpIds.map((id) => {
              const card = allCards.find((c) => c.id === id)!;
              return (
                <Card
                  key={id}
                  card={card}
                  selected={selectedId === id}
                  size="sm"
                  noLayout
                  onClick={() => handleCardClick(id)}
                />
              );
            })}
          </div>
        </div>

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">
            Face cachée ({faceDownIds.length}/3) :
          </p>
          <div className="flex gap-2 flex-wrap min-h-[64px]">
            {faceDownIds.map((id) => {
              const card = allCards.find((c) => c.id === id)!;
              return (
                <Card
                  key={id}
                  card={card}
                  selected={selectedId === id}
                  size="sm"
                  noLayout
                  onClick={() => handleCardClick(id)}
                />
              );
            })}
          </div>
        </div>

        {/* Instruction contextuelle — espace réservé pour éviter le redimensionnement */}
        <p className={`text-xs min-h-[1.25rem] ${selectedId ? 'text-gold' : 'text-transparent'}`}>
          Cliquez sur une autre carte pour échanger leurs places
        </p>

        <motion.button
          whileHover={isValid ? { scale: 1.05 } : {}}
          whileTap={isValid ? { scale: 0.95 } : {}}
          onClick={() => isValid && onSubmit(faceUpIds, faceDownIds)}
          disabled={!isValid}
          className={`px-8 py-2 rounded-full font-semibold text-sm ${
            isValid
              ? 'bg-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirmer
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Écran de fin ──────────────────────────────────────────────────────────────

interface GameOverProps {
  state: GameState;
  humanId: string;
  onRestart: () => void;
  onClose: () => void;
}

function GameOver({ state, humanId, onRestart, onClose }: GameOverProps) {
  const humanFinishPos = state.finishOrder.indexOf(humanId);
  const isWinner = humanFinishPos === 0;
  const isLoser = humanFinishPos === state.finishOrder.length - 1;

  const label = isWinner ? '🏆 Victoire !' : isLoser ? '💩 Shit Head !' : 'Partie terminée';
  const labelColor = isWinner ? 'text-gold' : isLoser ? 'text-red-400' : 'text-white';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
    >
      <div className="bg-gray-900 border border-gold/30 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl min-w-[280px]">
        <h2 className={`font-serif text-3xl font-bold ${labelColor}`}>{label}</h2>
        <div className="text-sm text-gray-400 text-center">
          {state.finishOrder.map((pid, i) => {
            const p = state.players.find((pl) => pl.id === pid);
            return (
              <div key={pid} className={pid === humanId ? 'text-white font-semibold' : ''}>
                {i + 1}. {p?.name ?? pid}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRestart}
            className="px-8 py-2.5 rounded-full bg-gold text-gray-900 font-semibold hover:bg-yellow-400"
          >
            Rejouer
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-8 py-2.5 rounded-full bg-gray-700 text-gray-300 font-semibold hover:bg-gray-600"
          >
            Fermer
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── GameBoard principal ───────────────────────────────────────────────────────

interface GameBoardProps {
  state: GameState;
  humanId: string;
  selectedCards: string[];
  onCardClick: (card: CardType) => void;
  onFaceDownPlay: (card: CardType) => void;
  onPlay: () => void;
  onPickUp: () => void;
  onClearSelection: () => void;
  onRestart: () => void;
  error: string | null;
  // Target picker (pre-play: choisir la cible avant d'envoyer J♠)
  targetPickerVisible?: boolean;
  onTargetSelected?: (targetId: string) => void;
  onCancelTargetPicker?: () => void;
  // Target choice (post-play As : choisir qui joue ensuite)
  onTargetChoice?: (targetId: string) => void;
  // Manouche / Super Manouche pick
  onManouchePick?: (takeCardId: string, giveCardIds: string[]) => void;
  onSuperManouchePick?: (giveCardIds: string[], takeCardIds: string[]) => void;
  // Shifumi (J♣)
  onShifumiTarget?: (player1Id: string, player2Id: string) => void;
  onShifumiChoice?: (choice: ShifumiChoice) => void;
  // Flop Reverse / Flop Remake (J♥)
  onFlopReverseTarget?: (targetId: string) => void;
  onFlopRemakeTarget?: (targetId: string) => void;
  onFlopRemake?: (faceUp: string[], faceDown: string[]) => void;
  // Debug (dev mode only)
  debugRevealHands?: boolean;
  onInspectZone?: (zone: InspectZone) => void;
}

export function GameBoard({
  state,
  humanId,
  selectedCards,
  onCardClick,
  onFaceDownPlay,
  onPlay,
  onPickUp,
  onClearSelection,
  onRestart,
  error,
  targetPickerVisible,
  onTargetSelected,
  onCancelTargetPicker,
  onTargetChoice,
  onManouchePick,
  onSuperManouchePick,
  onShifumiTarget,
  onShifumiChoice,
  onFlopReverseTarget,
  onFlopRemakeTarget,
  onFlopRemake,
  debugRevealHands,
  onInspectZone,
}: GameBoardProps) {
  const [gameOverDismissed, setGameOverDismissed] = React.useState(false);

  // Re-show popup when a new game finishes
  React.useEffect(() => {
    if (state.phase === 'finished') {
      setGameOverDismissed(false);
    }
  }, [state.phase]);

  const humanIdx = state.players.findIndex((p) => p.id === humanId);
  const human = state.players[humanIdx];
  const bots = state.players.filter((_, i) => i !== humanIdx);

  if (!human) {
    return (
      <div className="min-h-screen bg-felt-dark flex items-center justify-center">
        <p className="text-red-400">Erreur : joueur non trouvé (humanId={humanId})</p>
      </div>
    );
  }

  const isMyTurn = state.currentPlayerIndex === humanIdx;
  const isBotTurn = !isMyTurn && state.phase !== 'finished';
  const humanActiveZone = getActiveZone(human);

  // Pending actions the human needs to resolve
  const pending = state.pendingAction;
  const pendingTargetForHuman = pending?.type === 'target' && pending.launcherId === humanId;
  const pendingManoucheForHuman = pending?.type === 'manouche' && pending.launcherId === humanId;
  const pendingSuperManoucheForHuman =
    pending?.type === 'superManouche' && pending.launcherId === humanId;

  // Shifumi: human is initiator and needs to pick 2 players
  const pendingShifumiTargetForHuman =
    (pending?.type === 'shifumi' || pending?.type === 'superShifumi') &&
    (pending as PendingShifumi).initiatorId === humanId &&
    !(pending as PendingShifumi).player1Id;

  // Shifumi: human is participant and needs to choose rock/paper/scissors
  const shifumiPending =
    (pending?.type === 'shifumi' || pending?.type === 'superShifumi')
      ? (pending as PendingShifumi)
      : null;
  const pendingShifumiChoiceForHuman =
    shifumiPending !== null &&
    shifumiPending.player1Id !== undefined &&
    ((shifumiPending.player1Id === humanId && shifumiPending.player1Choice === undefined) ||
      (shifumiPending.player2Id === humanId && shifumiPending.player2Choice === undefined));

  // Shifumi: human is waiting for bot to choose
  const pendingShifumiWaiting =
    shifumiPending !== null &&
    shifumiPending.player1Id !== undefined &&
    !pendingShifumiChoiceForHuman &&
    !pendingShifumiTargetForHuman;

  // Flop Reverse: human is launcher and needs to pick target
  const pendingFlopReverseForHuman =
    pending?.type === 'flopReverse' && pending.launcherId === humanId;

  // Flop Remake: human is launcher and needs to pick target (step 1)
  const pendingFlopRemakeTargetForHuman =
    pending?.type === 'flopRemake' && pending.launcherId === humanId && !pending.targetId;

  // Flop Remake: human is target and needs to redistribute (step 2)
  const pendingFlopRemakeForHuman =
    pending?.type === 'flopRemake' && pending.targetId === humanId;

  // Message de statut
  let status = '';
  if (state.phase === 'finished') {
    status = 'Partie terminée';
  } else if (pendingTargetForHuman) {
    status = 'Choisissez qui jouera après vous.';
  } else if (pendingManoucheForHuman || pendingSuperManoucheForHuman) {
    status = 'Résolvez l\'échange Manouche.';
  } else if (pendingShifumiTargetForHuman) {
    status = 'Choisissez 2 joueurs pour le Shifumi.';
  } else if (pendingShifumiChoiceForHuman) {
    status = 'Pierre-papier-ciseaux !';
  } else if (pendingShifumiWaiting) {
    status = 'En attente du choix de l\'adversaire…';
  } else if (pendingFlopReverseForHuman) {
    status = 'Choisissez la cible du Flop Reverse.';
  } else if (pendingFlopRemakeTargetForHuman) {
    status = 'Choisissez la cible du Flop Remake.';
  } else if (pendingFlopRemakeForHuman) {
    status = 'Redistribuez vos cartes (flop + dark flop).';
  } else if (pending) {
    // Any other pending action where a bot needs to act
    status = 'En attente…';
  } else if (isBotTurn) {
    const activeBot = bots.find(
      (b) => state.players.findIndex((p) => p.id === b.id) === state.currentPlayerIndex,
    );
    status = `${activeBot?.name ?? 'Le bot'} réfléchit…`;
  } else if (isMyTurn) {
    if (humanActiveZone === 'faceDown') {
      status = 'Cliquez une carte à l\'aveugle pour jouer.';
    } else if (selectedCards.length > 0) {
      status = `${selectedCards.length} carte(s) sélectionnée(s) — Jouez ou ajoutez la même valeur.`;
    } else {
      status = 'À vous de jouer.';
    }
  }

  return (
    <div className="min-h-screen bg-felt-dark flex flex-col relative overflow-hidden select-none">
      {/* Bordure dorée décorative */}
      <div className="absolute inset-2 rounded-2xl border border-gold/20 pointer-events-none" />

      {/* Erreur */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-800/90 text-white px-4 py-2 rounded-full text-sm shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Zone Bots (haut) ── */}
      <div className="flex-none px-6 pt-4 flex justify-center gap-10">
        {bots.map((bot) => (
          <PlayerZone
            key={bot.id}
            player={bot}
            isBot={true}
            isActive={state.players.findIndex((p) => p.id === bot.id) === state.currentPlayerIndex}
            activeZone={getActiveZone(bot)}
            selectedCards={[]}
            debugRevealHands={debugRevealHands}
          />
        ))}
      </div>

      {/* ── Zone Centrale ── */}
      <div className="flex-none px-6 py-2">
        <CenterArea state={state} onInspectZone={onInspectZone} />
      </div>

      {/* ── Zone Humain (bas) ── */}
      <div className="flex-1 flex flex-col justify-end px-6 pb-2">
        <PlayerZone
          player={human}
          isBot={false}
          isActive={isMyTurn}
          activeZone={humanActiveZone}
          selectedCards={selectedCards}
          onCardClick={onCardClick}
          onFaceDownClick={onFaceDownPlay}
        />
      </div>

      {/* ── Barre d'actions ── */}
      <div className="flex-none pb-6 pt-2 flex justify-center">
        <ActionBar
          isMyTurn={isMyTurn && humanActiveZone !== 'faceDown'}
          selectedCards={selectedCards}
          pileEmpty={state.pile.length === 0}
          onPlay={onPlay}
          onPickUp={onPickUp}
          onClearSelection={onClearSelection}
          status={status}
        />
      </div>

      {/* ── Écran de fin ── */}
      <AnimatePresence>
        {state.phase === 'finished' && !gameOverDismissed && (
          <GameOver
            state={state}
            humanId={humanId}
            onRestart={onRestart}
            onClose={() => setGameOverDismissed(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Target picker (pre-play : sélection cible J♠) ── */}
      <AnimatePresence>
        {targetPickerVisible && onTargetSelected && (
          <TargetPickerModal
            title="Manouche ♠"
            description="Choisissez un adversaire pour l'échange."
            players={state.players}
            humanId={humanId}
            onSelect={onTargetSelected}
            onCancel={onCancelTargetPicker}
          />
        )}
      </AnimatePresence>

      {/* ── Target choice (post-play As : qui joue après ?) ── */}
      <AnimatePresence>
        {pendingTargetForHuman && onTargetChoice && (
          <TargetPickerModal
            title="Target ♦"
            description="Choisissez qui jouera après vous."
            players={state.players}
            humanId={humanId}
            onSelect={onTargetChoice}
          />
        )}
      </AnimatePresence>

      {/* ── Manouche pick ── */}
      <AnimatePresence>
        {pendingManoucheForHuman && onManouchePick && (
          <ManouchePickModal
            state={state}
            humanId={humanId}
            onPick={onManouchePick}
          />
        )}
      </AnimatePresence>

      {/* ── Super Manouche pick ── */}
      <AnimatePresence>
        {pendingSuperManoucheForHuman && onSuperManouchePick && (
          <SuperManouchePickModal
            state={state}
            humanId={humanId}
            onPick={onSuperManouchePick}
          />
        )}
      </AnimatePresence>

      {/* ── Shifumi target picker (initiator picks 2 players) ── */}
      <AnimatePresence>
        {pendingShifumiTargetForHuman && onShifumiTarget && (
          <ShifumiTargetPickerModal
            title={pending?.type === 'superShifumi' ? 'Super Shifumi ♣' : 'Shifumi ♣'}
            description="Choisissez 2 joueurs pour le duel."
            players={state.players}
            onSelect={onShifumiTarget}
          />
        )}
      </AnimatePresence>

      {/* ── Shifumi choice (participant picks rock/paper/scissors) ── */}
      <AnimatePresence>
        {pendingShifumiChoiceForHuman && onShifumiChoice && (
          <ShifumiChoiceModal
            isSuper={pending?.type === 'superShifumi'}
            onChoice={onShifumiChoice}
          />
        )}
      </AnimatePresence>

      {/* ── Flop Reverse target picker ── */}
      <AnimatePresence>
        {pendingFlopReverseForHuman && onFlopReverseTarget && (
          <TargetPickerModal
            title="Flop Reverse ♥"
            description="Choisissez un joueur dont le flop et le dark flop seront échangés."
            players={state.players}
            humanId={humanId}
            onSelect={onFlopReverseTarget}
            includeSelf
          />
        )}
      </AnimatePresence>

      {/* ── Flop Remake target picker (step 1) ── */}
      <AnimatePresence>
        {pendingFlopRemakeTargetForHuman && onFlopRemakeTarget && (
          <TargetPickerModal
            title="Flop Remake ♥"
            description="Choisissez un joueur qui redistribuera son flop et dark flop."
            players={state.players}
            humanId={humanId}
            onSelect={onFlopRemakeTarget}
            includeSelf
          />
        )}
      </AnimatePresence>

      {/* ── Flop Remake distribution (step 2) ── */}
      <AnimatePresence>
        {pendingFlopRemakeForHuman && onFlopRemake && (
          <FlopRemakeModal
            state={state}
            humanId={humanId}
            onSubmit={onFlopRemake}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameBoard;
