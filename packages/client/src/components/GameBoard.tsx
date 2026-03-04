import React from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import type { Card as CardType, GameState, Player, ShifumiChoice, PendingShifumi, PendingShifumiResult, PendingFirstPlayerShifumi, PendingAllBlockedShifumi, PendingMultiJackOrder, PendingRevolutionConfirm, MultiJackSequenceEntry, LogEntry, LastPowerTriggered } from '@shit-head-palace/engine';
import { getActiveZone } from '@shit-head-palace/engine';
import { getIllegalPlayReason } from '../utils/illegalPlayReason';
import type { InspectZone } from './DebugPanel';
import { Card } from './Card';
import { PlayerAvatar } from './PlayerAvatar';
import { RevolutionBanner } from './RevolutionBanner';
import { PowerOverlay } from './PowerOverlay';
import { LastPlayDisplay } from './LastPlayDisplay';
import { PowerSummary } from './PowerSummary';
import { FlopPickUpModal } from './FlopPickUpModal';
import { MultiJackOrderModal } from './MultiJackOrderModal';
import { ModalWrapper } from './ModalWrapper';
import { ModalButton } from './ModalButton';
import { ShifumiResultModal } from './ShifumiResultModal';

// ─── Zone de joueur (bot ou humain) ───────────────────────────────────────────

interface PlayerZoneProps {
  player: Player;
  isBot: boolean;
  isActive: boolean;
  activeZone: ReturnType<typeof getActiveZone>;
  selectedCards: string[];
  playerIndex: number;
  onCardClick?: (card: CardType) => void;
  onFaceDownClick?: (card: CardType) => void;
  debugRevealHands?: boolean;
  /** Mobile compact mode: smaller cards, reduced fan */
  compact?: boolean;
  /** All hand cards selected — faceUp cards become selectable for combo */
  comboHandFlopEnabled?: boolean;
  /** All faceUp cards selected + hasSeenDarkFlop — faceDown cards become selectable */
  comboFlopDarkEnabled?: boolean;
  /** When true, selected cards will trigger a burn — show red highlight */
  isBurnSelection?: boolean;
}

function PlayerZone({
  player,
  isBot,
  isActive,
  activeZone,
  selectedCards,
  playerIndex,
  onCardClick,
  onFaceDownClick,
  debugRevealHands,
  compact,
  comboHandFlopEnabled,
  comboFlopDarkEnabled,
  isBurnSelection,
}: PlayerZoneProps) {
  const canClickHand = isActive && activeZone === 'hand' && !isBot;
  const canClickFaceUp = isActive && activeZone === 'faceUp' && !isBot;
  const canClickFaceDown = isActive && activeZone === 'faceDown' && !isBot;
  // Combo flags: allow clicking next zone when all current zone cards are selected
  const canClickFlopCombo = !isBot && !!comboHandFlopEnabled;
  const canClickDarkCombo = !isBot && !!comboFlopDarkEnabled;

  // ── Chevauchement pour les cartes adversaires ──
  const botCardSize: 'xs' | 'sm' = 'xs';
  const botCardW = 40; // w-9 (36px) + border-2 transparent (4px)
  const botCardH = 56; // h-[52px] + border-2 transparent (4px)

  /** Compute the overlap margin (px) for a row of `count` bot cards. */
  const botOverlap = (count: number) => (count > 3 ? Math.min((count - 3) * 12, 24) : 0);

  // ── Éventail (paramétrable) ──
  const fanStyle = (index: number, total: number, maxAngle: number, arcY: number): { rotate: number; y: number } => {
    if (total <= 1) return { rotate: 0, y: 0 };
    const mid = (total - 1) / 2;
    const t = (index - mid) / mid; // -1 à 1
    return { rotate: t * maxAngle, y: Math.abs(t) * arcY };
  };

  const humanFanAngle = compact ? 6 : 12;
  const humanFanArc = compact ? 4 : 8;
  const humanCardSize: 'xs' | 'sm' | 'md' = compact ? 'sm' : 'md';
  const botFanAngle = 8;
  const botFanArc = 5;

  // ── Drag and drop pour réorganiser la main ──
  const [handOrder, setHandOrder] = React.useState<string[]>(() =>
    player.hand.map((c) => c.id),
  );
  const [draggingCardId, setDraggingCardId] = React.useState<string | null>(null);
  const didDragRef = React.useRef(false);
  const dragTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isBot) return;
    const currentIds = new Set(player.hand.map((c) => c.id));
    setHandOrder((prev) => {
      const kept = prev.filter((id) => currentIds.has(id));
      const keptSet = new Set(kept);
      const added = player.hand.filter((c) => !keptSet.has(c.id)).map((c) => c.id);
      return [...kept, ...added];
    });
  }, [isBot, player.hand]);

  const orderedHand = isBot
    ? player.hand
    : handOrder
        .map((id) => player.hand.find((c) => c.id === id))
        .filter((c): c is CardType => c !== undefined);

  const handleCardClickNoDrag = React.useCallback(
    (card: CardType) => {
      if (didDragRef.current) return;
      onCardClick?.(card);
    },
    [onCardClick],
  );

  // ── Flop section ──
  const flopSection = (
    <div className="flex" style={{ gap: isBot ? 4 : (compact ? 4 : 8) }}>
      {(player.faceDown.length > 0 || player.faceUp.length > 0) ? (
        Array.from({ length: Math.max(player.faceDown.length, player.faceUp.length) }).map(
          (_, i) => {
            const fdCard = player.faceDown[i];
            const fuCard = player.faceUp[i];
            const cardSize = isBot ? botCardSize : 'sm';
            const w = isBot ? botCardW : 44;
            const showDarkInStack = !!fdCard && !(!isBot && comboFlopDarkEnabled);
            const h = isBot ? botCardH + 12 : (showDarkInStack ? 76 : 64);
            return (
              <div key={i} className="relative" style={{ width: w, height: h }}>
                {showDarkInStack && (
                  <div className="absolute top-0 z-0">
                    <Card
                      card={fdCard!}
                      faceDown={isBot ? !debugRevealHands : true}
                      size={cardSize}
                      onClick={
                        canClickFaceDown ? () => onFaceDownClick?.(fdCard!) :
                        undefined
                      }
                      noLayout
                    />
                  </div>
                )}
                {fuCard && (
                  <div className={`absolute z-10 ${showDarkInStack ? 'top-3' : 'top-0'}`}>
                    <Card
                      card={fuCard}
                      size={cardSize}
                      selected={!isBot && selectedCards.includes(fuCard.id)}
                      burnHighlight={isBurnSelection}
                      onClick={(canClickFaceUp || canClickFlopCombo) ? () => onCardClick?.(fuCard) : undefined}
                      noLayout
                    />
                  </div>
                )}
              </div>
            );
          },
        )
      ) : (
        <div style={{ width: isBot ? botCardW : 44, height: isBot ? botCardH + 12 : 76 }} className="opacity-0" />
      )}
    </div>
  );

  return (
    <div className="grid items-center gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns: 'auto 1fr' }}>
      {/* Bot hand — column 2 only, aligned with flop */}
      {isBot && (
        <>
          <div />
          <div className="flex items-end justify-center mb-1" style={{ paddingBottom: botFanArc }}>
            {player.hand.map((card, i) => {
              const { rotate, y } = fanStyle(i, player.hand.length, botFanAngle, botFanArc);
              return (
                <div
                  key={card.id}
                  style={{
                    marginLeft: i === 0 ? 0 : -botOverlap(player.hand.length),
                    zIndex: i,
                    transform: `rotate(${rotate}deg) translateY(${y}px)`,
                  }}
                >
                  <Card card={card} faceDown={!debugRevealHands} size={botCardSize} />
                </div>
              );
            })}
            {player.hand.length === 0 && (
              <span className="text-gray-500 text-xs italic">main vide</span>
            )}
          </div>
        </>
      )}

      {/* Avatar + Name — column 1 */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <PlayerAvatar name={player.name} playerIndex={playerIndex} isActive={isActive} size={isBot ? 'bot' : 'human'} />
        <span className={`${isBot ? 'text-[10px] max-w-[48px]' : 'text-sm max-w-[64px]'} font-semibold truncate text-center ${isActive ? 'text-gold' : 'text-gray-400'}`}>
          {player.name}
        </span>
      </div>

      {/* Flop — column 2 */}
      <div className="flex flex-col items-center gap-1">
        {flopSection}
        {/* Dark flop — separate row when combo flop+dark enabled */}
        {!isBot && comboFlopDarkEnabled && player.faceDown.length > 0 && (
          <div className="flex justify-center" style={{ gap: compact ? 4 : 8 }}>
            {player.faceDown.map((fdCard) => (
              <Card
                key={fdCard.id}
                card={fdCard}
                faceDown={true}
                size="sm"
                selected={selectedCards.includes(fdCard.id)}
                burnHighlight={isBurnSelection}
                onClick={() => onCardClick?.(fdCard)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Human hand — column 2 only, aligned with flop */}
      {!isBot && (
        <>
          <div />
          <Reorder.Group
            as="div"
            axis="x"
            values={handOrder}
            onReorder={setHandOrder}
            className="flex justify-center mt-4"
            style={{ paddingBottom: humanFanArc }}
          >
            {orderedHand.map((card, i) => {
              const { rotate, y } = fanStyle(i, orderedHand.length, humanFanAngle, humanFanArc);
              const isSelected = selectedCards.includes(card.id);
              const isDragging = draggingCardId === card.id;
              return (
                <Reorder.Item
                  as="div"
                  key={card.id}
                  value={card.id}
                  className="relative"
                  style={{
                    marginLeft: i === 0 ? 0 : -4,
                    zIndex: isDragging ? 50 : isSelected ? 20 : i,
                    opacity: 1,
                  }}
                  initial={false}
                  animate={{
                    rotate: isSelected ? 0 : rotate,
                    y: isSelected ? -18 : y,
                  }}
                  whileHover={canClickHand && !isSelected && !isDragging ? { y: y - 10, rotate: 0, scale: 1.06 } : {}}
                  whileDrag={{ scale: 1.08, rotate: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  transition={{ layout: { duration: 0.15 }, opacity: { duration: 0 } }}
                  onDragStart={() => {
                    setDraggingCardId(card.id);
                    didDragRef.current = true;
                    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
                  }}
                  onDragEnd={() => {
                    setDraggingCardId(null);
                    dragTimerRef.current = setTimeout(() => { didDragRef.current = false; }, 300);
                  }}
                >
                  <Card
                    card={card}
                    size={humanCardSize}
                    selected={isSelected}
                    burnHighlight={isBurnSelection}
                    onClick={canClickHand ? () => handleCardClickNoDrag(card) : undefined}
                    disabled={false}
                    noMotion
                    noLayout
                  />
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </>
      )}

      {/* Combo hint text — column 2 only */}
      {!isBot && comboHandFlopEnabled && (
        <>
          <div />
          <p className="text-[10px] text-gold/70 text-center mt-1 leading-tight">
            Vous pouvez aussi sélectionner des cartes du flop de même valeur
          </p>
        </>
      )}
      {!isBot && comboFlopDarkEnabled && (
        <>
          <div />
          <p className="text-[10px] text-gold/70 text-center mt-1 leading-tight">
            Vous pouvez aussi sélectionner des cartes du dark flop (attention : combo invalide = ramasser)
          </p>
        </>
      )}
    </div>
  );
}

// ─── Pile stack (last 5 entries with depth) ─────────────────────────────────

// ─── Horizontal pile display ────────────────────────────────────────────────

/** Card overlap within a single move group (px) */
const CARD_OVERLAP = 18;

/** Opacity values for the last N moves (index 0 = oldest visible). */
const MOVE_OPACITY = [0.2, 0.4, 0.6, 0.8, 1.0];

interface PileHorizontalProps {
  pile: GameState['pile'];
}

/**
 * Renders the pile as a horizontal band of the last 5 moves, left (old, faded)
 * to right (recent, full opacity). Cards within the same move overlap with a
 * horizontal offset so every rank+suit stays visible.
 */
function PileHorizontal({ pile }: PileHorizontalProps) {
  if (pile.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-600 px-4">
        <span className="text-gray-600 text-[10px] sm:text-xs">pile vide</span>
      </div>
    );
  }

  // md card dimensions: 56px wide, 80px tall
  const MD_WIDTH = 56;
  const MD_HEIGHT = 80;

  const visibleMoves = pile.slice(-5);
  const moveCount = visibleMoves.length;

  return (
    <div className="flex items-center justify-center gap-2">
      {visibleMoves.map((entry, moveIdx) => {
        const opacityIdx = moveCount <= 5 ? moveIdx + (5 - moveCount) : moveIdx;
        const opacity = MOVE_OPACITY[opacityIdx] ?? 0.2;
        const isLatest = moveIdx === moveCount - 1;
        const cards = entry.cards;

        const groupWidth = cards.length > 1
          ? MD_WIDTH + (cards.length - 1) * CARD_OVERLAP
          : undefined;

        return (
          <div
            key={`${entry.timestamp}-${moveIdx}`}
            className={`relative flex-shrink-0 rounded-lg ${isLatest ? 'border-2 border-green-400' : ''}`}
            style={{ opacity }}
          >
            {isLatest ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={cards.map((c) => c.id).join(',')}
                  initial={{ scale: 0.7, y: -16, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  className="relative flex-shrink-0"
                  style={{
                    width: groupWidth,
                    height: cards.length > 1 ? MD_HEIGHT : undefined,
                  }}
                >
                  {cards.map((card, cardIdx) => (
                    <div
                      key={card.id}
                      className={cards.length > 1 ? 'absolute top-0' : undefined}
                      style={cards.length > 1 ? { left: cardIdx * CARD_OVERLAP, zIndex: cardIdx } : undefined}
                    >
                      <Card card={card} size="md" noLayout />
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div
                className="relative flex-shrink-0"
                style={{
                  width: groupWidth,
                  height: cards.length > 1 ? MD_HEIGHT : undefined,
                }}
              >
                {cards.map((card, cardIdx) => (
                  <div
                    key={card.id}
                    className={cards.length > 1 ? 'absolute top-0' : undefined}
                    style={cards.length > 1 ? { left: cardIdx * CARD_OVERLAP, zIndex: cardIdx } : undefined}
                  >
                    <Card card={card} size="md" noLayout />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Graveyard horizontal display ───────────────────────────────────────────

/** Card overlap within the graveyard display (px) */
const GRAVEYARD_OVERLAP = 14;

/** Max number of burned cards to show */
const GRAVEYARD_MAX = 10;

interface GraveyardDisplayProps {
  graveyard: CardType[];
}

/**
 * Renders the graveyard as a right-anchored horizontal band of the last 10
 * burned cards, with overlapping and fading opacity. The newest card is always
 * at the right edge; older cards extend to the left.
 */
function GraveyardDisplay({ graveyard }: GraveyardDisplayProps) {
  const visible = graveyard.slice(-GRAVEYARD_MAX);
  const count = visible.length;

  // Fixed container width: always sized for max capacity to avoid layout shift
  const cardWidth = 36;
  const maxWidth = cardWidth + (GRAVEYARD_MAX - 1) * GRAVEYARD_OVERLAP;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div
        className="relative flex-shrink-0"
        style={{ width: maxWidth, height: 52 }}
      >
        {visible.map((card, idx) => {
          // Opacity: oldest (idx=0) gets lowest, newest (idx=count-1) gets 1.0
          const opacity = count === 1 ? 1 : 0.1 + (0.9 * idx) / (count - 1);

          return (
            <div
              key={card.id}
              className="absolute top-0"
              style={{
                right: (count - 1 - idx) * GRAVEYARD_OVERLAP,
                zIndex: idx,
                opacity,
              }}
            >
              <Card card={card} size="xs" variant="burned" noMotion noLayout />
            </div>
          );
        })}
      </div>
      <span className="text-[8px] text-red-400/60">
        {graveyard.length > 0 ? `${graveyard.length} brûlées` : '\u00A0'}
      </span>
    </div>
  );
}

// ─── MiniLog (last 8 actions/powers/effects) ──────────────────────────────

const LOG_SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

const LOG_SUIT_COLOR: Record<string, string> = {
  hearts: 'text-red-400', diamonds: 'text-red-400',
  clubs: 'text-white', spades: 'text-white',
};

const POWER_LABELS: Record<string, string> = {
  burn: 'Burn !',
  reset: 'Reset !',
  skip: 'Skip !',
  under: 'Under !',
  target: 'Target !',
  mirror: 'Mirror !',
  revolution: 'Révolution !',
  superRevolution: 'Super Révolution !',
  manouche: 'Manouche !',
  superManouche: 'Super Manouche !',
  flopReverse: 'Flop Reverse !',
  flopRemake: 'Flop Remake !',
  shifumi: 'Shifumi !',
  superShifumi: 'Super Shifumi !',
};

function getMiniLogColor(entry: LogEntry): string {
  if (entry.entryType === 'power') return 'text-amber-400';
  if (entry.entryType === 'effect') return 'text-emerald-400';
  return 'text-gray-200';
}

interface MiniLogProps {
  log: LogEntry[];
  visible?: boolean;
  maxEntries?: number;
}

/** Compact log showing the last N game actions/powers/effects with fading opacity. */
function MiniLog({ log, visible = true, maxEntries = 8 }: MiniLogProps) {
  const relevantEntries = log.filter(
    (e) =>
      e.type === 'play' || e.type === 'darkPlay' || e.type === 'darkPlayFail' || e.type === 'pickUp'
      || e.entryType === 'power' || e.entryType === 'effect',
  );
  const lastN = relevantEntries.slice(-maxEntries);
  const display = [...lastN].reverse();
  // Generate fading opacities dynamically based on entry count
  const opacities = display.map((_, i) => {
    const t = i / Math.max(display.length - 1, 1);
    return 1 - t * 0.85; // from 1.0 down to ~0.15
  });

  if (display.length === 0 || !visible) {
    return (
      <div className="w-full h-full rounded-lg bg-black/30 p-1.5">
        <span className="text-[10px] text-gray-500 italic">Aucune action</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg bg-black/40 backdrop-blur-sm p-1.5 overflow-hidden">
      {display.map((entry, idx) => {
        const opacity = opacities[idx] ?? 0.2;
        const name = entry.playerName ?? '?';
        const color = getMiniLogColor(entry);

        // Power entries: show power label only (no player name)
        if (entry.entryType === 'power') {
          const label = POWER_LABELS[entry.type] ?? entry.type;
          return (
            <div key={entry.id} className={`text-[10px] leading-snug ${color} truncate font-semibold`} style={{ opacity }}>
              {label}
            </div>
          );
        }

        // Effect entries: show pre-formatted message
        if (entry.entryType === 'effect') {
          const message = (entry.data.message as string) ?? entry.type;
          return (
            <div key={entry.id} className={`text-[10px] leading-snug ${color} truncate`} style={{ opacity }}>
              {message}
            </div>
          );
        }

        // Action entries: existing display logic
        if (entry.type === 'play' || entry.type === 'darkPlay') {
          const ranks = (entry.data.ranks as string[] | undefined) ?? [];
          const suits = (entry.data.suits as string[] | undefined) ?? [];
          return (
            <div key={entry.id} className="text-[10px] leading-snug text-gray-200 truncate" style={{ opacity }}>
              <span className="font-semibold">{name}</span>{' '}joue{' '}
              {ranks.map((rank, ri) => {
                const suit = suits[ri] ?? '';
                const symbol = LOG_SUIT_SYMBOL[suit] ?? '';
                const suitColor = LOG_SUIT_COLOR[suit] ?? 'text-white';
                return (
                  <span key={ri}>
                    {ri > 0 && ' '}
                    <span className={`font-bold ${suitColor}`}>{rank}{symbol}</span>
                  </span>
                );
              })}
            </div>
          );
        }

        if (entry.type === 'darkPlayFail') {
          return (
            <div key={entry.id} className="text-[10px] leading-snug text-gray-200 truncate" style={{ opacity }}>
              <span className="font-semibold">{name}</span> échoue (dark)
            </div>
          );
        }

        if (entry.type === 'pickUp') {
          const count = entry.data.cardCount as number | undefined;
          return (
            <div key={entry.id} className="text-[10px] leading-snug text-gray-200 truncate" style={{ opacity }}>
              <span className="font-semibold">{name}</span> ramasse{count ? ` (${count})` : ''}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

// ─── Zone centrale ─────────────────────────────────────────────────────────────

interface CardsColumnProps {
  state: GameState;
  humanId: string;
}

/** Maps card rank codes to readable French labels. */
function rankLabel(rank: string): string {
  switch (rank) {
    case 'J': return 'Valet';
    case 'Q': return 'Dame';
    case 'K': return 'Roi';
    case 'A': return 'As';
    default: return rank;
  }
}

/** Pending action types that require hiding the last pile entry (card shown after choice). */
const POPUP_PENDING_TYPES = new Set([
  'target',
  'PendingMultiJackOrder',
]);

/** Center column: Pile centred vertically. Overlay space handled externally. */
function CardsColumn({ state, humanId }: CardsColumnProps) {
  // Hide last pile entry during popup pending actions (card appears after choice)
  const hasPendingPopup = !!(state.pendingAction && POPUP_PENDING_TYPES.has(state.pendingAction.type));
  const displayPile = hasPendingPopup && state.pile.length > 0
    ? state.pile.slice(0, -1)
    : state.pile;
  const totalPileCards = displayPile.reduce((sum, entry) => sum + entry.cards.length, 0);

  // Build the dynamic turn message (hidden during pending popup actions)
  let turnMessage: string | null = null;
  const phase = state.phase;
  if ((phase === 'playing' || phase === 'revolution' || phase === 'superRevolution') && !state.pendingAction) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer) {
      const name = currentPlayer.id === humanId ? 'vous' : currentPlayer.name;
      const isRevolution = phase === 'revolution' || phase === 'superRevolution';
      const isUnder = typeof state.activeUnder === 'number';

      if (displayPile.length === 0 || state.pileResetActive) {
        turnMessage = `À ${name} de jouer (pile vide)`;
      } else {
        const lastEntry = displayPile[displayPile.length - 1]!;
        const topRank = lastEntry.effectiveRank ?? lastEntry.cards[0]!.rank;
        const label = rankLabel(topRank);
        if (isRevolution || isUnder) {
          turnMessage = `À ${name} de jouer sous un ${label}`;
        } else {
          turnMessage = `À ${name} de jouer sur un ${label}`;
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full items-center justify-center">
      <p className={`text-[10px] sm:text-xs leading-tight mb-1 truncate max-w-full px-2 ${turnMessage ? 'text-gray-300/70' : 'invisible'}`}>
        {turnMessage || '\u00A0'}
      </p>
      <PileHorizontal pile={displayPile} />
      <span className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
        Pile : {totalPileCards} cartes
      </span>
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
    <ModalWrapper title={title} subtitle={description} onClose={onCancel}>
      <div className="flex flex-col gap-2">
        {opponents.map((p) => (
          <ModalButton key={p.id} variant="player" onClick={() => onSelect(p.id)}>
            {p.name}
          </ModalButton>
        ))}
      </div>
    </ModalWrapper>
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
    <ModalWrapper title="Manouche ♠">
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
        <div className="w-full mt-4">
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

      <div className="mt-4">
        <ModalButton variant="confirm" disabled={!canConfirm} onClick={handleConfirm}>
          Confirmer l&apos;échange
        </ModalButton>
      </div>
    </ModalWrapper>
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
    <ModalWrapper
      title="Super Manouche ♠"
      subtitle={`Cliquez sur une carte puis sur une autre pour les échanger avec ${target.name}.`}
    >
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

      <div className="w-full mt-4">
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
      <p className={`text-xs min-h-[1.25rem] mt-2 ${selectedId ? 'text-amber-400' : 'text-transparent'}`}>
        Cliquez sur une autre carte pour échanger leurs places
      </p>

      <div className="mt-4">
        <ModalButton variant="confirm" disabled={!isValid} onClick={handleConfirm}>
          Confirmer l&apos;échange
        </ModalButton>
      </div>
    </ModalWrapper>
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
    <ModalWrapper title={title} subtitle={description}>
      <div className="flex flex-col gap-2">
        {active.map((p) => (
          <ModalButton
            key={p.id}
            variant="player"
            selected={selected.includes(p.id)}
            onClick={() => handleClick(p.id)}
          >
            {p.name}
          </ModalButton>
        ))}
      </div>
      <div className="mt-4">
        <ModalButton
          variant="confirm"
          disabled={!canConfirm}
          onClick={() => canConfirm && onSelect(selected[0]!, selected[1]!)}
        >
          Confirmer
        </ModalButton>
      </div>
    </ModalWrapper>
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
    <ModalWrapper
      title={isSuper ? 'Super Shifumi ♣' : 'Shifumi ♣'}
      subtitle="Pierre-papier-ciseaux !"
    >
      <div className="flex gap-3 justify-center">
        {choices.map((c) => (
          <button
            key={c.value}
            onClick={() => onChoice(c.value)}
            className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-gray-700 text-white hover:bg-gray-600 font-semibold text-sm transition-colors"
          >
            <span className="text-2xl">{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </ModalWrapper>
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
    <ModalWrapper
      title="Flop Remake ♥"
      subtitle="Cliquez sur une carte, puis sur une autre pour les échanger."
    >
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

      <div className="w-full mt-4">
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
      <p className={`text-xs min-h-[1.25rem] mt-2 ${selectedId ? 'text-amber-400' : 'text-transparent'}`}>
        Cliquez sur une autre carte pour échanger leurs places
      </p>

      <div className="mt-4">
        <ModalButton variant="confirm" disabled={!isValid} onClick={() => isValid && onSubmit(faceUpIds, faceDownIds)}>
          Confirmer
        </ModalButton>
      </div>
    </ModalWrapper>
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
  onRestart: () => void;
  error: string | null;
  // Target choice (post-play As : choisir qui joue ensuite)
  onTargetChoice?: (targetId: string) => void;
  // Manouche / Super Manouche pick
  onManoucheTarget?: (targetId: string) => void;
  onManouchePick?: (takeCardId: string, giveCardIds: string[]) => void;
  onSuperManouchePick?: (giveCardIds: string[], takeCardIds: string[]) => void;
  // Shifumi (J♣)
  onShifumiTarget?: (player1Id: string, player2Id: string) => void;
  onShifumiChoice?: (choice: ShifumiChoice) => void;
  // Flop Reverse / Flop Remake (J♥)
  onFlopReverseTarget?: (targetId: string) => void;
  onFlopRemakeTarget?: (targetId: string) => void;
  onFlopRemake?: (faceUp: string[], faceDown: string[]) => void;
  // Multi-Jack Order
  onMultiJackOrder?: (sequence: MultiJackSequenceEntry[]) => void;
  // Revolution confirmation
  onRevolutionConfirm?: () => void;
  // Debug (dev mode only)
  debugRevealHands?: boolean;
  onInspectZone?: (zone: InspectZone) => void;
  /** Current power being displayed (inline in right column). */
  currentPower?: LastPowerTriggered | null;
  /** All hand cards selected — faceUp cards become selectable for combo */
  comboHandFlopEnabled?: boolean;
  /** All faceUp cards selected + hasSeenDarkFlop — faceDown cards become selectable */
  comboFlopDarkEnabled?: boolean;
  /** When true, selected cards will trigger a burn — show red highlight */
  isBurnSelection?: boolean;
  /** When true, show FlopPickUpModal instead of normal pick-up button */
  showFlopPickUp?: boolean;
  onFlopPickUpOnly?: () => void;
  onFlopPickUpWithFlop?: (flopCardIds: string[]) => void;
  /** When true, player has no legal move available — show pickup prompt */
  noLegalMove?: boolean;
  /** Pick up the pile (used by no-legal-move banner) */
  onPickUp?: () => void;
}

export function GameBoard({
  state,
  humanId,
  selectedCards,
  onCardClick,
  onFaceDownPlay,
  onRestart,
  error,
  onTargetChoice,
  onManoucheTarget,
  onManouchePick,
  onSuperManouchePick,
  onShifumiTarget,
  onShifumiChoice,
  onFlopReverseTarget,
  onFlopRemakeTarget,
  onFlopRemake,
  onMultiJackOrder,
  onRevolutionConfirm,
  debugRevealHands,
  onInspectZone,
  currentPower,
  comboHandFlopEnabled,
  comboFlopDarkEnabled,
  isBurnSelection,
  showFlopPickUp,
  onFlopPickUpOnly,
  onFlopPickUpWithFlop,
  noLegalMove,
  onPickUp,
}: GameBoardProps) {
  const [gameOverDismissed, setGameOverDismissed] = React.useState(false);

  // Mobile/landscape detection for compact rendering
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [isLandscape, setIsLandscape] = React.useState(typeof window !== 'undefined' ? window.innerHeight < 500 : false);
  React.useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsLandscape(window.innerHeight < 500);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      <div className="min-h-screen bg-casino-room flex items-center justify-center">
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
  const pendingManoucheTargetForHuman =
    pending?.type === 'manouche' && pending.launcherId === humanId && !pending.targetId;
  const pendingManoucheForHuman =
    pending?.type === 'manouche' && pending.launcherId === humanId && !!pending.targetId;
  const pendingSuperManoucheTargetForHuman =
    pending?.type === 'superManouche' && pending.launcherId === humanId && !pending.targetId;
  const pendingSuperManoucheForHuman =
    pending?.type === 'superManouche' && pending.launcherId === humanId && !!pending.targetId;

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

  // FirstPlayerShifumi / AllBlockedShifumi: human needs to choose rock/paper/scissors
  const firstPlayerShifumiPending =
    pending?.type === 'firstPlayerShifumi'
      ? (pending as PendingFirstPlayerShifumi)
      : null;
  const allBlockedShifumiPending =
    pending?.type === 'allBlockedShifumi'
      ? (pending as PendingAllBlockedShifumi)
      : null;
  const pendingGenericShifumiForHuman =
    (firstPlayerShifumiPending !== null &&
      firstPlayerShifumiPending.playerIds.includes(humanId) &&
      !firstPlayerShifumiPending.choices[humanId]) ||
    (allBlockedShifumiPending !== null &&
      allBlockedShifumiPending.playerIds.includes(humanId) &&
      !allBlockedShifumiPending.choices[humanId]);

  // ShifumiResult: visible to ALL players (public popup)
  const pendingShifumiResult =
    pending?.type === 'shifumiResult'
      ? (pending as PendingShifumiResult)
      : null;

  // Flop Reverse: human is launcher and needs to pick target
  const pendingFlopReverseForHuman =
    pending?.type === 'flopReverse' && pending.launcherId === humanId;

  // Flop Remake: human is launcher and needs to pick target (step 1)
  const pendingFlopRemakeTargetForHuman =
    pending?.type === 'flopRemake' && pending.launcherId === humanId && !pending.targetId;

  // Flop Remake: human is target and needs to redistribute (step 2)
  const pendingFlopRemakeForHuman =
    pending?.type === 'flopRemake' && pending.targetId === humanId;

  const pendingMultiJackForHuman =
    pending?.type === 'PendingMultiJackOrder' && pending.playerId === humanId;

  const pendingRevolutionConfirmForHuman =
    pending?.type === 'PendingRevolutionConfirm' && pending.playerId === humanId;
  const pendingRevolutionConfirm =
    pending?.type === 'PendingRevolutionConfirm'
      ? (pending as PendingRevolutionConfirm)
      : null;

  // Message de statut
  let status = '';
  let statusIsIllegal = false;
  if (state.phase === 'finished') {
    status = 'Partie terminée';
  } else if (pendingTargetForHuman) {
    status = 'Choisissez qui jouera après vous.';
  } else if (pendingManoucheTargetForHuman || pendingSuperManoucheTargetForHuman) {
    status = 'Choisissez la cible de la Manouche.';
  } else if (pendingManoucheForHuman || pendingSuperManoucheForHuman) {
    status = 'Résolvez l\'échange Manouche.';
  } else if (pendingShifumiTargetForHuman) {
    status = 'Choisissez 2 joueurs pour le Shifumi.';
  } else if (pendingShifumiChoiceForHuman) {
    status = 'Pierre-papier-ciseaux !';
  } else if (pendingShifumiResult) {
    status = 'Résultat du shifumi…';
  } else if (pendingShifumiWaiting) {
    status = 'En attente du choix de l\'adversaire…';
  } else if (pendingGenericShifumiForHuman) {
    status = 'Pierre-papier-ciseaux !';
  } else if (pendingFlopReverseForHuman) {
    status = 'Choisissez la cible du Flop Reverse.';
  } else if (pendingFlopRemakeTargetForHuman) {
    status = 'Choisissez la cible du Flop Remake.';
  } else if (pendingFlopRemakeForHuman) {
    status = 'Redistribuez vos cartes (flop + dark flop).';
  } else if (pendingMultiJackForHuman) {
    status = 'Choisissez l\'ordre de résolution des valets.';
  } else if (pendingRevolutionConfirmForHuman) {
    status = pendingRevolutionConfirm?.isSuper
      ? 'Confirmez la Super Révolution !'
      : 'Confirmez la Révolution !';
  } else if (pending) {
    // Any other pending action where a bot needs to act
    status = 'En attente…';
  } else if (isBotTurn) {
    const activeBot = bots.find(
      (b) => state.players.findIndex((p) => p.id === b.id) === state.currentPlayerIndex,
    );
    status = `${activeBot?.name ?? 'Le bot'} réfléchit…`;
  } else if (noLegalMove) {
    status = 'Pas de coup légal — ramassez la pile.';
  } else if (isMyTurn) {
    if (humanActiveZone === 'faceDown') {
      status = 'Cliquez une carte à l\'aveugle pour jouer.';
    } else if (selectedCards.length > 0) {
      // Resolve selected card IDs to Card objects for illegal play detection
      const allPlayerCards = [...human.hand, ...human.faceUp, ...human.faceDown];
      const selectedCardObjects = selectedCards
        .map((id) => allPlayerCards.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      const illegalReason = getIllegalPlayReason(selectedCardObjects, state, humanId);
      if (illegalReason) {
        status = illegalReason;
        statusIsIllegal = true;
      } else {
        status = `${selectedCards.length} carte(s) sélectionnée(s) — Jouez ou ajoutez la même valeur.`;
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden select-none z-[1]
      rounded-xl sm:rounded-[2rem] md:rounded-[2.5rem]
      mx-1 my-1 sm:mx-2 sm:my-1.5 md:mx-3 md:my-2
      border-4 sm:border-[5px] md:border-[6px] border-casino-wood
      shadow-[inset_0_0_40px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.7)] md:shadow-[inset_0_0_80px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.7)]"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #0d5e2e 0%, #0a4a24 60%, #073d1c 100%)',
      }}
    >
      {/* Bordure dorée intérieure */}
      <div className="absolute inset-0 rounded-lg sm:rounded-[1.5rem] md:rounded-[2rem] border border-gold/30 pointer-events-none" />

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

      {/* ── 1. Zone adversaires (25%) ── */}
      <div className="flex-[25] min-h-0 flex items-start justify-evenly px-2 sm:px-3 md:px-4">
        {bots.map((bot) => {
          const botGlobalIdx = state.players.findIndex((p) => p.id === bot.id);
          return (
            <div key={bot.id} className="z-[2]">
              <PlayerZone
                player={bot}
                isBot={true}
                isActive={botGlobalIdx === state.currentPlayerIndex}
                activeZone={getActiveZone(bot)}
                selectedCards={[]}
                playerIndex={botGlobalIdx}
                debugRevealHands={debugRevealHands}
              />
            </div>
          );
        })}
      </div>

      {/* ── 2. Zone principale (40%) — 3 colonnes ── */}
      <div className="flex-[40] min-h-0 flex px-2 sm:px-3 md:px-4 gap-1 sm:gap-2">
        {/* Colonne gauche (25%) — Résumé pouvoirs / Révolution + Cimetière / Pioche */}
        <div className="w-1/4 flex flex-col h-full bg-black/10 rounded-lg gap-1 p-1">
          {/* Cadre haut — Résumé des pouvoirs ou Révolution */}
          <div className="flex-1 min-h-0 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden p-2">
            {(state.phase === 'revolution' || state.phase === 'superRevolution') ? (
              <RevolutionBanner phase={state.phase} />
            ) : (
              <PowerSummary variant={state.variant} />
            )}
          </div>
          {/* Zone basse — Cimetière + Pioche (espacement harmonieux) */}
          <div className="flex-1 min-h-0 flex items-center justify-evenly overflow-hidden">
            <GraveyardDisplay graveyard={state.graveyard} />
            <div
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 ${onInspectZone ? 'cursor-pointer' : ''}`}
              onClick={onInspectZone ? () => onInspectZone('deck') : undefined}
            >
              <div className="relative flex-shrink-0">
                {state.deck.length > 0 ? (
                  <>
                    {state.deck.length > 1 && (
                      <div className="absolute top-0.5 left-0.5 w-11 h-16 rounded-lg bg-blue-900 border-2 border-blue-800" />
                    )}
                    <div className="relative">
                      <Card card={{ id: 'deck', suit: 'spades', rank: '2' }} faceDown size="sm" />
                    </div>
                  </>
                ) : (
                  <div className="w-11 h-16 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                    <span className="text-gray-600 text-[8px]">vide</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-gray-300 font-semibold">Pioche</span>
              <span className="text-[10px] sm:text-xs text-gray-400">{state.deck.length}</span>
              {onInspectZone && <span className="text-[10px] text-gold/50 hover:text-gold transition-colors">inspecter</span>}
            </div>
          </div>
        </div>

        {/* Colonne centre (50%) — Pile + Overlay absolu */}
        <div className="w-1/2 h-full bg-white/[2.5%] rounded-lg relative">
          <CardsColumn state={state} humanId={humanId} />
          {/* Power Overlay — centered absolute, no layout shift */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <PowerOverlay power={currentPower ?? null} players={state.players} />
          </div>
        </div>

        {/* Colonne droite (25%) — Dernier coup + MiniLog (50/50) */}
        <div className="w-1/4 flex flex-col h-full bg-black/10 rounded-lg gap-1 p-1">
          {/* Cadre — Dernier coup (50%) */}
          <div className="flex-1 min-h-0 bg-black/20 rounded-lg overflow-hidden p-1.5 flex flex-col items-center justify-center">
            <LastPlayDisplay log={state.log} />
          </div>
          {/* MiniLog étendu (50%) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <MiniLog log={state.log} maxEntries={8} />
          </div>
        </div>
      </div>

      {/* ── 4. Zone joueur humain (35%) — décalé vers le bas ── */}
      <div className="flex-[35] min-h-0 px-2 sm:px-4 md:px-6 pb-2 sm:pb-3 pt-2 sm:pt-3 flex justify-center items-start">
        <PlayerZone
          player={human}
          isBot={false}
          isActive={isMyTurn}
          activeZone={humanActiveZone}
          selectedCards={selectedCards}
          playerIndex={humanIdx}
          onCardClick={onCardClick}
          onFaceDownClick={onFaceDownPlay}
          compact={isMobile}
          comboHandFlopEnabled={comboHandFlopEnabled}
          comboFlopDarkEnabled={comboFlopDarkEnabled}
          isBurnSelection={isBurnSelection}
        />
      </div>

      {/* ── Status (sous la main du héros) — fixed height to avoid layout shift ── */}
      <div className="flex-none h-5 text-center px-2 pb-1">
        {status && (
          <p className={`text-[10px] sm:text-xs leading-tight truncate ${statusIsIllegal ? 'text-orange-400' : 'text-gray-300/80'}`}>{status}</p>
        )}
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

      {/* ── Target choice (post-play As : qui joue après ?) ── */}
      <AnimatePresence>
        {pendingTargetForHuman && onTargetChoice && (
          <TargetPickerModal
            title="Target (As)"
            description="Choisissez qui jouera après vous."
            players={state.players}
            humanId={humanId}
            onSelect={onTargetChoice}
          />
        )}
      </AnimatePresence>

      {/* ── Manouche target picker (multi-jack: targetId not yet set) ── */}
      <AnimatePresence>
        {pendingManoucheTargetForHuman && !state.pendingActionDelayed && onManoucheTarget && (
          <TargetPickerModal
            title="Manouche ♠"
            description="Choisissez un adversaire pour l'échange."
            players={state.players.filter((p) => !p.isFinished && p.id !== humanId && p.hand.length > 0)}
            humanId={humanId}
            onSelect={onManoucheTarget}
          />
        )}
      </AnimatePresence>

      {/* ── Manouche pick ── */}
      <AnimatePresence>
        {pendingManoucheForHuman && !state.pendingActionDelayed && onManouchePick && (
          <ManouchePickModal
            state={state}
            humanId={humanId}
            onPick={onManouchePick}
          />
        )}
      </AnimatePresence>

      {/* ── Super Manouche target picker (multi-jack: targetId not yet set) ── */}
      <AnimatePresence>
        {pendingSuperManoucheTargetForHuman && !state.pendingActionDelayed && onManoucheTarget && (
          <TargetPickerModal
            title="Super Manouche ♠"
            description="Choisissez un adversaire pour l'échange."
            players={state.players.filter((p) => !p.isFinished && p.id !== humanId && p.hand.length > 0)}
            humanId={humanId}
            onSelect={onManoucheTarget}
          />
        )}
      </AnimatePresence>

      {/* ── Super Manouche pick ── */}
      <AnimatePresence>
        {pendingSuperManoucheForHuman && !state.pendingActionDelayed && onSuperManouchePick && (
          <SuperManouchePickModal
            state={state}
            humanId={humanId}
            onPick={onSuperManouchePick}
          />
        )}
      </AnimatePresence>

      {/* ── Shifumi target picker (initiator picks 2 players) ── */}
      <AnimatePresence>
        {pendingShifumiTargetForHuman && !state.pendingActionDelayed && onShifumiTarget && (
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
        {pendingShifumiChoiceForHuman && !state.pendingActionDelayed && onShifumiChoice && (
          <ShifumiChoiceModal
            isSuper={pending?.type === 'superShifumi'}
            onChoice={onShifumiChoice}
          />
        )}
      </AnimatePresence>

      {/* ── FirstPlayerShifumi / AllBlockedShifumi choice ── */}
      <AnimatePresence>
        {pendingGenericShifumiForHuman && onShifumiChoice && (
          <ShifumiChoiceModal
            isSuper={false}
            onChoice={onShifumiChoice}
          />
        )}
      </AnimatePresence>

      {/* ── Shifumi result popup (visible to all) ── */}
      <AnimatePresence>
        {pendingShifumiResult && (
          <ShifumiResultModal pending={pendingShifumiResult} />
        )}
      </AnimatePresence>

      {/* ── Flop Reverse target picker ── */}
      <AnimatePresence>
        {pendingFlopReverseForHuman && !state.pendingActionDelayed && onFlopReverseTarget && (
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
        {pendingFlopRemakeTargetForHuman && !state.pendingActionDelayed && onFlopRemakeTarget && (
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
        {pendingFlopRemakeForHuman && !state.pendingActionDelayed && onFlopRemake && (
          <FlopRemakeModal
            state={state}
            humanId={humanId}
            onSubmit={onFlopRemake}
          />
        )}
      </AnimatePresence>

      {/* ── Multi-Jack Order modal ── */}
      <AnimatePresence>
        {pendingMultiJackForHuman && onMultiJackOrder && (
          <MultiJackOrderModal
            state={state}
            humanId={humanId}
            onSubmit={onMultiJackOrder}
          />
        )}
      </AnimatePresence>

      {/* ── Revolution Confirmation popup ── */}
      <AnimatePresence>
        {pendingRevolutionConfirmForHuman && !state.pendingActionDelayed && pendingRevolutionConfirm && onRevolutionConfirm && (
          <ModalWrapper
            title={pendingRevolutionConfirm.isSuper ? 'Super Révolution ♦' : 'Révolution ♦'}
            subtitle={pendingRevolutionConfirm.isSuper
              ? 'Les valeurs sont inversées jusqu\'à la fin de la partie.'
              : 'Les valeurs sont inversées jusqu\'à ce qu\'un joueur ramasse.'}
          >
            <ModalButton variant="confirm" onClick={onRevolutionConfirm}>
              Confirmer
            </ModalButton>
          </ModalWrapper>
        )}
      </AnimatePresence>

      {/* ── Flop Pick-Up modal ── */}
      <AnimatePresence>
        {showFlopPickUp && onFlopPickUpOnly && onFlopPickUpWithFlop && (
          <FlopPickUpModal
            state={state}
            humanId={humanId}
            onPickUpOnly={onFlopPickUpOnly}
            onPickUpWithFlop={onFlopPickUpWithFlop}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameBoard;
