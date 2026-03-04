import type {
  Card,
  GameState,
  MultiJackSequenceEntry,
  PendingMultiJackOrder,
  PileEntry,
} from '../../types';
import { advanceTurn, isGameOver, isPlayerFinished, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Moves the top pile entry to the graveyard. Used after a jack's power
 * has been resolved during multi-jack sequence processing.
 */
function moveTopPileToGraveyard(state: GameState): GameState {
  if (state.pile.length === 0) return state;
  const topIdx = state.pile.length - 1;
  const topCards = state.pile[topIdx]!.cards;
  return {
    ...state,
    pile: state.pile.slice(0, topIdx),
    graveyard: [...state.graveyard, ...topCards],
  };
}

function markPlayerFinished(
  state: GameState,
  playerIndex: number,
  timestamp: number,
): GameState {
  const player = state.players[playerIndex]!;
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, isFinished: true };
  const newFinishOrder = [...state.finishOrder, player.id];
  const place = newFinishOrder.length;
  let newState: GameState = { ...state, players: newPlayers, finishOrder: newFinishOrder };
  newState = appendLog(newState, 'playerFinished', timestamp, player.id, player.name, { place });
  return newState;
}

function finalizeGame(state: GameState, timestamp: number): GameState {
  const lastActive = state.players.find((p) => !p.isFinished);
  const newPlayers = state.players.map((p) => (p.isFinished ? p : { ...p, isFinished: true }));
  const finishOrder = lastActive
    ? [...state.finishOrder, lastActive.id]
    : state.finishOrder;

  let newState: GameState = {
    ...state,
    players: newPlayers,
    finishOrder,
    phase: 'finished',
    turnOrder: [],
    multiJackSequence: undefined,
  };

  if (lastActive) {
    newState = appendLog(newState, 'playerFinished', timestamp, lastActive.id, lastActive.name, {
      place: newState.finishOrder.length,
    });
  }

  newState = appendLog(newState, 'gameOver', timestamp, undefined, undefined, {
    finishOrder: newState.finishOrder,
  });

  return newState;
}

/**
 * Determines the jack power type based on suit and mirror presence.
 */
function getJackPowerType(
  jackCard: Card,
  hasMirror: boolean,
): { power: string; isSuper: boolean } {
  switch (jackCard.suit) {
    case 'diamonds':
      return { power: hasMirror ? 'superRevolution' : 'revolution', isSuper: hasMirror };
    case 'spades':
      return { power: hasMirror ? 'superManouche' : 'manouche', isSuper: hasMirror };
    case 'hearts':
      return { power: hasMirror ? 'flopRemake' : 'flopReverse', isSuper: hasMirror };
    case 'clubs':
      return { power: hasMirror ? 'superShifumi' : 'shifumi', isSuper: hasMirror };
  }
}

// ─── Core resolution ─────────────────────────────────────────────────────────

/**
 * Resolves the next jack in the multi-jack sequence.
 *
 * For immediate powers (Revolution/Super Revolution), applies the power and
 * returns the state with the jack still on the pile and `lastPowerTriggered`
 * set. The server must call `continueMultiJackSequence` after an animation
 * delay to move the jack to graveyard and continue to the next jack.
 *
 * For interactive powers (Manouche, Shifumi, Flop Reverse/Remake), places
 * the jack on the pile, sets the appropriate pending action, and stores the
 * remaining sequence in `multiJackSequence` for later continuation.
 */
export function resolveNextMultiJack(state: GameState, timestamp: number): GameState {
  const seq = state.multiJackSequence;
  if (!seq || seq.remainingSequence.length === 0) {
    // Sequence complete — finalize
    return finalizeMultiJackSequence(state, timestamp);
  }

  const [current, ...rest] = seq.remainingSequence;
  const { jackCard, mirrorCard } = current!;
  const launcherId = seq.launcherId;
  const launcher = state.players.find((p) => p.id === launcherId)!;

  // 1. Place jack (+ optional mirror) on pile
  const cardsOnPile: Card[] = mirrorCard ? [jackCard, mirrorCard] : [jackCard];
  const entry: PileEntry = {
    cards: cardsOnPile,
    playerId: launcherId,
    playerName: launcher.name,
    timestamp,
  };
  let newState: GameState = { ...state, pile: [...state.pile, entry] };

  // Update multiJackSequence with current entry and remaining
  newState = {
    ...newState,
    multiJackSequence: {
      ...seq,
      remainingSequence: rest,
      currentJackEntry: current,
    },
  };

  // 2. Determine power
  const { power } = getJackPowerType(jackCard, !!mirrorCard);
  const cardsInfo = cardsOnPile.map((c) => ({ rank: c.rank, suit: c.suit }));

  newState = appendLog(newState, 'multiJackResolve', timestamp, launcherId, launcher.name, {
    jackSuit: jackCard.suit,
    power,
    hasMirror: !!mirrorCard,
  });

  // 3. Apply power
  switch (power) {
    case 'revolution': {
      // Deferred: set PendingRevolutionConfirm instead of applying directly
      newState = {
        ...newState,
        pendingAction: {
          type: 'PendingRevolutionConfirm',
          playerId: launcherId,
          isSuper: false,
        },
        lastPowerTriggered: { type: 'revolution', playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      return newState;
    }

    case 'superRevolution': {
      // Deferred: set PendingRevolutionConfirm instead of applying directly
      newState = {
        ...newState,
        pendingAction: {
          type: 'PendingRevolutionConfirm',
          playerId: launcherId,
          isSuper: true,
        },
        lastPowerTriggered: { type: 'superRevolution', playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      return newState;
    }

    case 'manouche':
    case 'superManouche': {
      // Set pending manouche WITHOUT target — target chosen via manoucheTarget action
      newState = {
        ...newState,
        pendingAction: { type: power, launcherId },
        lastPowerTriggered: { type: power, playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      newState = appendLog(newState, power, timestamp, launcherId, launcher.name, {}, 'power');
      return newState;
    }

    case 'flopReverse': {
      newState = {
        ...newState,
        pendingAction: { type: 'flopReverse', launcherId },
        lastPowerTriggered: { type: 'flopReverse', playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      newState = appendLog(newState, 'flopReverse', timestamp, launcherId, launcher.name, {}, 'power');
      return newState;
    }

    case 'flopRemake': {
      newState = {
        ...newState,
        pendingAction: { type: 'flopRemake', launcherId },
        lastPowerTriggered: { type: 'flopRemake', playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      newState = appendLog(newState, 'flopRemake', timestamp, launcherId, launcher.name, {}, 'power');
      return newState;
    }

    case 'shifumi':
    case 'superShifumi': {
      newState = {
        ...newState,
        pendingAction: { type: power, initiatorId: launcherId },
        lastPowerTriggered: { type: power, playerId: launcherId, cardsPlayed: cardsInfo },
        pendingActionDelayed: true,
        pendingCardsPlayed: cardsInfo,
      };
      newState = appendLog(newState, power, timestamp, launcherId, launcher.name, {}, 'power');
      return newState;
    }

    default:
      return newState;
  }
}

/**
 * Resolves a deferred shifumi pile pickup.
 *
 * Moves the current jack from pile top to graveyard, gives the remaining
 * pile cards to the loser, clears the pile, and cancels non-super revolution
 * if active (since emptying the pile cancels revolution).
 */
function resolveShifumiPickup(state: GameState): GameState {
  const seq = state.multiJackSequence!;
  const { loserId } = seq.pendingShifumiPickup!;

  const loserIdx = state.players.findIndex((p) => p.id === loserId);
  const loser = state.players[loserIdx]!;

  // Separate jack (top pile entry) from the rest
  let jackToGraveyard: Card[] = [];
  let pileCards: Card[] = [];

  if (seq.currentJackEntry && state.pile.length > 0) {
    const topEntry = state.pile[state.pile.length - 1]!;
    jackToGraveyard = topEntry.cards;
    const restPile = state.pile.slice(0, -1);
    pileCards = restPile.flatMap((e) => e.cards);
  } else {
    pileCards = state.pile.flatMap((e) => e.cards);
  }

  const newPlayers = [...state.players];
  newPlayers[loserIdx] = { ...loser, hand: [...loser.hand, ...pileCards] };

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pile: [],
    graveyard: [...state.graveyard, ...jackToGraveyard],
    activeUnder: null,
    pileResetActive: false,
    multiJackSequence: {
      ...seq,
      currentJackEntry: undefined,
      pendingShifumiPickup: undefined,
    },
  };

  // Cancel non-super revolution when pile is emptied.
  // A regular revolution is tied to the pile — emptying the pile cancels it.
  // Super Revolution is permanent and survives pile emptying.
  if (state.revolution && !state.superRevolution) {
    newState = { ...newState, phase: 'playing' as const, revolution: false };
  }

  return newState;
}

/**
 * Called after a sub-power resolves during a multi-jack sequence to move
 * the current jack to graveyard and continue with the next jack.
 *
 * For non-pile-clearing resolutions (manouche, flop reverse), the jack is
 * still on top of the pile and must be moved to graveyard.
 *
 * For deferred shifumi pickups, resolves the pickup first (jack→graveyard,
 * pile→loser hand) before continuing with the next jack.
 */
export function continueMultiJackSequence(state: GameState, timestamp: number): GameState {
  const seq = state.multiJackSequence;
  if (!seq) {
    // No multi-jack sequence — fall back to normal turn advancement
    return resolveAutoSkip(advanceTurn(state, false));
  }

  // Handle deferred shifumi pickup first
  if (seq.pendingShifumiPickup) {
    state = resolveShifumiPickup(state);
    // Re-read sequence after state mutation
    const updatedSeq = state.multiJackSequence;
    if (!updatedSeq) {
      return resolveAutoSkip(advanceTurn(state, false));
    }
    // Continue with next jack or finalize
    if (updatedSeq.remainingSequence.length > 0) {
      return resolveNextMultiJack(state, timestamp);
    }
    return finalizeMultiJackSequence(state, timestamp);
  }

  // Move current jack to graveyard if still on top of pile
  if (seq.currentJackEntry && state.pile.length > 0) {
    const topEntry = state.pile[state.pile.length - 1]!;
    const jackId = seq.currentJackEntry.jackCard.id;
    const topContainsJack = topEntry.cards.some((c) => c.id === jackId);
    if (topContainsJack) {
      state = moveTopPileToGraveyard(state);
    }
  }

  // Continue with next jack or finalize
  if (seq.remainingSequence.length > 0) {
    return resolveNextMultiJack(state, timestamp);
  }

  return finalizeMultiJackSequence(state, timestamp);
}

/**
 * Finalizes the multi-jack sequence: checks if launcher finished, cleans up
 * multiJackSequence, and advances the turn.
 */
function finalizeMultiJackSequence(state: GameState, timestamp: number): GameState {
  const seq = state.multiJackSequence;
  if (!seq) return resolveAutoSkip(advanceTurn(state, false));

  const launcherIdx = state.players.findIndex((p) => p.id === seq.launcherId);
  let newState: GameState = { ...state, multiJackSequence: undefined };

  // Check if launcher finished (may have lost all cards during the sequence)
  const finished = isPlayerFinished(newState.players[launcherIdx]!);
  if (finished) {
    newState = markPlayerFinished(newState, launcherIdx, timestamp);
  }
  if (isGameOver(newState)) return finalizeGame(newState, timestamp);

  return resolveAutoSkip(advanceTurn(newState, finished));
}

// ─── Public action handler ──────────────────────────────────────────────────

/**
 * Applies the player's chosen resolution order for a multi-jack play.
 *
 * Validates:
 * - State has PendingMultiJackOrder
 * - Player is the multi-jack launcher
 * - All jacks are present in the sequence
 * - Mirror assignment is correct (exactly one jack gets the mirror in J+J+9 case)
 * - No mirror assigned when none available (J+J and J+J+J cases)
 *
 * Then starts resolving the first jack in the sequence.
 *
 * @param state     - Current game state with PendingMultiJackOrder.
 * @param playerId  - ID of the player submitting the choice.
 * @param sequence  - Ordered array of jack entries with optional mirror assignment.
 * @param timestamp - Wall-clock ms for log entries.
 */
export function applyMultiJackOrder(
  state: GameState,
  playerId: string,
  sequence: MultiJackSequenceEntry[],
  timestamp = 0,
): GameState {
  // ── Guards ──────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'PendingMultiJackOrder') {
    throw new Error('No pending multi-jack order action');
  }

  const pending = state.pendingAction as PendingMultiJackOrder;
  if (playerId !== pending.playerId) {
    throw new Error('Only the multi-jack launcher can choose the resolution order');
  }

  // Validate all jacks are present in the sequence
  const pendingJackIds = new Set(pending.jacks.map((c) => c.id));
  const sequenceJackIds = new Set(sequence.map((e) => e.jackCard.id));

  if (sequenceJackIds.size !== pendingJackIds.size) {
    throw new Error(
      `Sequence must contain exactly ${pendingJackIds.size} jacks, got ${sequenceJackIds.size}`,
    );
  }
  for (const id of pendingJackIds) {
    if (!sequenceJackIds.has(id)) {
      throw new Error(`Jack card '${id}' is missing from the sequence`);
    }
  }

  // Validate each jackCard in sequence matches a pending jack
  for (const entry of sequence) {
    if (!pendingJackIds.has(entry.jackCard.id)) {
      throw new Error(`Card '${entry.jackCard.id}' is not one of the pending jacks`);
    }
  }

  // Validate mirror assignment
  const mirrorsInSequence = sequence.filter((e) => e.mirrorCard !== undefined);
  const availableMirrors = pending.mirrors;

  if (availableMirrors.length === 0) {
    // J+J or J+J+J: no mirror should be assigned
    if (mirrorsInSequence.length > 0) {
      throw new Error('No mirror available — cannot assign mirror to any jack');
    }
  } else {
    // J+J+9: exactly one mirror must be assigned to one jack
    if (mirrorsInSequence.length !== availableMirrors.length) {
      throw new Error(
        `Must assign exactly ${availableMirrors.length} mirror(s), got ${mirrorsInSequence.length}`,
      );
    }

    // Validate mirror card IDs match
    const pendingMirrorIds = new Set(availableMirrors.map((c) => c.id));
    for (const entry of mirrorsInSequence) {
      if (!pendingMirrorIds.has(entry.mirrorCard!.id)) {
        throw new Error(`Mirror card '${entry.mirrorCard!.id}' is not one of the pending mirrors`);
      }
    }
  }

  // ── Set up multi-jack sequence and start resolution ──────────────────────
  const launcherName = state.players.find((p) => p.id === playerId)?.name ?? playerId;

  let newState: GameState = {
    ...state,
    pendingAction: null,
    multiJackSequence: {
      remainingSequence: sequence,
      launcherId: playerId,
    },
  };

  newState = appendLog(newState, 'multiJackOrder', timestamp, playerId, launcherName, {
    sequence: sequence.map((e) => ({
      jackSuit: e.jackCard.suit,
      hasMirror: !!e.mirrorCard,
    })),
  });

  return resolveNextMultiJack(newState, timestamp);
}
