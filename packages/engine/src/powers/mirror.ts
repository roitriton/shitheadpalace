import type { Card, GameState, GameVariant, Rank } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── Effective rank computation ───────────────────────────────────────────────

/**
 * Returns the effective rank when Mirror (9) cards accompany other cards.
 *
 * Mirror takes the value of the non-Mirror card it accompanies. When applied:
 * - There must be at least one non-Mirror card in the play (otherwise Mirror
 *   is being played alone, which is invalid — enforced by the caller).
 * - All non-Mirror cards must share the same rank (enforced by the caller).
 *
 * Returns null when:
 * - No Mirror card is present in the play (pure normal play).
 * - Only Mirror cards are present (invalid; returns null so the caller can reject).
 *
 * @param playedCards - All cards in the current play (may include Mirror cards).
 * @param variant     - Game variant (to identify which rank is Mirror).
 */
export function getMirrorEffectiveRank(
  playedCards: Card[],
  variant: GameVariant,
): Rank | null {
  const isMirrorCard = (c: Card) => matchesPowerRank(c.rank, variant, 'mirror');
  const mirrors = playedCards.filter(isMirrorCard);
  const nonMirrors = playedCards.filter((c) => !isMirrorCard(c));

  if (mirrors.length === 0) return null; // No Mirror in play
  if (nonMirrors.length === 0) return null; // Only Mirrors — caller must reject

  return nonMirrors[0]!.rank; // Non-Mirror card's rank becomes the effective rank
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Applies the Mirror effect: overwrites the `effectiveRank` of the most
 * recent PileEntry so that subsequent play-validation uses the accompanied
 * card's value instead of the Mirror's own rank.
 *
 * @param state         - Current game state (top PileEntry is the Mirror play).
 * @param effectiveRank - The rank of the non-Mirror card (the "true" pile value).
 * @param playerId      - ID of the player who triggered Mirror.
 * @param timestamp     - Wall-clock ms for the log entry.
 */
export function applyMirror(
  state: GameState,
  effectiveRank: Rank,
  playerId: string,
  timestamp: number,
): GameState {
  if (state.pile.length === 0) return state;

  const player = state.players.find((p) => p.id === playerId)!;

  const newPile = [...state.pile];
  newPile[newPile.length - 1] = { ...newPile[newPile.length - 1]!, effectiveRank };

  let newState: GameState = { ...state, pile: newPile };
  newState = appendLog(newState, 'mirror', timestamp, playerId, player.name, { effectiveRank }, 'power');

  return newState;
}
