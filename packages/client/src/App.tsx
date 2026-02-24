import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, ShifumiChoice } from '@shit-head-palace/engine';
import { getActiveZone, matchesPowerRank, isManoucheCard } from '@shit-head-palace/engine';
import { SwapPhase } from './components/SwapPhase';
import { DebugSwapPhase } from './components/DebugSwapPhase';
import { GameBoard } from './components/GameBoard';
import { DebugToolbar, DebugLogPanel, ZoneInspectorModal, type InspectZone } from './components/DebugPanel';

// ─── Socket (singleton module-level) ──────────────────────────────────────────

const socket: Socket = io('/');

// ─── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Card IDs waiting for a target to be picked before the play is sent (J♠)
  const [targetPickerCardIds, setTargetPickerCardIds] = useState<string[] | null>(null);

  // Debug state (dev mode only)
  const [debugRevealHands, setDebugRevealHands] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [debugInspectZone, setDebugInspectZone] = useState<InspectZone | null>(null);

  // Ref for always-current state (avoid stale closures in socket handlers)
  const humanIdRef = useRef(humanId);
  humanIdRef.current = humanId;

  useEffect(() => {
    socket.on(
      'game:state',
      ({ state, playerId }: { state: GameState; playerId: string }) => {
        console.log('[game:state] Received:', {
          phase: state.phase,
          currentPlayerIndex: state.currentPlayerIndex,
          playerCount: state.players.length,
          pendingAction: state.pendingAction?.type ?? null,
          humanFound: state.players.some((p) => p.id === playerId),
        });
        setGameState(state);
        setHumanId(playerId);
        setSelectedCards([]);
        setTargetPickerCardIds(null);
      },
    );

    socket.on('game:error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 3500);
    });

    return () => {
      socket.off('game:state');
      socket.off('game:error');
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const emit = (event: string, data?: unknown) => socket.emit(event, data);

  /**
   * Returns true when the selected cards include a J♠ (Manouche / Super Manouche)
   * that requires a targetPlayerId before the play can be submitted.
   * Disabled during revolution/superRevolution (powers suppressed).
   */
  const requiresTargetPicker = (cards: CardType[]): boolean => {
    if (!gameState) return false;
    const { phase } = gameState;
    if (phase === 'revolution' || phase === 'superRevolution') return false;
    return cards.some((c) => isManoucheCard(c));
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCardClick = (card: CardType) => {
    if (!gameState) return;
    const human = gameState.players.find((p) => p.id === humanId);
    if (!human) return;

    const zone = getActiveZone(human);
    if (!zone || zone === 'faceDown') return; // faceDown handled separately

    const humanIdx = gameState.players.findIndex((p) => p.id === humanId);
    if (gameState.currentPlayerIndex !== humanIdx) return;

    setSelectedCards((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);

      if (prev.length > 0) {
        const allCards = gameState.players.flatMap((p) => [...p.hand, ...p.faceUp]);
        const prevCards = prev
          .map((id) => allCards.find((c) => c.id === id))
          .filter((c): c is CardType => c !== undefined);

        const isMirror = (c: CardType) => matchesPowerRank(c.rank, gameState.variant, 'mirror');

        if (isMirror(card)) {
          // Mirror can accompany any selection — always allow
          return [...prev, card.id];
        }

        // Non-Mirror: allowed only if all existing non-Mirror cards share the same rank
        const prevNonMirrorRanks = [
          ...new Set(prevCards.filter((c) => !isMirror(c)).map((c) => c.rank)),
        ];
        if (prevNonMirrorRanks.length > 0 && !prevNonMirrorRanks.includes(card.rank)) {
          return prev;
        }
      }

      return [...prev, card.id];
    });
  };

  const handleFaceDownPlay = (card: CardType) => {
    if (!gameState) return;
    const { phase } = gameState;
    // J♠ face-down still triggers Manouche — show picker before playing
    if (isManoucheCard(card) && phase !== 'revolution' && phase !== 'superRevolution') {
      setTargetPickerCardIds([card.id]);
      return;
    }
    emit('game:action', { type: 'play', cardIds: [card.id] });
  };

  const handlePlay = () => {
    if (selectedCards.length === 0 || !gameState) return;

    // Resolve card objects to check for powers requiring a pre-play target
    const allCards = gameState.players.flatMap((p) => [...p.hand, ...p.faceUp]);
    const cards = selectedCards
      .map((id) => allCards.find((c) => c.id === id))
      .filter((c): c is CardType => c !== undefined);

    if (requiresTargetPicker(cards)) {
      setTargetPickerCardIds(selectedCards);
      return;
    }

    emit('game:action', { type: 'play', cardIds: selectedCards });
    setSelectedCards([]);
  };

  const handlePickUp = () => {
    emit('game:action', { type: 'pickUp' });
    setSelectedCards([]);
  };

  const handleSwap = (handCardId: string, flopCardId: string) => {
    emit('game:action', { type: 'swap', handCardId, flopCardId });
  };

  const handleReady = () => {
    emit('game:action', { type: 'ready' });
  };

  const handleDebugCompose = (hand: string[], faceUp: string[], faceDown: string[]) => {
    emit('game:debug-compose', { hand, faceUp, faceDown });
  };

  const handleRestart = () => {
    setSelectedCards([]);
    setError(null);
    setTargetPickerCardIds(null);
    emit('game:restart');
  };

  // ── Target picker callbacks (pre-play J♠) ──────────────────────────────────

  const handleTargetSelected = (targetId: string) => {
    if (!targetPickerCardIds) return;
    emit('game:action', {
      type: 'play',
      cardIds: targetPickerCardIds,
      targetPlayerId: targetId,
    });
    setSelectedCards([]);
    setTargetPickerCardIds(null);
  };

  const handleCancelTargetPicker = () => {
    setTargetPickerCardIds(null);
  };

  // ── Post-play pending action callbacks ─────────────────────────────────────

  /** Ace (Target): choose who plays next */
  const handleTargetChoice = (targetId: string) => {
    emit('game:action', { type: 'targetChoice', targetPlayerId: targetId });
  };

  /** J♠ Manouche: take one card from target, give all same-rank from hand */
  const handleManouchePick = (takeCardId: string, giveCardIds: string[]) => {
    emit('game:action', { type: 'manouchePick', takeCardId, giveCardIds });
  };

  /** J♠ + Mirror (Super Manouche): free 1-for-1 card exchange */
  const handleSuperManouchePick = (giveCardIds: string[], takeCardIds: string[]) => {
    emit('game:action', { type: 'superManouchePick', giveCardIds, takeCardIds });
  };

  /** J♣ (Shifumi): initiator picks 2 participants */
  const handleShifumiTarget = (player1Id: string, player2Id: string) => {
    emit('game:action', { type: 'shifumiTarget', player1Id, player2Id });
  };

  /** J♣ Shifumi / Super Shifumi: participant picks rock/paper/scissors */
  const handleShifumiChoice = (choice: ShifumiChoice) => {
    emit('game:action', { type: 'shifumiChoice', choice });
  };

  /** J♥ (Flop Reverse): launcher picks target */
  const handleFlopReverseTarget = (targetId: string) => {
    emit('game:action', { type: 'flopReverseTarget', targetPlayerId: targetId });
  };

  /** J♥ + Mirror (Flop Remake): launcher picks target */
  const handleFlopRemakeTarget = (targetId: string) => {
    emit('game:action', { type: 'flopRemakeTarget', targetPlayerId: targetId });
  };

  /** J♥ + Mirror (Flop Remake): target redistributes cards */
  const handleFlopRemake = (faceUp: string[], faceDown: string[]) => {
    emit('game:action', { type: 'flopRemake', faceUp, faceDown });
  };

  // ── Écran de chargement ──────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="min-h-screen bg-felt-dark flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="font-serif text-4xl text-gold mb-3">Shit Head Palace</h1>
          <p className="text-felt-light">Connexion au serveur…</p>
        </motion.div>
      </div>
    );
  }

  // ── Phase de swap ────────────────────────────────────────────────────────────

  if (gameState.phase === 'swapping') {
    const swapIsDev = import.meta.env.DEV;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="swap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {swapIsDev ? (
            <DebugSwapPhase
              state={gameState}
              humanId={humanId}
              onCompose={handleDebugCompose}
            />
          ) : (
            <SwapPhase
              state={gameState}
              humanId={humanId}
              onSwap={handleSwap}
              onReady={handleReady}
            />
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Plateau de jeu ───────────────────────────────────────────────────────────

  const isDev = import.meta.env.DEV;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="board"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`h-screen ${isDev ? 'pt-8' : ''}`}
      >
        {isDev && (
          <DebugToolbar
            revealHands={debugRevealHands}
            onToggleRevealHands={() => setDebugRevealHands((v) => !v)}
            panelOpen={debugPanelOpen}
            onTogglePanel={() => setDebugPanelOpen((v) => !v)}
          />
        )}
        <GameBoard
          state={gameState}
          humanId={humanId}
          selectedCards={selectedCards}
          onCardClick={handleCardClick}
          onFaceDownPlay={handleFaceDownPlay}
          onPlay={handlePlay}
          onPickUp={handlePickUp}
          onClearSelection={() => setSelectedCards([])}
          onRestart={handleRestart}
          error={error}
          targetPickerVisible={targetPickerCardIds !== null}
          onTargetSelected={handleTargetSelected}
          onCancelTargetPicker={handleCancelTargetPicker}
          onTargetChoice={handleTargetChoice}
          onManouchePick={handleManouchePick}
          onSuperManouchePick={handleSuperManouchePick}
          onShifumiTarget={handleShifumiTarget}
          onShifumiChoice={handleShifumiChoice}
          onFlopReverseTarget={handleFlopReverseTarget}
          onFlopRemakeTarget={handleFlopRemakeTarget}
          onFlopRemake={handleFlopRemake}
          debugRevealHands={isDev ? debugRevealHands : undefined}
          onInspectZone={isDev ? setDebugInspectZone : undefined}
        />
        {isDev && (
          <DebugLogPanel
            log={gameState.log}
            isOpen={debugPanelOpen}
          />
        )}
        {isDev && debugInspectZone && (
          <ZoneInspectorModal
            zone={debugInspectZone}
            state={gameState}
            onClose={() => setDebugInspectZone(null)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
