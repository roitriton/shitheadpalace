import type { GameState } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';
import { canPlayerPlayAnything } from '../validation';

/**
 * Skips the current player's turn when they have no legal play available
 * and the pile is empty (so picking up is not an option either).
 *
 * This handles the edge case where a player's hand contains only Mirrors (9)
 * and/or Jacks (J), which cannot be played on an empty pile.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the player requesting to skip.
 * @param timestamp - Wall-clock ms for log entries (default 0 for tests).
 */
export function applySkipTurn(
  state: GameState,
  playerId: string,
  timestamp = 0,
): GameState {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) throw new Error(`Player '${playerId}' not found`);

  if (state.currentPlayerIndex !== playerIdx) {
    throw new Error('It is not your turn');
  }

  if (state.pile.length > 0) {
    throw new Error('Cannot skip turn when pile is not empty — pick up instead');
  }

  if (canPlayerPlayAnything(state, playerIdx)) {
    throw new Error('Cannot skip turn when you have a legal play available');
  }

  if (state.pendingAction !== null) {
    throw new Error('Cannot skip turn while a pending action is active');
  }

  const player = state.players[playerIdx]!;

  let newState = appendLog(state, 'skipTurn', timestamp, playerId, player.name, {
    message: `${player.name} ne peut pas jouer`,
  });

  newState = appendLog(newState, 'skipTurnEffect', timestamp, playerId, player.name, {
    message: `${player.name} passe son tour`,
  }, 'effect');

  return resolveAutoSkip(advanceTurn(newState, false));
}
