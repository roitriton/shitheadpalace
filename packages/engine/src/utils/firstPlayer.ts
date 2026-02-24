import type { Player } from '../types';
import { RANK_VALUES } from './ranks';

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
 * Determines which player goes first at game start based on the cards in hand.
 *
 * Rules (from CLAUDE.md):
 * 1. The player holding the globally lowest-ranked card goes first.
 * 2. Tie on rank → the player holding the most copies of that rank wins.
 * 3. Still tied → shifumi between all remaining tied players.
 *
 * @param players - All players with non-empty hands (after dealing).
 * @returns Either a single winner or a list of tied players for shifumi.
 * @throws {Error} If the players array is empty or all hands are empty.
 */
export function findFirstPlayer(players: Player[]): FirstPlayerResult {
  if (players.length === 0) {
    throw new Error('findFirstPlayer requires at least one player');
  }

  // Step 1 — find the globally lowest rank value across all hands
  let minValue = Infinity;

  for (const player of players) {
    for (const card of player.hand) {
      const v = RANK_VALUES[card.rank];
      if (v < minValue) minValue = v;
    }
  }

  if (!isFinite(minValue)) {
    throw new Error('Cannot determine first player: all hands are empty');
  }

  // Step 2 — for each player, count how many cards of that minimum rank they hold
  const counts = players.map((player) => ({
    playerId: player.id,
    count: player.hand.filter((c) => RANK_VALUES[c.rank] === minValue).length,
  }));

  // Step 3 — winner(s) = those with the highest count of the minimum rank
  const maxCount = Math.max(...counts.map((c) => c.count));
  const winners = counts.filter((c) => c.count === maxCount);

  if (winners.length === 1) {
    return { type: 'single', playerId: (winners[0] as (typeof winners)[0]).playerId };
  }

  return { type: 'shifumi', playerIds: winners.map((w) => w.playerId) };
}
