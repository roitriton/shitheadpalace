import type { Card, Rank } from '../types';

/**
 * Numeric value assigned to each rank for comparison.
 * 2 is the lowest face value (2) and Ace is the highest (14).
 * These values are used for play validation, first-player determination,
 * and bot strategy — independently of any special powers.
 */
export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/**
 * Returns the numeric value (2–14) associated with a rank.
 *
 * @param rank - The card rank to evaluate.
 */
export function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

/**
 * Compares two ranks numerically.
 * Returns a negative number if a < b, 0 if equal, a positive number if a > b.
 *
 * @param a - First rank.
 * @param b - Second rank.
 */
export function compareRanks(a: Rank, b: Rank): number {
  return RANK_VALUES[a] - RANK_VALUES[b];
}

/**
 * Returns the rank with the lowest numeric value among the given cards.
 * Returns null when the array is empty.
 *
 * @param cards - Array of cards to inspect.
 */
export function getMinRank(cards: Card[]): Rank | null {
  let minRank: Rank | undefined;
  let minValue = Infinity;

  for (const card of cards) {
    const value = RANK_VALUES[card.rank];
    if (value < minValue) {
      minValue = value;
      minRank = card.rank;
    }
  }

  return minRank ?? null;
}
