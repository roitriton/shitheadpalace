import type { Card, GameState, Rank } from '@shit-head-palace/engine';
import { getRankValue, getTopPileValue, canPlayCards, matchesPowerRank, hasAnyUniquePower } from '@shit-head-palace/engine';

/** French display names for each card rank. */
const RANK_FRENCH: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10',
  J: 'Valet', Q: 'Dame', K: 'Roi', A: 'As',
};

/** Reverse map from numeric rank value (2–14) to Rank. */
const VALUE_TO_RANK: Record<number, Rank> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

function rankToFrench(rank: Rank): string {
  return RANK_FRENCH[rank];
}

function valueToFrench(value: number): string {
  const rank = VALUE_TO_RANK[value];
  return rank ? rankToFrench(rank) : String(value);
}

/** Returns the rank displayed on top of the pile (effective or physical). */
function getTopPileRank(state: GameState): Rank | null {
  if (state.pile.length === 0) return null;
  const lastEntry = state.pile[state.pile.length - 1]!;
  return (lastEntry.effectiveRank ?? lastEntry.cards[0]!.rank) as Rank;
}

/**
 * Returns an explanatory message when the selected cards form an illegal play,
 * or null when the selection is empty or legal.
 *
 * Detection order:
 * 1. Mirrors alone → cas 4
 * 2. Jack on empty pile → cas 5
 * 3. Under active + value too high → cas 3
 * 4. Revolution active + value too high → cas 2
 * 5. Value too low (normal) → cas 1
 */
export function getIllegalPlayReason(
  selectedCards: Card[],
  gameState: GameState,
  _playerId: string,
): string | null {
  if (selectedCards.length === 0) return null;

  // Separate mirrors from non-mirrors
  const isMirror = (c: Card) => matchesPowerRank(c.rank, gameState.variant, 'mirror');
  const nonMirrorCards = selectedCards.filter((c) => !isMirror(c));
  const mirrorCount = selectedCards.length - nonMirrorCards.length;

  // Cas 4 — Mirror joué seul
  if (nonMirrorCards.length === 0) {
    return "Il faut jouer Mirror en accompagnement d'une autre valeur";
  }

  // Cas 5 — Pouvoir unique sur pile vide
  if (hasAnyUniquePower(nonMirrorCards[0]!, gameState.variant) && gameState.pile.length === 0) {
    return 'Cette carte ne se joue pas dans une pile vide. Jamais à sec';
  }

  // Check if the play is actually legal before diagnosing
  const effectiveCount = nonMirrorCards.length + mirrorCount;
  if (canPlayCards(nonMirrorCards, gameState, effectiveCount)) return null;

  const cardValue = getRankValue(nonMirrorCards[0]!.rank);

  // Cas 3 — Under actif et valeur trop haute
  if (gameState.activeUnder != null && cardValue > gameState.activeUnder) {
    return `Il faut jouer ≤ ${valueToFrench(gameState.activeUnder)} (under)`;
  }

  // Cas 2 — Révolution active et valeur trop haute
  const isRevolution = gameState.phase === 'revolution' || gameState.phase === 'superRevolution';
  if (isRevolution) {
    const topPileRank = getTopPileRank(gameState);
    if (topPileRank) {
      return `Il faut jouer ≤ ${rankToFrench(topPileRank)} (révolution)`;
    }
  }

  // Cas 1 — Valeur trop basse (jeu normal)
  const topPileRank = getTopPileRank(gameState);
  if (topPileRank) {
    return `Il faut jouer ≥ ${rankToFrench(topPileRank)}`;
  }

  return null;
}
