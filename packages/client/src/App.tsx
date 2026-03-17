import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, GameVariant, ShifumiChoice, LastPowerTriggered, MultiJackSequenceEntry } from '@shit-head-palace/engine';
import { getActiveZone, matchesPowerRank, canPlayerPlayAnything, canPlayCards } from '@shit-head-palace/engine';
import { SwapPhase } from './components/SwapPhase';
import { DebugSwapPhase } from './components/DebugSwapPhase';
import { GameBoard } from './components/GameBoard';
import { ZoneInspectorModal, type InspectZone } from './components/DebugPanel';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { ActionLog } from './components/ActionLog';
import { BottomBar } from './components/BottomBar';
import { TopBar } from './components/TopBar';
import { CardAnimationLayer } from './components/CardAnimationLayer';
import { useCardAnimations, CardAnimationContext } from './hooks/useCardAnimations';
import { AuthScreen } from './components/AuthScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { WaitingRoomScreen, type WaitingRoomData } from './components/WaitingRoomScreen';
import { RulesScreen } from './components/RulesScreen';
import { useAuth } from './auth/authContext';
import { SiteHeader } from './components/SiteHeader';
import { SiteLogo } from './components/SiteLogo';

type AppScreen = 'lobby' | 'waitingRoom' | 'game' | 'rules' | 'profile';

// ─── Placeholder screens ──────────────────────────────────────────────────────

function ProfileScreen({ onNavigate }: { onNavigate: (screen: 'lobby' | 'rules' | 'profile') => void }) {
  return (
    <div className="h-screen bg-casino-room flex flex-col overflow-y-auto">
      <SiteHeader currentScreen="profile" onNavigate={onNavigate} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-2xl text-[#c9a84c] mb-4">Profil</h2>
          <p className="text-gray-400">Page en construction</p>
        </div>
      </div>
    </div>
  );
}

// ─── Socket (singleton module-level, connects manually after auth) ───────────

const socket: Socket = io('/', { autoConnect: false });

// ─── App ───────────────────────────────────────────────────────────────────────

function App() {
  const { user, token, loading, logout } = useAuth();

  // Screen navigation
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('lobby');
  const [currentRoomName, setCurrentRoomName] = useState<string | null>(null);
  const [currentRoomData, setCurrentRoomData] = useState<WaitingRoomData | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedPlayerIds, setDisconnectedPlayerIds] = useState<string[]>([]);

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

  // Flop remake animation state
  const [flopRemakePlayerId, setFlopRemakePlayerId] = useState<string | null>(null);
  const [flopRemakeOldFaceUp, setFlopRemakeOldFaceUp] = useState<CardType[] | null>(null);
  const flopRemakeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLogLenForRemakeRef = useRef(0);

  // Ref for always-current gameState (needed by socket handler to capture old flop cards)
  const gameStateRef = useRef<GameState | null>(null);

  // Shifumi loser overlay state
  const [shifumiLoserOverlay, setShifumiLoserOverlay] = useState<{ loserId: string; isSuper: boolean } | null>(null);

  // Debug state (solo debug mode only)
  const [debugRevealHands, setDebugRevealHands] = useState(false);
  const [debugInspectZone, setDebugInspectZone] = useState<InspectZone | null>(null);
  const [soloDebugMode, setSoloDebugMode] = useState(false);

  // Ref for always-current state (avoid stale closures in socket handlers)
  const humanIdRef = useRef(humanId);
  humanIdRef.current = humanId;

  // Ref for current screen (needed by socket handlers registered with [] deps)
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  // Card flight animations
  const { animations: cardAnimations, hiddenCardIds, onAnimationComplete: onCardAnimComplete, isAnimating: isCardAnimating } = useCardAnimations(gameState, humanId);

  // ── Socket connection (reactive to auth token) ──────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!token) {
      socket.disconnect();
      return;
    }
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    } else {
      // Reconnect with new token
      socket.disconnect().connect();
    }

    // Check for active game to rejoin on connect
    const handleConnect = () => {
      socket.emit('lobby:checkActiveGame');
    };
    const handleActiveGame = ({ roomId }: { roomId: string | null }) => {
      if (roomId) {
        socket.emit('room:join', { roomId });
      }
    };
    socket.on('connect', handleConnect);
    socket.on('lobby:activeGame', handleActiveGame);
    // Also check immediately if already connected
    if (socket.connected) {
      socket.emit('lobby:checkActiveGame');
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby:activeGame', handleActiveGame);
      socket.disconnect();
    };
  }, [token, loading]);

  useEffect(() => {
    socket.on(
      'game:state',
      ({ state, playerId, shifumiLoserOverlay: overlaySignal, disconnectedPlayerIds: dcIds }: { state: GameState; playerId: string; shifumiLoserOverlay?: { loserId: string; isSuper: boolean }; disconnectedPlayerIds?: string[] }) => {
        setGameState(state);
        setHumanId(playerId);
        setSelectedCards([]);
        setCurrentScreen('game');
        if (dcIds) setDisconnectedPlayerIds(dcIds);

        // Save old log length BEFORE updating — needed for overlay delay calculation
        const oldLogLength = prevLogLengthRef.current;

        // Track unread log entries
        const newLogCount = state.log.length - oldLogLength;
        if (newLogCount > 0 && !actionLogOpenRef.current) {
          setActionLogUnread((prev) => prev + newLogCount);
        }
        prevLogLengthRef.current = state.log.length;

        // Track power overlay — delay display until card flight animations complete
        const lpt = state.lastPowerTriggered;
        const lptKey = lpt ? `${lpt.type}|${lpt.playerId}|${state.log.length}` : null;
        if (lpt && lptKey !== prevPowerTypeRef.current) {
          // Compute card flight duration from new play log entries
          const recentEntries = state.log.slice(oldLogLength);
          let maxPlayEndTime = 0;
          for (const entry of recentEntries) {
            if (entry.type === 'play' || entry.type === 'darkPlay') {
              const cIds = (entry.data.cardIds as string[] | undefined);
              const cId = (entry.data.cardId as string | undefined);
              const count = cIds ? cIds.length : (cId ? 1 : 0);
              const endTime = (count > 1 ? (count - 1) * 50 : 0) + 800;
              if (endTime > maxPlayEndTime) maxPlayEndTime = endTime;
            }
          }
          const overlayDelay = maxPlayEndTime > 0 ? maxPlayEndTime + 100 : 0;

          if (powerTimerRef.current) clearTimeout(powerTimerRef.current);
          powerTimerRef.current = setTimeout(() => {
            setCurrentPower(lpt);
            powerTimerRef.current = setTimeout(() => {
              setCurrentPower(null);
              powerTimerRef.current = null;
            }, 1500);
          }, overlayDelay);
        }
        prevPowerTypeRef.current = lptKey;

        // Detect flopRemakeDone in new log entries → trigger rainbow animation
        // Must capture old faceUp BEFORE setGameState updates the rendered cards
        const remakeOldLen = prevLogLenForRemakeRef.current;
        prevLogLenForRemakeRef.current = state.log.length;
        if (state.log.length > remakeOldLen) {
          for (let i = remakeOldLen; i < state.log.length; i++) {
            const entry = state.log[i]!;
            if (entry.type === 'flopRemakeDone' && entry.playerId) {
              const targetId = entry.playerId as string;
              // Capture old faceUp from pre-update state
              const oldState = gameStateRef.current;
              if (oldState) {
                const targetPlayer = oldState.players.find((p) => p.id === targetId);
                if (targetPlayer) {
                  setFlopRemakeOldFaceUp(targetPlayer.faceUp);
                  // Switch to new cards at ~750ms (gradient is fully opaque from 500ms to 2000ms)
                  if (flopRemakeSwitchTimerRef.current) clearTimeout(flopRemakeSwitchTimerRef.current);
                  flopRemakeSwitchTimerRef.current = setTimeout(() => {
                    setFlopRemakeOldFaceUp(null);
                    flopRemakeSwitchTimerRef.current = null;
                  }, 750);
                }
              }
              setFlopRemakePlayerId(targetId);
              break;
            }
          }
        }

        // Shifumi loser overlay — triggered by server signal
        if (overlaySignal) {
          setShifumiLoserOverlay(overlaySignal);
        }

        gameStateRef.current = state;
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

    socket.on('game:playerDisconnected', ({ disconnectedPlayerIds: dcIds }: { disconnectedPlayerIds: string[] }) => {
      setDisconnectedPlayerIds(dcIds);
    });

    socket.on('game:playerReconnected', ({ disconnectedPlayerIds: dcIds }: { disconnectedPlayerIds: string[] }) => {
      setDisconnectedPlayerIds(dcIds);
    });

    // Lobby: creator left → room closed (handled at App level for stable lifecycle)
    socket.on('lobby:roomClosed', () => {
      if (currentScreenRef.current === 'waitingRoom') {
        setCurrentScreen('lobby');
        setCurrentRoomName(null);
        setCurrentRoomData(null);
        setLobbyNotification('Le créateur de la salle a quitté');
      }
    });

    // Lobby: kicked from room
    socket.on('lobby:kicked', () => {
      if (currentScreenRef.current === 'waitingRoom') {
        setCurrentScreen('lobby');
        setCurrentRoomName(null);
        setCurrentRoomData(null);
        setLobbyNotification('Vous avez été exclu de la salle');
      }
    });

    return () => {
      socket.off('game:state');
      socket.off('game:error');
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('game:playerDisconnected');
      socket.off('game:playerReconnected');
      socket.off('lobby:roomClosed');
      socket.off('lobby:kicked');
      if (powerTimerRef.current) clearTimeout(powerTimerRef.current);
      if (flopRemakeSwitchTimerRef.current) clearTimeout(flopRemakeSwitchTimerRef.current);
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

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCardClick = (card: CardType) => {
    if (!gameState) return;
    if (currentPower !== null) return; // Block selection during overlay animation
    if (flopRemakePlayerId !== null) return; // Block selection during flop remake animation
    if (isCardAnimating) return; // Block selection during card flight animations
    if (shifumiLoserOverlay !== null) return; // Block selection during shifumi loser overlay
    if (gameState.pendingActionDelayed) return; // Block selection during power overlay
    if (gameState.pendingCemeteryTransit) return; // Block selection during cemetery transit
    const human = gameState.players.find((p) => p.id === humanId);
    if (!human) return;

    const zone = getActiveZone(human);
    if (!zone || zone === 'faceDown') return; // faceDown handled separately

    const humanIdx = gameState.players.findIndex((p) => p.id === humanId);
    if (gameState.currentPlayerIndex !== humanIdx) return;

    // Determine which zone the clicked card belongs to
    const isInHand = human.hand.some((c) => c.id === card.id);
    const isInFaceUp = human.faceUp.some((c) => c.id === card.id);
    const isInFaceDown = human.faceDown.some((c) => c.id === card.id);

    setSelectedCards((prev) => {
      // ── Toggle deselection ──────────────────────────────────────────────
      if (prev.includes(card.id)) {
        const newSelection = prev.filter((id) => id !== card.id);
        // Cascade: deselecting a hand card → remove any faceUp combo cards
        if (isInHand && zone === 'hand') {
          const faceUpIds = new Set(human.faceUp.map((c) => c.id));
          return newSelection.filter((id) => !faceUpIds.has(id));
        }
        // Cascade: deselecting a faceUp card → remove any faceDown combo cards
        if (isInFaceUp && zone === 'faceUp') {
          const faceDownIds = new Set(human.faceDown.map((c) => c.id));
          return newSelection.filter((id) => !faceDownIds.has(id));
        }
        return newSelection;
      }

      // ── Adding a card ──────────────────────────────────────────────────

      // Combo flop+dark: card from faceDown while activeZone is 'faceUp'
      if (zone === 'faceUp' && isInFaceDown) {
        if (!human.faceUp.every((c) => prev.includes(c.id))) return prev;
        if (!human.hasSeenDarkFlop) return prev;
        // No rank validation — engine handles it (invalid combo = pickup)
        return [...prev, card.id];
      }

      // Combo hand+flop: card from faceUp while activeZone is 'hand'
      // Only allowed when deck is empty (last hand cards + flop same value)
      if (zone === 'hand' && isInFaceUp) {
        if (gameState.deck.length > 0) return prev;
        if (!human.hand.every((c) => prev.includes(c.id))) return prev;
        // Fall through to same-rank/mirror validation below
      }

      // Reject if card is not from active zone and not a valid combo
      if (zone === 'hand' && !isInHand && !isInFaceUp) return prev;
      if (zone === 'faceUp' && !isInFaceUp && !isInFaceDown) return prev;

      // ── Same-rank / mirror validation (active zone + combo hand+flop) ──
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
    emit('game:action', { type: 'play', cardIds: [card.id] });
  };

  const handlePlay = () => {
    if (selectedCards.length === 0 || !gameState) return;

    emit('game:action', { type: 'play', cardIds: selectedCards });
    setSelectedCards([]);
  };

  const handlePickUp = () => {
    emit('game:action', { type: 'pickUp' });
    setSelectedCards([]);
  };

  const handleFlopPickUpOnly = () => {
    emit('game:action', { type: 'pickUpWithFlop', flopCardIds: [] });
    setSelectedCards([]);
  };

  const handleFlopPickUpWithFlop = (flopCardIds: string[]) => {
    emit('game:action', { type: 'pickUpWithFlop', flopCardIds });
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

  const resetLocalState = () => {
    setSelectedCards([]);
    setError(null);
    setChatMessages([]);
    setChatUnread(0);
    setChatOpen(false);
    setActionLogOpen(false);
    setActionLogUnread(0);
    prevLogLengthRef.current = 0;
    setCurrentPower(null);
    prevPowerTypeRef.current = null;
    setFlopRemakePlayerId(null);
    setFlopRemakeOldFaceUp(null);
    prevLogLenForRemakeRef.current = 0;
    setShifumiLoserOverlay(null);
    setDisconnectedPlayerIds([]);
    setSoloDebugMode(false);
    gameStateRef.current = null;
    if (powerTimerRef.current) { clearTimeout(powerTimerRef.current); powerTimerRef.current = null; }
    if (flopRemakeSwitchTimerRef.current) { clearTimeout(flopRemakeSwitchTimerRef.current); flopRemakeSwitchTimerRef.current = null; }
  };

  const handleRestart = () => {
    socket.emit('lobby:leave');
    resetLocalState();
    setGameState(null);
    setCurrentScreen('lobby');
    setCurrentRoomName(null);
    setCurrentRoomData(null);
  };

  const handleStartSolo = (variant: GameVariant, _playerCount: number, debugMode: boolean) => {
    resetLocalState();
    setSoloDebugMode(debugMode);
    emit('solo:start', { variant });
  };

  // Lobby notification (toast)
  const [lobbyNotification, setLobbyNotification] = useState<string | null>(null);

  const handleBackToLobby = () => {
    socket.emit('lobby:leave');
    setCurrentScreen('lobby');
    setCurrentRoomName(null);
    setCurrentRoomData(null);
  };

  const handleFlopRemakeAnimComplete = () => {
    setFlopRemakePlayerId(null);
    setFlopRemakeOldFaceUp(null);
    if (flopRemakeSwitchTimerRef.current) { clearTimeout(flopRemakeSwitchTimerRef.current); flopRemakeSwitchTimerRef.current = null; }
  };

  const handleShifumiLoserOverlayComplete = () => {
    setShifumiLoserOverlay(null);
  };

  // ── Post-play pending action callbacks ─────────────────────────────────────

  /** Ace (Target): choose who plays next */
  const handleTargetChoice = (targetId: string) => {
    emit('game:action', { type: 'targetChoice', targetPlayerId: targetId });
  };

  /** J♠ Manouche/Super Manouche: choose target (multi-jack context, targetId missing) */
  const handleManoucheTarget = (targetId: string) => {
    emit('game:action', { type: 'manoucheTarget', targetPlayerId: targetId });
  };

  /** J♠ Manouche: take one card from target, give all same-rank from hand */
  const handleManouchePick = (takeCardId: string, giveCardIds: string[]) => {
    emit('game:action', { type: 'manouchePick', takeCardId, giveCardIds });
  };

  /** J♠ Manouche: skip the exchange (no cards traded) */
  const handleManoucheSkip = () => {
    emit('game:action', { type: 'manoucheSkip' });
  };

  /** Skip turn when blocked on empty pile (only mirrors/jacks in hand) */
  const handleSkipTurn = () => {
    emit('game:action', { type: 'skipTurn' });
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

  /** Multi-Jack: player submits chosen resolution order */
  const handleMultiJackOrder = (sequence: MultiJackSequenceEntry[]) => {
    emit('game:action', { type: 'multiJackOrder', sequence });
  };

  /** Revolution / Super Revolution: player confirms */
  const handleRevolutionConfirm = () => {
    emit('game:action', { type: 'revolutionConfirm' });
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-casino-room flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // ── Navigation handler for SiteHeader ──────────────────────────────────────
  const handleNavigate = (screen: 'lobby' | 'rules' | 'profile') => {
    setCurrentScreen(screen);
  };

  // ── Rules screen ──────────────────────────────────────────────────────────
  if (currentScreen === 'rules') {
    return (
      <RulesScreen onNavigate={handleNavigate} />
    );
  }

  // ── Profile screen (placeholder) ──────────────────────────────────────────
  if (currentScreen === 'profile') {
    return (
      <ProfileScreen onNavigate={handleNavigate} />
    );
  }

  // ── Lobby ───────────────────────────────────────────────────────────────────

  if (currentScreen === 'lobby') {
    return (
      <LobbyScreen
        socket={socket}
        onSoloStart={handleStartSolo}
        notification={lobbyNotification}
        onClearNotification={() => setLobbyNotification(null)}
        onNavigate={handleNavigate}
        onRoomCreated={(room) => {
          setCurrentRoomName(room.name);
          setCurrentRoomData(room as WaitingRoomData);
          setCurrentScreen('waitingRoom');
        }}
        onRoomJoined={(room) => {
          setCurrentRoomName(room.name);
          setCurrentRoomData(room as WaitingRoomData);
          setCurrentScreen('waitingRoom');
        }}
      />
    );
  }

  // ── Salle d'attente ─────────────────────────────────────────────────────────

  if (currentScreen === 'waitingRoom' && currentRoomData) {
    return (
      <WaitingRoomScreen
        socket={socket}
        initialRoom={currentRoomData}
        onBackToLobby={handleBackToLobby}
        onNavigate={handleNavigate}
      />
    );
  }

  // ── Jeu (game screen) ─────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="min-h-screen bg-casino-room flex items-center justify-center">
        <p className="text-gray-400">Chargement de la partie...</p>
      </div>
    );
  }

  // ── Phase de swap ────────────────────────────────────────────────────────────

  if (gameState.phase === 'swapping') {
    const swapIsDev = soloDebugMode;
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
              roomName={currentRoomName}
              onSwap={handleSwap}
              onReady={handleReady}
            />
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Plateau de jeu ───────────────────────────────────────────────────────────

  // Compute action bar state for BottomBar
  const humanIdx = gameState.players.findIndex((p) => p.id === humanId);
  const human = gameState.players[humanIdx];
  const isMyTurn = human ? gameState.currentPlayerIndex === humanIdx : false;
  const humanActiveZone = human ? getActiveZone(human) : null;
  const canPlay = isMyTurn && selectedCards.length > 0 && humanActiveZone !== 'faceDown';
  const hasLegalMove = !!(human && isMyTurn && gameState.pendingAction === null && canPlayerPlayAnything(gameState, humanIdx));
  const canPickUp = isMyTurn && gameState.pile.length > 0 && !hasLegalMove;

  // Check if current selection is a legal play
  const isSelectionLegal = (() => {
    if (!canPlay || !human) return false;
    const allCards = [...human.hand, ...human.faceUp, ...human.faceDown];
    const selected = selectedCards.map((id) => allCards.find((c) => c.id === id)).filter((c): c is CardType => c != null);
    if (selected.length === 0) return false;
    const isMirror = (c: CardType) => matchesPowerRank(c.rank, gameState.variant, 'mirror');
    const nonMirrors = selected.filter((c) => !isMirror(c));
    const mirrorCount = selected.length - nonMirrors.length;
    return canPlayCards(nonMirrors, gameState, nonMirrors.length + mirrorCount);
  })();

  // Flop pick-up: player is in flop phase and can't play anything
  const showFlopPickUp = !!(
    human && isMyTurn && humanActiveZone === 'faceUp' &&
    human.hand.length === 0 && gameState.deck.length === 0 &&
    human.faceUp.length > 0 &&
    !canPlayerPlayAnything(gameState, humanIdx) &&
    gameState.pendingAction === null
  );

  // No legal move detection: player has cards in hand but can't play anything
  const noLegalMove = !!(
    human && isMyTurn &&
    humanActiveZone === 'hand' &&
    !canPlayerPlayAnything(gameState, humanIdx) &&
    gameState.pendingAction === null &&
    gameState.pile.length > 0
  );

  // Empty pile blocked: player has only mirrors/jacks and pile is empty
  const emptyPileBlocked = !!(
    human && isMyTurn &&
    humanActiveZone === 'hand' &&
    !canPlayerPlayAnything(gameState, humanIdx) &&
    gameState.pendingAction === null &&
    gameState.pile.length === 0
  );

  // Combo flags: enable selecting cards from the next zone
  // Hand+flop combo only allowed when deck is empty (last hand cards + flop same value)
  const comboHandFlopEnabled = !!(human && isMyTurn && humanActiveZone === 'hand' &&
    human.hand.length > 0 && human.hand.every((c) => selectedCards.includes(c.id)) &&
    gameState.deck.length === 0);
  const comboFlopDarkEnabled = !!(human && isMyTurn && humanActiveZone === 'faceUp' &&
    human.faceUp.length > 0 && human.faceUp.every((c) => selectedCards.includes(c.id)) &&
    human.hasSeenDarkFlop === true);

  // Burn highlight: detect if current selection will trigger a burn
  const isBurnSelection = (() => {
    if (!gameState || selectedCards.length === 0 || !human) return false;
    if (gameState.phase === 'revolution' || gameState.phase === 'superRevolution') return false;

    const variant = gameState.variant;
    const allCards = [...human.hand, ...human.faceUp, ...human.faceDown];
    const cards = selectedCards
      .map((id) => allCards.find((c) => c.id === id))
      .filter((c): c is CardType => c !== undefined);
    if (cards.length === 0) return false;

    // Resolve mirrors
    const isMirror = (c: CardType) => matchesPowerRank(c.rank, variant, 'mirror');
    const nonMirrors = cards.filter((c) => !isMirror(c));
    if (nonMirrors.length === 0) return false;

    const effectiveRank = nonMirrors[0]!.rank;
    if (!nonMirrors.every((c) => c.rank === effectiveRank)) return false;

    // (a) Burn by rank assignment (e.g. 10)
    if (matchesPowerRank(effectiveRank, variant, 'burn')) return true;

    // (b) Quad burn: 4+ same-rank cards in one play
    if (cards.length >= 4) return true;

    // (c) Accumulation: pile top consecutive same rank + selection ≥ 4
    let pileTopCount = 0;
    for (let i = gameState.pile.length - 1; i >= 0; i--) {
      const entry = gameState.pile[i]!;
      const entryRank = entry.effectiveRank ?? entry.cards[0]!.rank;
      if (entryRank === effectiveRank) {
        pileTopCount += entry.cards.length;
      } else {
        break;
      }
    }
    if (pileTopCount + cards.length >= 4) return true;

    return false;
  })();

  return (
    <>
    <CardAnimationContext.Provider value={hiddenCardIds}>
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
          isDev={soloDebugMode}
          revealHands={soloDebugMode ? debugRevealHands : undefined}
          onToggleRevealHands={soloDebugMode ? () => setDebugRevealHands((v) => !v) : undefined}
          username={user.username}
          onLogout={logout}
          onLeaveGame={handleRestart}
        />
        <GameBoard
          state={gameState}
          humanId={humanId}
          selectedCards={selectedCards}
          onCardClick={handleCardClick}
          onFaceDownPlay={handleFaceDownPlay}
          onRestart={handleRestart}
          error={error}
          onTargetChoice={handleTargetChoice}
          onManoucheTarget={handleManoucheTarget}
          onManouchePick={handleManouchePick}
          onManoucheSkip={handleManoucheSkip}
          onSuperManouchePick={handleSuperManouchePick}
          onShifumiTarget={handleShifumiTarget}
          onShifumiChoice={handleShifumiChoice}
          onFlopReverseTarget={handleFlopReverseTarget}
          onFlopRemakeTarget={handleFlopRemakeTarget}
          onFlopRemake={handleFlopRemake}
          onMultiJackOrder={handleMultiJackOrder}
          onRevolutionConfirm={handleRevolutionConfirm}
          debugRevealHands={soloDebugMode ? debugRevealHands : undefined}
          onInspectZone={soloDebugMode ? setDebugInspectZone : undefined}
          currentPower={currentPower}
          comboHandFlopEnabled={comboHandFlopEnabled}
          comboFlopDarkEnabled={comboFlopDarkEnabled}
          isBurnSelection={isBurnSelection}
          showFlopPickUp={showFlopPickUp}
          onFlopPickUpOnly={handleFlopPickUpOnly}
          onFlopPickUpWithFlop={handleFlopPickUpWithFlop}
          noLegalMove={noLegalMove}
          emptyPileBlocked={emptyPileBlocked}
          onSkipTurn={handleSkipTurn}
          onPickUp={handlePickUp}
          flopRemakePlayerId={flopRemakePlayerId}
          flopRemakeOldFaceUp={flopRemakeOldFaceUp}
          onFlopRemakeAnimComplete={handleFlopRemakeAnimComplete}
          shifumiLoserOverlay={shifumiLoserOverlay}
          onShifumiLoserOverlayComplete={handleShifumiLoserOverlayComplete}
          disconnectedPlayerIds={disconnectedPlayerIds}
          onBackToLobby={handleRestart}
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
          onPlay={handlePlay}
          onPickUp={handlePickUp}
          onActionLogToggle={handleActionLogToggle}
          actionLogUnread={actionLogUnread}
          isSelectionLegal={isSelectionLegal}
          overlayActive={currentPower !== null || flopRemakePlayerId !== null || isCardAnimating || shifumiLoserOverlay !== null || !!gameState.pendingActionDelayed || !!gameState.pendingCemeteryTransit}
          emptyPileBlocked={emptyPileBlocked}
          onSkipTurn={handleSkipTurn}
        />
        {soloDebugMode && debugInspectZone && (
          <ZoneInspectorModal
            zone={debugInspectZone}
            state={gameState}
            onClose={() => setDebugInspectZone(null)}
          />
        )}
      </motion.div>
    </AnimatePresence>
    <CardAnimationLayer animations={cardAnimations} onComplete={onCardAnimComplete} />
    </CardAnimationContext.Provider>
    </>
  );
}

export default App;
