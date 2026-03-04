import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when the played cards trigger the Target power.
 *
 * The Target power fires when at least one card matching the 'target' power
 * assignment is played. It is disabled during revolution and superRevolution
 * (all card powers are suppressed in those phases).
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (for power-rank lookups).
 * @param phase       - Current game phase.
 */
export function isTargetTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'target'));
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Marks a pending target choice in the game state.
 *
 * After this call the launcher must submit a 'targetChoice' action naming
 * which active player should play next. No turn advancement happens until
 * that choice is resolved.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the player who played the Target card.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function applyTarget(
  state: GameState,
  playerId: string,
  timestamp: number,
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState: GameState = {
    ...state,
    pendingAction: { type: 'target', launcherId: playerId },
  };
  newState = appendLog(newState, 'target', timestamp, playerId, player.name, {}, 'power');
  return newState;
}
