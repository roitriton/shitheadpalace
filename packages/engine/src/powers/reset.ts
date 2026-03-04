import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger the Reset effect.
 *
 * Reset triggers when the played rank matches the Reset power assignment
 * in the variant. Disabled during revolution / superRevolution.
 *
 * @param playedCards - Cards being played (single-rank set).
 * @param variant     - Game variant (for power-rank lookups).
 * @param phase       - Current game phase.
 */
export function isResetTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'reset'));
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Activates the Reset effect: sets `pileResetActive = true` so the next
 * player may play any card regardless of the current pile value.
 *
 * The flag is consumed (cleared) at the start of the next player's action.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the player who triggered Reset.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function applyReset(state: GameState, playerId: string, timestamp: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;

  let newState: GameState = { ...state, pileResetActive: true };
  newState = appendLog(newState, 'reset', timestamp, playerId, player.name, {}, 'power');
  newState = appendLog(newState, 'resetEffect', timestamp, playerId, player.name, {
    message: 'La pile est remise à zéro',
  }, 'effect');

  return newState;
}
