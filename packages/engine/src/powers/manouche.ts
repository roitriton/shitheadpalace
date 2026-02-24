import type { Card, GamePhase, GameVariant } from '../types';
import { matchesPowerRank } from './utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the given card is a Jack of Spades (J♠) — the card
 * that triggers Manouche and Super Manouche.
 *
 * The J♠ power is suit-specific and is not configurable via the variant.
 */
export function isManoucheCard(card: Card): boolean {
  return card.rank === 'J' && card.suit === 'spades';
}

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger a regular Manouche.
 *
 * Conditions:
 *   - At least one J♠ is in the played cards.
 *   - No Mirror card accompanies the play (J♠ + Mirror → Super Manouche instead).
 *   - The game is not already in revolution or superRevolution phase (all card
 *     powers, including Manouche, are suppressed during those phases).
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isManoucheTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some(isManoucheCard)) return false;
  // Mirror present → Super Manouche, not regular Manouche
  return !playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

/**
 * Returns true when playing `playedCards` should trigger a Super Manouche.
 *
 * Conditions:
 *   - At least one J♠ is in the played cards.
 *   - At least one Mirror card (9 by default) accompanies the J♠.
 *   - The game is not already in revolution or superRevolution phase.
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isSuperManoucheTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some(isManoucheCard)) return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}
