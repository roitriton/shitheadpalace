import type { Card, GamePhase, GameVariant } from '../types';
import { matchesPowerRank, isUniquePowerCard } from './utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the given card is a Jack of Clubs (J♣) — the card
 * that triggers Shifumi and Super Shifumi.
 *
 * The J♣ power is suit-specific and is not configurable via the variant.
 */
export function isShifumiCard(card: Card): boolean {
  return card.rank === 'J' && card.suit === 'clubs';
}

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger a regular Shifumi.
 *
 * Conditions:
 *   - At least one J♣ is in the played cards.
 *   - No Mirror card accompanies the play (J♣ + Mirror → Super Shifumi instead).
 *   - The game is not already in revolution or superRevolution phase (all card
 *     powers, including Shifumi, are suppressed during those phases).
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isShifumiTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some((c) => isUniquePowerCard(c, variant, 'shifumi'))) return false;
  // Mirror present → Super Shifumi, not regular Shifumi
  return !playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

/**
 * Returns true when playing `playedCards` should trigger a Super Shifumi.
 *
 * Conditions:
 *   - At least one J♣ is in the played cards.
 *   - At least one Mirror card (9 by default) accompanies the J♣.
 *   - The game is not already in revolution or superRevolution phase.
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isSuperShifumiTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some((c) => isUniquePowerCard(c, variant, 'shifumi'))) return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}
