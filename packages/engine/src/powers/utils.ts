import type { Card, GameVariant, Power, Rank, Suit, UniquePowerType } from '../types';

/**
 * Returns true when `rank` matches the power assignment for `power` in the variant.
 *
 * The assignment may be a single Rank or an array of Ranks (multi-rank powers).
 * Returns false when the power has no assignment in the variant.
 */
export function matchesPowerRank(rank: Rank, variant: GameVariant, power: Power): boolean {
  const assignment = variant.powerAssignments[power];
  if (!assignment) return false;
  if (Array.isArray(assignment)) return assignment.includes(rank);
  return rank === assignment;
}

// ─── Unique power helpers ────────────────────────────────────────────────────

/** Default suit→unique-power mapping (used when uniquePowerAssignments is absent). */
export const DEFAULT_UNIQUE_POWER_SUITS: Record<Suit, UniquePowerType> = {
  diamonds: 'revolution',
  spades: 'manouche',
  hearts: 'flopReverse',
  clubs: 'shifumi',
};

/**
 * Returns true when the card triggers the given unique power type according to
 * the variant's uniquePowerAssignments (or the hardcoded J defaults when absent).
 */
export function isUniquePowerCard(card: Card, variant: GameVariant, power: UniquePowerType): boolean {
  const assignments = variant.uniquePowerAssignments;
  if (!assignments) {
    return card.rank === 'J' && DEFAULT_UNIQUE_POWER_SUITS[card.suit] === power;
  }
  const rankAssignments = assignments[card.rank];
  return rankAssignments !== undefined && rankAssignments[card.suit] === power;
}

/**
 * Returns true when the card has any unique power assignment (i.e. is a "jack-like" card).
 */
export function hasAnyUniquePower(card: Card, variant: GameVariant): boolean {
  const assignments = variant.uniquePowerAssignments;
  if (!assignments) return card.rank === 'J';
  return assignments[card.rank] !== undefined;
}

/**
 * Returns the unique power type for a card, or null if the card has no unique power.
 */
export function getUniquePowerForCard(card: Card, variant: GameVariant): UniquePowerType | null {
  const assignments = variant.uniquePowerAssignments;
  if (!assignments) {
    if (card.rank !== 'J') return null;
    return DEFAULT_UNIQUE_POWER_SUITS[card.suit];
  }
  const rankAssignments = assignments[card.rank];
  if (!rankAssignments) return null;
  return rankAssignments[card.suit];
}
