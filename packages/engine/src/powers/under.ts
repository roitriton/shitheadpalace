import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { getRankValue } from '../utils/ranks';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger the Under effect.
 *
 * Under triggers when the played rank matches the Under power assignment
 * in the variant. Disabled during revolution / superRevolution.
 *
 * @param playedCards - Cards being played (single-rank set).
 * @param variant     - Game variant (for power-rank lookups).
 * @param phase       - Current game phase.
 */
export function isUnderTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'under'));
}

/**
 * Returns the numeric value of the Under card in `playedCards`.
 * If multiple Under cards are played (e.g. two 8s), the value is the same
 * since they share the same rank. Returns 0 when no Under card is found.
 */
export function getUnderValue(playedCards: Card[], variant: GameVariant): number {
  const underCard = playedCards.find((c) => matchesPowerRank(c.rank, variant, 'under'));
  return underCard ? getRankValue(underCard.rank) : 0;
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Activates the Under effect: sets `activeUnder` to the Under card's numeric
 * value so the next player must play a card with value ≤ that number.
 *
 * The flag is consumed (cleared) at the start of the next player's action.
 *
 * @param state      - Current game state.
 * @param underValue - Numeric value of the Under card (e.g. 8 for rank '8').
 * @param playerId   - ID of the player who triggered Under.
 * @param timestamp  - Wall-clock ms for the log entry.
 */
export function applyUnder(
  state: GameState,
  underValue: number,
  playerId: string,
  timestamp: number,
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;

  let newState: GameState = { ...state, activeUnder: underValue };
  newState = appendLog(newState, 'under', timestamp, playerId, player.name, { underValue }, 'power');
  newState = appendLog(newState, 'underEffect', timestamp, playerId, player.name, {
    message: 'Le prochain joueur doit jouer en dessous.',
    underValue,
  }, 'effect');

  return newState;
}
