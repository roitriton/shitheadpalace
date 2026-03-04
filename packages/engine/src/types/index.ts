// ─── Primitives ───────────────────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type Power =
  | 'burn'
  | 'reset'
  | 'under'
  | 'skip'
  | 'target'
  | 'mirror'
  | 'revolution'
  | 'superRevolution'
  | 'manouche'
  | 'superManouche'
  | 'flopReverse'
  | 'flopRemake'
  | 'shifumi'
  | 'superShifumi';

export type GamePhase =
  | 'setup'
  | 'swapping'
  | 'playing'
  | 'revolution'
  | 'superRevolution'
  | 'finished';

/** 1 = clockwise, -1 = counter-clockwise */
export type Direction = 1 | -1;

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type ShifumiChoice = 'rock' | 'paper' | 'scissors';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Card {
  /** Unique identifier within the game instance */
  id: string;
  suit: Suit;
  rank: Rank;
  /**
   * When true, rank and suit are placeholders — the actual card is hidden from
   * this viewer. Used by filterGameStateForPlayer to mask opponents' cards.
   */
  hidden?: true;
}

/** One "move" recorded in the pile for history display */
export interface PileEntry {
  cards: Card[];
  playerId: string;
  playerName: string;
  timestamp: number;
  /**
   * When Mirror (9) accompanies another card, the effective pile value is
   * overridden to this rank. Set by the Mirror power module; absent otherwise.
   */
  effectiveRank?: Rank;
}

export interface Player {
  id: string;
  name: string;
  /** Cards in hand — visible only to this player */
  hand: Card[];
  /** Face-up cards in front of the player (flop) — visible to all */
  faceUp: Card[];
  /** Face-down cards under the flop (dark flop) — hidden from everyone */
  faceDown: Card[];
  isFinished: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  /** True once the player has signalled 'ready' during the swapping phase */
  isReady?: boolean;
  /**
   * When true, the player knows the contents of their dark flop (after a
   * Flop Reverse swapped their faceUp and faceDown). They may play multiple
   * dark-flop cards at once, subject to the same rank/value rules as a
   * normal hand play.
   */
  faceDownRevealed?: boolean;
  /**
   * When true, the player has been targeted by Flop Reverse or Flop Remake
   * and knows the contents of their dark flop. Enables combo flop+dark flop
   * plays when emptying the faceUp zone.
   */
  hasSeenDarkFlop?: boolean;
  /**
   * When true, this player lost a Super Shifumi and is the designated Shit Head.
   * Only set by the Super Shifumi resolution; ends the game immediately.
   */
  isShitHead?: boolean;
}

// ─── Variant ──────────────────────────────────────────────────────────────────

export interface GameVariant {
  name: string;
  /** Maps each power to the card rank(s) that trigger it */
  powerAssignments: Partial<Record<Power, Rank | Rank[]>>;
  playerCount: number;
  /** Number of standard 52-card decks to use */
  deckCount: number;
}

// ─── Pending Actions ──────────────────────────────────────────────────────────

export interface PendingShifumi {
  type: 'shifumi' | 'superShifumi';
  initiatorId: string;
  /**
   * ID of the first combatant. Set when the initiator submits a
   * 'shifumiTarget' action choosing both participants.
   */
  player1Id?: string;
  /**
   * ID of the second combatant. Set when the initiator submits a
   * 'shifumiTarget' action choosing both participants.
   */
  player2Id?: string;
  player1Choice?: ShifumiChoice;
  player2Choice?: ShifumiChoice;
}

export interface PendingManouche {
  type: 'manouche' | 'superManouche';
  launcherId: string;
  /** Target player ID. Optional during multi-jack resolution (set via manoucheTarget). */
  targetId?: string;
}

export interface PendingFlopReverse {
  type: 'flopReverse';
  launcherId: string;
  targetId?: string;
}

export interface PendingFlopRemake {
  type: 'flopRemake';
  launcherId: string;
  targetId?: string;
}

export interface PendingTarget {
  type: 'target';
  launcherId: string;
}

export interface PendingFirstPlayerShifumi {
  type: 'firstPlayerShifumi';
  playerIds: string[];
  choices: Partial<Record<string, ShifumiChoice>>;
}

// ─── Multi-Jack ─────────────────────────────────────────────────────────────

/** Entry in a multi-jack resolution sequence: one jack with optional mirror. */
export interface MultiJackSequenceEntry {
  jackCard: Card;
  mirrorCard?: Card;
}

/**
 * Pending action: the player must choose the resolution order for multiple jacks
 * played simultaneously, and assign the mirror (if any) to one of the jacks.
 */
export interface PendingMultiJackOrder {
  type: 'PendingMultiJackOrder';
  playerId: string;
  /** The 2 or 3 real jacks played. */
  jacks: Card[];
  /** 0 or 1 mirror card played alongside the jacks. */
  mirrors: Card[];
}

export interface PendingAllBlockedShifumi {
  type: 'allBlockedShifumi';
  /** IDs of all active players who need to play shifumi to determine finish order */
  playerIds: string[];
  /** Accumulated shifumi choices for the current round */
  choices: Partial<Record<string, ShifumiChoice>>;
  /** Player IDs ranked so far (first = best position) — built across elimination rounds */
  rankedIds: string[];
}

export interface PendingRevolutionConfirm {
  type: 'PendingRevolutionConfirm';
  playerId: string;
  /** true = Super Révolution (permanent), false = Révolution (until pile pickup) */
  isSuper: boolean;
}

/**
 * Intermediate state after a shifumi round resolves, before the effect is applied.
 * Displayed as a popup to all players showing both choices and the outcome.
 * Auto-resolved by the server after a 3-second delay.
 */
export interface PendingShifumiResult {
  type: 'shifumiResult';
  player1Id: string;
  player1Name: string;
  player1Choice: ShifumiChoice;
  player2Id: string;
  player2Name: string;
  player2Choice: ShifumiChoice;
  /** Who won: 'tie', 'player1', or 'player2' */
  result: 'tie' | 'player1' | 'player2';
  /** Context: normal J♣, super J♣+mirror, or first-player tiebreak */
  shifumiType: 'normal' | 'super' | 'firstPlayer';
  /** Preserved state needed by resolveShifumiResult to apply the actual effect */
  _savedPendingAction?: PendingShifumi;
  _savedInitiatorId?: string;
}

export type PendingAction =
  | PendingShifumi
  | PendingManouche
  | PendingFlopReverse
  | PendingFlopRemake
  | PendingTarget
  | PendingFirstPlayerShifumi
  | PendingAllBlockedShifumi
  | PendingMultiJackOrder
  | PendingRevolutionConfirm
  | PendingShifumiResult;

// ─── Log ──────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: number;
  type: string;
  playerId?: string;
  playerName?: string;
  data: Record<string, unknown>;
  /** Entry category for display: action (default), power trigger, or effect/consequence */
  entryType?: 'action' | 'power' | 'effect';
}

// ─── Last Power Triggered ────────────────────────────────────────────────────

/** Describes the last power that was triggered, for client-side visual feedback. */
export interface LastPowerTriggered {
  type:
    | 'burn'
    | 'reset'
    | 'under'
    | 'skip'
    | 'target'
    | 'revolution'
    | 'superRevolution'
    | 'manouche'
    | 'superManouche'
    | 'flopReverse'
    | 'flopRemake'
    | 'shifumi'
    | 'superShifumi';
  /** ID of the player who triggered the power */
  playerId: string;
  /** ID of the target player, if applicable */
  targetId?: string;
  /** Number of players skipped (for cumulative skip) */
  skipCount?: number;
  /** IDs of the two shifumi participants */
  players?: string[];
  /** Cards that triggered the power (rank + suit), for display in overlay */
  cardsPlayed?: { rank: string; suit: string }[];
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  /** The draw pile */
  deck: Card[];
  /** Active play pile with full history of who played what */
  pile: PileEntry[];
  /** Burned cards (face-down) */
  graveyard: Card[];
  currentPlayerIndex: number;
  direction: Direction;
  /** Remaining turn order indices (handles skip, target) */
  turnOrder: number[];
  /** Player IDs who have finished, in order of finishing */
  finishOrder: string[];
  variant: GameVariant;
  /** Non-null when an action requires player input before continuing */
  pendingAction: PendingAction | null;
  log: LogEntry[];
  /** Last power that was triggered, for client-side visual feedback. Reset to null at the start of each new action. */
  lastPowerTriggered: LastPowerTriggered | null;
  /**
   * Stores the cards played for a deferred power (target, manouche, etc.)
   * so that the apply*Choice function can include them in lastPowerTriggered.
   * Set in resolvePowers, consumed in apply*Choice.
   */
  pendingCardsPlayed?: { rank: string; suit: string }[];
  /**
   * When set, the current player must play a card with value ≤ this number
   * (Under / 8 power effect). Cleared at the start of the constrained player's action.
   */
  activeUnder?: number | null;
  /**
   * When true, the current player may play any card regardless of pile value
   * (Reset / 2 power effect). Cleared at the start of the constrained player's action.
   */
  pileResetActive?: boolean;
  /**
   * When true, the game is in Revolution mode: card values are inverted (low beats high)
   * and all card powers are suppressed. Mirrors `phase === 'revolution' | 'superRevolution'`.
   * Set by the J♦ power; cleared when any player picks up the pile (unless superRevolution).
   */
  revolution?: boolean;
  /**
   * When true, the Revolution is permanent for the rest of the game and is never
   * cancelled by a pile pick-up. Mirrors `phase === 'superRevolution'`.
   * Set by the J♦ + Mirror play.
   */
  superRevolution?: boolean;
  /**
   * When true, cards need to be moved to the graveyard (burn or jack transit).
   * Set by resolvePowers, consumed by resolveCemeteryTransit in applyPlay.
   */
  pendingCemeteryTransit?: boolean;
  /**
   * When true, the server should show the overlay animation (lastPowerTriggered)
   * before revealing the popup for interactive jack powers.
   * Set by resolvePowers/resolveNextMultiJack, cleared by the server after the delay.
   */
  pendingActionDelayed?: boolean;
  /**
   * Tracks the in-progress multi-jack resolution sequence.
   * Set when multiple jacks are played together and the player has chosen the
   * resolution order. Consumed one jack at a time by resolveNextMultiJack.
   */
  multiJackSequence?: {
    remainingSequence: MultiJackSequenceEntry[];
    launcherId: string;
    /** The jack currently being resolved (placed on pile, pending power resolution). */
    currentJackEntry?: MultiJackSequenceEntry;
    /**
     * Set when a shifumi loser needs to pick up the pile after the animation delay.
     * The actual pickup (jack→graveyard + pile→loser hand) is deferred to
     * continueMultiJackSequence so the client can show the jack in the pile first.
     */
    pendingShifumiPickup?: {
      loserId: string;
    };
  } | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'play'; cardIds: string[]; targetPlayerId?: string }
  | { type: 'pickUp' }
  | { type: 'swap'; handCardId: string; flopCardId: string }
  | { type: 'ready' }
  | { type: 'shifumiChoice'; choice: ShifumiChoice }
  | { type: 'shifumiTarget'; player1Id: string; player2Id: string }
  | { type: 'manouchePick'; takeCardId: string; giveCardIds: string[] }
  | { type: 'superManouchePick'; giveCardIds: string[]; takeCardIds: string[] }
  | { type: 'flopReverseTarget'; targetPlayerId: string }
  | { type: 'flopRemakeTarget'; targetPlayerId: string }
  | { type: 'flopRemake'; faceUp: string[]; faceDown: string[] }
  | { type: 'targetChoice'; targetPlayerId: string }
  | { type: 'pickUpWithFlop'; flopCardIds: string[] }
  | { type: 'multiJackOrder'; sequence: MultiJackSequenceEntry[] }
  | { type: 'manoucheTarget'; targetPlayerId: string }
  | { type: 'revolutionConfirm' }
  | { type: 'resolveShifumiResult' }
  | { type: 'manoucheSkip' };

// ─── Bot Strategy Interface ───────────────────────────────────────────────────

export interface ManoucheChoice {
  takeCardId: string;
  giveCardIds: string[];
}

export interface SuperManoucheChoice {
  giveCardIds: string[];
  takeCardIds: string[];
}

export interface BotStrategy {
  /** Choose the next game action for a bot player */
  chooseAction(state: GameState, playerId: string): GameAction;
  /** Choose a shifumi move */
  chooseShifumiChoice(): ShifumiChoice;
  /** Choose cards to exchange in a Manouche */
  chooseManoucheCards(state: GameState, playerId: string, targetId: string): ManoucheChoice;
  /** Choose cards to exchange in a Super Manouche */
  chooseSuperManoucheCards(
    state: GameState,
    playerId: string,
    targetId: string,
  ): SuperManoucheChoice;
}
