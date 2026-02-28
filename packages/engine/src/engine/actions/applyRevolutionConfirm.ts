import type { GameState, PendingRevolutionConfirm } from '../../types';
import { applyRevolution, applySuperRevolution } from '../../powers/revolution';
import { advanceTurn, isPlayerFinished, isGameOver, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';
import { continueMultiJackSequence } from './applyMultiJackOrder';

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

// ─── applyRevolutionConfirm ──────────────────────────────────────────────────

/**
 * Applies a revolution or super revolution after the player confirms.
 *
 * Called when the player clicks "Confirmer" on the revolution confirmation popup.
 * Applies the revolution effect, sets lastPowerTriggered, then:
 *   - If a multiJackSequence is in progress, continues the sequence.
 *   - Otherwise, sets up cemetery transit and advances the turn.
 *
 * @param state     - Current game state with PendingRevolutionConfirm.
 * @param playerId  - ID of the player confirming.
 * @param timestamp - Wall-clock ms for log entries.
 */
export function applyRevolutionConfirm(
  state: GameState,
  playerId: string,
  timestamp = 0,
): GameState {
  if (state.pendingAction?.type !== 'PendingRevolutionConfirm') {
    throw new Error('No pending revolution confirmation');
  }

  const pending = state.pendingAction as PendingRevolutionConfirm;
  if (playerId !== pending.playerId) {
    throw new Error('Only the revolution launcher can confirm');
  }

  // Clear pendingAction
  let newState: GameState = { ...state, pendingAction: null };

  // Build cardsInfo from the top pile entry (the jack that triggered the revolution)
  const topEntry = newState.pile.length > 0 ? newState.pile[newState.pile.length - 1] : null;
  const cardsInfo = topEntry
    ? topEntry.cards.map((c) => ({ rank: c.rank, suit: c.suit }))
    : [];

  // Apply the revolution effect
  if (pending.isSuper) {
    newState = applySuperRevolution(newState, playerId, timestamp);
    newState = {
      ...newState,
      lastPowerTriggered: { type: 'superRevolution', playerId, cardsPlayed: cardsInfo },
    };
  } else {
    newState = applyRevolution(newState, playerId, timestamp);
    newState = {
      ...newState,
      lastPowerTriggered: { type: 'revolution', playerId, cardsPlayed: cardsInfo },
    };
  }

  // If in multi-jack sequence, the jack stays on pile — server will call
  // continueMultiJackSequence after animation delay (same as before).
  if (newState.multiJackSequence) {
    return newState;
  }

  // Single jack path: jack is already on pile with pendingCemeteryTransit set.
  // Check for player finish / game over, then advance turn.
  const playerIndex = newState.players.findIndex((p) => p.id === playerId);
  const finished = isPlayerFinished(newState.players[playerIndex]!);
  if (finished) newState = markPlayerFinished(newState, playerIndex, timestamp);
  if (isGameOver(newState)) return finalizeGame(newState, timestamp);

  return resolveAutoSkip(advanceTurn(newState, finished));
}
