import type { GameVariant, Power, Rank } from '../types';

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
