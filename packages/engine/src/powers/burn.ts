import type { Card, GamePhase, GameState, GameVariant, PileEntry, Rank } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── 4-identical detection ────────────────────────────────────────────────────

/**
 * Counts how many consecutive cards of `rank` sit on top of the pile,
 * scanning backwards through PileEntry records.
 *
 * An entry is part of the streak only when ALL its cards share `rank`.
 * An entry with mixed ranks (e.g. a Mirror play) breaks the streak.
 */
function countConsecutiveTopRank(pile: PileEntry[], rank: Rank): number {
  let count = 0;
  for (let i = pile.length - 1; i >= 0; i--) {
    const entry = pile[i]!;
    if (entry.cards.every((c) => c.rank === rank)) {
      count += entry.cards.length;
    } else {
      break;
    }
  }
  return count;
}

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` on `pile` should trigger a Burn.
 *
 * Burn triggers when (and only when NOT in revolution / superRevolution):
 *   (a) The played rank matches the Burn power assignment in the variant, OR
 *   (b) 4 or more cards of the same rank now sit consecutively on top of the pile
 *       (the "4-identical" rule — active regardless of Burn rank assignment).
 *
 * @param playedCards - Cards just placed on the pile (single-rank set).
 * @param pile        - The full pile AFTER the current play has been appended.
 * @param variant     - Game variant (for power-rank lookups).
 * @param phase       - Current game phase.
 */
export function isBurnTriggered(
  playedCards: Card[],
  pile: PileEntry[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (playedCards.length === 0) return false;

  const rank = playedCards[0]!.rank;

  // (a) Burn by rank
  if (matchesPowerRank(rank, variant, 'burn')) return true;

  // (b) Burn by 4 identical (universal rule)
  return countConsecutiveTopRank(pile, rank) >= 4;
}

// ─── Effect ───────────────────────────────────────────────────────────────────

/**
 * Applies the Burn effect: moves all cards from the pile to the graveyard.
 *
 * Does NOT advance the turn — the player who triggered Burn replays.
 * The caller is responsible for checking whether the player has finished
 * (no cards left) before allowing the replay.
 *
 * @param state     - Current game state (pile already contains the triggering play).
 * @param playerId  - ID of the player who triggered Burn.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function applyBurn(state: GameState, playerId: string, timestamp: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const burned = state.pile.flatMap((e) => e.cards);

  let newState: GameState = {
    ...state,
    pile: [],
    graveyard: [...state.graveyard, ...burned],
  };

  newState = appendLog(newState, 'burn', timestamp, playerId, player.name, {
    burnedCount: burned.length,
  });

  return newState;
}
