import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, ShifumiChoice, LastPowerTriggered } from '@shit-head-palace/engine';
import { getActiveZone, matchesPowerRank, isManoucheCard } from '@shit-head-palace/engine';
import { SwapPhase } from './components/SwapPhase';
import { DebugSwapPhase } from './components/DebugSwapPhase';
import { GameBoard } from './components/GameBoard';
import { ZoneInspectorModal, type InspectZone } from './components/DebugPanel';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { ActionLog } from './components/ActionLog';
import { BottomBar } from './components/BottomBar';
import { TopBar } from './components/TopBar';

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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  // Action log state
  const [actionLogOpen, setActionLogOpen] = useState(false);
  const [actionLogUnread, setActionLogUnread] = useState(0);
  const actionLogOpenRef = useRef(actionLogOpen);
  actionLogOpenRef.current = actionLogOpen;
  const prevLogLengthRef = useRef(0);

  // Power overlay state
  const [currentPower, setCurrentPower] = useState<LastPowerTriggered | null>(null);
  const powerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPowerTypeRef = useRef<string | null>(null);

  // Debug state (dev mode only)
  const [debugRevealHands, setDebugRevealHands] = useState(false);
  const [debugInspectZone, setDebugInspectZone] = useState<InspectZone | null>(null);

  // Ref for always-current state (avoid stale closures in socket handlers)
  const humanIdRef = useRef(humanId);
  humanIdRef.current = humanId;

  useEffect(() => {
    socket.on(
      'game:state',
      ({ state, playerId }: { state: GameState; playerId: string }) => {
        setGameState(state);
        setHumanId(playerId);
        setSelectedCards([]);
        setTargetPickerCardIds(null);

        // Track unread log entries
        const newEntries = state.log.length - prevLogLengthRef.current;
        if (newEntries > 0 && !actionLogOpenRef.current) {
          setActionLogUnread((prev) => prev + newEntries);
        }
        prevLogLengthRef.current = state.log.length;

        // Track power overlay — show overlay when a new power is triggered
        const lpt = state.lastPowerTriggered;
        // Build a string fingerprint so we can detect new triggers reliably
        const lptKey = lpt ? `${lpt.type}|${lpt.playerId}|${state.log.length}` : null;
        if (lpt && lptKey !== prevPowerTypeRef.current) {
          setCurrentPower(lpt);
          if (powerTimerRef.current) clearTimeout(powerTimerRef.current);
          powerTimerRef.current = setTimeout(() => {
            setCurrentPower(null);
            powerTimerRef.current = null;
          }, 2250);
        }
        prevPowerTypeRef.current = lptKey;
      },
    );

    socket.on('game:error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 3500);
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) setChatUnread((prev) => prev + 1);
    });

    socket.on('chat:history', (msgs: ChatMessage[]) => {
      setChatMessages(msgs);
    });

    return () => {
      socket.off('game:state');
      socket.off('game:error');
      socket.off('chat:message');
      socket.off('chat:history');
      if (powerTimerRef.current) clearTimeout(powerTimerRef.current);
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const emit = (event: string, data?: unknown) => socket.emit(event, data);

  const handleChatSend = (message: string) => socket.emit('chat:send', { message });
  const isMobile = () => window.innerWidth < 768;

  const handleChatToggle = () =>
    setChatOpen((prev) => {
      const opening = !prev;
      if (opening) {
        setChatUnread(0);
        if (isMobile()) setActionLogOpen(false);
      }
      return opening;
    });

  const handleActionLogToggle = () =>
    setActionLogOpen((prev) => {
      const opening = !prev;
      if (opening) {
        setActionLogUnread(0);
        if (isMobile()) setChatOpen(false);
      }
      return opening;
    });

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
    setChatMessages([]);
    setChatUnread(0);
    setChatOpen(false);
    setActionLogOpen(false);
    setActionLogUnread(0);
    prevLogLengthRef.current = 0;
    setCurrentPower(null);
    prevPowerTypeRef.current = null;
    if (powerTimerRef.current) { clearTimeout(powerTimerRef.current); powerTimerRef.current = null; }
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
      <div className="min-h-screen bg-casino-room flex items-center justify-center">
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

  // Compute action bar state for BottomBar
  const humanIdx = gameState.players.findIndex((p) => p.id === humanId);
  const human = gameState.players[humanIdx];
  const isMyTurn = human ? gameState.currentPlayerIndex === humanIdx : false;
  const humanActiveZone = human ? getActiveZone(human) : null;
  const canPlay = isMyTurn && selectedCards.length > 0 && humanActiveZone !== 'faceDown';
  const canPickUp = isMyTurn && gameState.pile.length > 0;

  return (
    <>
    <AnimatePresence mode="wait">
      <motion.div
        key="board"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-screen bg-casino-room relative flex flex-col overflow-hidden pt-14 pb-14"
      >
        {/* Vignette sombre sur les bords de la salle */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        <TopBar
          gameType="Solo"
          isDev={isDev}
          revealHands={isDev ? debugRevealHands : undefined}
          onToggleRevealHands={isDev ? () => setDebugRevealHands((v) => !v) : undefined}
        />
        <GameBoard
          state={gameState}
          humanId={humanId}
          selectedCards={selectedCards}
          onCardClick={handleCardClick}
          onFaceDownPlay={handleFaceDownPlay}
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
          currentPower={currentPower}
        />
        <ChatPanel
          messages={chatMessages}
          isOpen={chatOpen}
          onToggle={handleChatToggle}
          onSend={handleChatSend}
          topBarOffset
        />
        <ActionLog
          log={gameState.log}
          isOpen={actionLogOpen}
          onToggle={handleActionLogToggle}
          topBarOffset
        />
        <BottomBar
          onChatToggle={handleChatToggle}
          chatUnread={chatUnread}
          canPlay={canPlay}
          canPickUp={canPickUp}
          selectedCount={selectedCards.length}
          onPlay={handlePlay}
          onPickUp={handlePickUp}
          onClearSelection={() => setSelectedCards([])}
          onActionLogToggle={handleActionLogToggle}
          actionLogUnread={actionLogUnread}
          overlayActive={currentPower !== null}
        />
        {isDev && debugInspectZone && (
          <ZoneInspectorModal
            zone={debugInspectZone}
            state={gameState}
            onClose={() => setDebugInspectZone(null)}
          />
        )}
      </motion.div>
    </AnimatePresence>
    </>
  );
}

export default App;
