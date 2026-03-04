import type { Card, GamePhase, GameState, GameVariant, PileEntry, Rank } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank } from './utils';

// ─── 4-identical detection ────────────────────────────────────────────────────

/**
 * Counts how many consecutive cards of effective `rank` sit on top of the pile,
 * scanning backwards through PileEntry records.
 *
 * Uses the entry's `effectiveRank` (set by Mirror resolution) when available,
 * otherwise falls back to the first card's physical rank. This correctly
 * counts Mirror plays as their accompanied value (e.g. a 6+6+9+9 entry with
 * effectiveRank '6' contributes 4 cards to a '6' streak).
 */
function countConsecutiveTopEffectiveRank(pile: PileEntry[], rank: Rank): number {
  let count = 0;
  for (let i = pile.length - 1; i >= 0; i--) {
    const entry = pile[i]!;
    const entryRank = entry.effectiveRank ?? entry.cards[0]!.rank;
    if (entryRank === rank) {
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
 *   (b) 4 or more same-value cards are played in a single move (quad burn).
 *       `effectiveCount` includes Mirror cards counted as the accompanied rank.
 *   (c) 4 or more cards of the same rank now sit consecutively on top of the pile
 *       (the "4-identical" rule — accumulated across multiple moves).
 *
 * @param playedCards    - Cards just placed on the pile (single-rank set, mirrors filtered out).
 * @param pile           - The full pile AFTER the current play has been appended.
 * @param variant        - Game variant (for power-rank lookups).
 * @param phase          - Current game phase.
 * @param effectiveCount - Total same-value cards in this play (mirrors counted).
 *                         Defaults to `playedCards.length`.
 */
export function isBurnTriggered(
  playedCards: Card[],
  pile: PileEntry[],
  variant: GameVariant,
  phase: GamePhase,
  effectiveCount?: number,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (playedCards.length === 0) return false;

  const rank = playedCards[0]!.rank;

  // (a) Burn by rank
  if (matchesPowerRank(rank, variant, 'burn')) return true;

  // (b) Burn by 4+ same-value cards played in one move (quad burn)
  const count = effectiveCount ?? playedCards.length;
  if (count >= 4) return true;

  // (c) Burn by 4+ identical accumulated on pile (universal rule, mirrors resolved)
  return countConsecutiveTopEffectiveRank(pile, rank) >= 4;
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
  }, 'power');
  newState = appendLog(newState, 'burnEffect', timestamp, playerId, player.name, {
    message: `${player.name} brûle la pile`,
  }, 'effect');

  return newState;
}
