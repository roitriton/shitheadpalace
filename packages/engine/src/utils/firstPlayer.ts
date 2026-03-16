import type { Player, Rank } from '../types';

/** Returned when a single player is clearly determined as the first to play. */
export interface SingleFirstPlayer {
  type: 'single';
  playerId: string;
}

/** Returned when multiple players are tied and must resolve via shifumi. */
export interface ShifumiTiebreak {
  type: 'shifumi';
  playerIds: string[];
}

export type FirstPlayerResult = SingleFirstPlayer | ShifumiTiebreak;

/**
 * Game-strength score for first-player tiebreak.
 * Lower score = weaker card = player goes first.
 *
 * Strength order (weakest to strongest):
 *   3 < 4 < 5 < 6 < 8 < J < Q < K < {2, 7, 9, 10, A}
 *
 * Power cards (2=Reset, 7=Skip, 9=Mirror, 10=Burn, A=Target) are all
 * equal at the highest tier because they bypass normal pile ordering.
 */
const RANK_STRENGTH: Record<Rank, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '8': 5,
  J: 6,
  Q: 7,
  K: 8,
  // Power cards — all equal, strongest
  '2': 9,
  '7': 9,
  '9': 9,
  '10': 9,
  A: 9,
};

/**
 * Determines which player goes first at game start based on the cards in hand.
 *
 * Algorithm:
 * 1. Assign a strength score to each rank (see RANK_STRENGTH).
 * 2. Sort each player's hand by strength ascending.
 * 3. Compare card-by-card: the player with the first strictly weaker card
 *    at any position starts.
 * 4. If all strength scores are identical → shifumi between tied players.
 *
 * @param players - All players with non-empty hands (after dealing).
 * @returns Either a single winner or a list of tied players for shifumi.
 * @throws {Error} If the players array is empty or all hands are empty.
 */
export function findFirstPlayer(players: Player[]): FirstPlayerResult {
  if (players.length === 0) {
    throw new Error('findFirstPlayer requires at least one player');
  }

  if (players.every((p) => p.hand.length === 0)) {
    throw new Error('Cannot determine first player: all hands are empty');
  }

  // Sort each player's hand strengths ascending
  const sorted = players.map((p) => ({
    playerId: p.id,
    strengths: p.hand.map((c) => RANK_STRENGTH[c.rank]).sort((a, b) => a - b),
  }));

  const maxLen = Math.max(...sorted.map((s) => s.strengths.length));

  // Card-by-card elimination: at each position, keep only candidates
  // whose strength equals the minimum at that position.
  let candidates = sorted;

  for (let i = 0; i < maxLen; i++) {
    const minStrength = Math.min(
      ...candidates.map((c) => c.strengths[i] ?? Infinity),
    );
    const remaining = candidates.filter(
      (c) => (c.strengths[i] ?? Infinity) === minStrength,
    );
    if (remaining.length === 1) {
      return { type: 'single', playerId: remaining[0]!.playerId };
    }
    candidates = remaining;
  }

  // All remaining candidates are perfectly tied
  if (candidates.length === 1) {
    return { type: 'single', playerId: candidates[0]!.playerId };
  }

  return { type: 'shifumi', playerIds: candidates.map((c) => c.playerId) };
}
