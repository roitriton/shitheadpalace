import type { Card, GameState, Player } from '../types';
import { getRankValue } from '../utils/ranks';
import { matchesPowerRank } from '../powers/utils';

/** The three zones a player can play cards from, in priority order. */
export type ActiveZone = 'hand' | 'faceUp' | 'faceDown';

// ─── Pile helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the numeric value that the next played card must match or exceed
 * under normal rules. Returns null when the pile is empty (any card may be played).
 *
 * When the top PileEntry carries an `effectiveRank` (set by the Mirror power),
 * that rank is used instead of the physical card rank.
 */
export function getTopPileValue(state: GameState): number | null {
  if (state.pile.length === 0) return null;
  const lastEntry = state.pile[state.pile.length - 1]!;
  const rank = lastEntry.effectiveRank ?? lastEntry.cards[0]!.rank;
  return getRankValue(rank);
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

/**
 * Determines which zone the player must play from.
 * Priority: hand > faceUp (flop) > faceDown (dark flop).
 * Returns null when the player has no cards left in any zone.
 */
export function getActiveZone(player: Player): ActiveZone | null {
  if (player.hand.length > 0) return 'hand';
  if (player.faceUp.length > 0) return 'faceUp';
  if (player.faceDown.length > 0) return 'faceDown';
  return null;
}

/**
 * Returns the cards from the specified zone of a player.
 * Type-safe alternative to indexed access with a union key.
 */
export function getZoneCards(player: Player, zone: ActiveZone): Card[] {
  switch (zone) {
    case 'hand':
      return player.hand;
    case 'faceUp':
      return player.faceUp;
    case 'faceDown':
      return player.faceDown;
  }
}

/**
 * Returns a copy of the player with the specified zone replaced by `cards`.
 * Pure function — the original player object is not mutated.
 */
export function setZoneCards(player: Player, zone: ActiveZone, cards: Card[]): Player {
  switch (zone) {
    case 'hand':
      return { ...player, hand: cards };
    case 'faceUp':
      return { ...player, faceUp: cards };
    case 'faceDown':
      return { ...player, faceDown: cards };
  }
}

// ─── Play validation ──────────────────────────────────────────────────────────

/**
 * Returns true when all cards in the array share the same rank.
 * Returns false for an empty array.
 */
export function allSameRank(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  const firstRank = cards[0]!.rank;
  return cards.every((c) => c.rank === firstRank);
}

/**
 * Returns true when the given cards may legally be played on the current pile
 * under base game rules, including active power modifiers.
 *
 * Rules (checked in priority order):
 * 1. Empty pile: any card is playable.
 * 2. Revolution / superRevolution phase: card value ≤ top pile value.
 *    All special power rank bypasses (Reset, Skip, Burn) are disabled.
 * 3. Reset-rank card: always playable regardless of pile value or Under constraint.
 * 4. Skip-rank card: always playable regardless of pile value or Under constraint.
 * 5. pileResetActive flag: any card is playable (state effect from a previous Reset play).
 * 6. Under active (activeUnder): card value ≤ activeUnder.
 *    Burn-rank is subject to this constraint if its value exceeds activeUnder.
 * 7. Burn-rank card: always playable in normal play (bypasses pile value ordering).
 * 8. Normal play: card value ≥ top pile value.
 *
 * Does NOT validate whose turn it is, which zone the cards come from, or
 * whether all cards share the same rank (handled by the caller).
 */
export function canPlayCards(cards: Card[], state: GameState): boolean {
  if (cards.length === 0) return false;
  if (!allSameRank(cards)) return false;

  const isRevolution = state.phase === 'revolution' || state.phase === 'superRevolution';
  const topValue = getTopPileValue(state);

  if (topValue === null) {
    // Jacks cannot be played on an empty pile (their powers require a pile target)
    if (cards[0]!.rank === 'J') return false;
    return true;
  }

  const card = cards[0]!;
  const cardValue = getRankValue(card.rank);

  const isReset  = matchesPowerRank(card.rank, state.variant, 'reset');
  const isSkip   = matchesPowerRank(card.rank, state.variant, 'skip');
  const isBurn   = matchesPowerRank(card.rank, state.variant, 'burn');

  if (isRevolution) {
    // All powers disabled during revolution — play ≤ top value
    return cardValue <= topValue;
  }

  // Reset-rank cards are always playable regardless of pile value
  if (isReset) return true;

  // Skip-rank cards are always playable regardless of pile value (including over Under)
  if (isSkip) return true;

  // Reset active: any card is playable
  if (state.pileResetActive === true) return true;

  // Under active: must play ≤ Under value
  // (Burn is intentionally checked after this: if Burn value > Under, it cannot be played)
  if (state.activeUnder != null) {
    return cardValue <= state.activeUnder;
  }

  // Burn-rank cards bypass normal value ordering; Under restriction already handled above
  if (isBurn) return true;

  // Normal play: ≥ top value
  return cardValue >= topValue;
}

/**
 * Returns true when the player at `playerIndex` has at least one legal play
 * available given the current game state.
 *
 * Considers:
 * - The player's active zone (hand → faceUp → faceDown).
 * - For hand / faceUp / revealed faceDown: checks each non-Mirror card via
 *   `canPlayCards`. If any non-Mirror card is playable, Mirror combos are too.
 * - For unrevealed faceDown: checks each card (the engine knows the cards even
 *   though the player doesn't see them).
 *
 * Returns false when the player has no cards at all (isFinished).
 */
export function canPlayerPlayAnything(state: GameState, playerIndex: number): boolean {
  const player = state.players[playerIndex]!;
  const zone = getActiveZone(player);
  if (zone === null) return false;

  const zoneCards = getZoneCards(player, zone);

  // For unrevealed dark flop, the player plays one card blind. The engine
  // knows the cards, so we can check each one individually.
  if (zone === 'faceDown' && !player.faceDownRevealed) {
    return zoneCards.some((c) => canPlayCards([c], state));
  }

  // For hand / faceUp / revealed faceDown: check non-Mirror cards.
  // If a non-Mirror card is playable, a Mirror + that card combo is also valid.
  // Mirror alone is never playable, so we only check non-Mirror cards.
  const isMirrorCard = (c: Card) => matchesPowerRank(c.rank, state.variant, 'mirror');

  for (const c of zoneCards) {
    if (!isMirrorCard(c) && canPlayCards([c], state)) return true;
  }

  return false;
}
