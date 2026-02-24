import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns how many players should skip their next turn based on the played cards.
 *
 * Skip count = (number of Skip cards) + (number of Mirror cards in the play),
 * but only when at least one Skip card is present. Mirror cards that accompany
 * a Skip card each count as one additional skip. Returns 0 when no Skip card
 * is played, or when the phase is revolution / superRevolution.
 *
 * Examples (skip = '7', mirror = '9'):
 *   [7]        → 1   (1 skip, 0 mirrors)
 *   [7, 9]     → 2   (1 skip + 1 mirror)
 *   [7, 9, 9]  → 3   (1 skip + 2 mirrors)
 *   [9, K]     → 0   (no skip card — mirrors don't count alone)
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (for power-rank lookups).
 * @param phase       - Current game phase.
 */
export function getSkipCount(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): number {
  if (phase === 'revolution' || phase === 'superRevolution') return 0;
  const skipCards = playedCards.filter((c) => matchesPowerRank(c.rank, variant, 'skip'));
  if (skipCards.length === 0) return 0;
  const mirrorCards = playedCards.filter((c) => matchesPowerRank(c.rank, variant, 'mirror'));
  return skipCards.length + mirrorCards.length;
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Logs the Skip event. The actual turn-skipping is applied by passing
 * `skipCount` to `advanceTurn` — this function only records the log entry.
 *
 * @param state     - Current game state.
 * @param skipCount - Number of players being skipped.
 * @param playerId  - ID of the player who triggered Skip.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function logSkip(
  state: GameState,
  skipCount: number,
  playerId: string,
  timestamp: number,
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  return appendLog(state, 'skip', timestamp, playerId, player.name, { skipCount });
}
