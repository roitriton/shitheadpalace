import type { Card, Player } from '../types';

/** Number of cards dealt to each zone (hand, faceUp, faceDown) per player. */
export const CARDS_PER_ZONE = 3;

/**
 * Deals cards from a deck to all players.
 *
 * Each player receives exactly CARDS_PER_ZONE (3) cards to their hand,
 * CARDS_PER_ZONE to faceUp (flop), and CARDS_PER_ZONE to faceDown (dark flop).
 * Cards are dealt player-by-player: all three zones filled before moving to
 * the next player.
 *
 * Pure function — neither the players array nor the deck array is mutated.
 *
 * @param players - The players to deal to. Existing hand/faceUp/faceDown are replaced.
 * @param deck - The shuffled draw pile to deal from (top = index 0).
 * @returns Updated players with cards assigned, and the remaining draw pile.
 * @throws {Error} If the deck contains fewer cards than required.
 */
export function dealCards(
  players: Player[],
  deck: Card[],
): { players: Player[]; deck: Card[] } {
  const cardsNeeded = players.length * CARDS_PER_ZONE * 3;

  if (deck.length < cardsNeeded) {
    throw new Error(
      `Not enough cards to deal: need ${cardsNeeded} for ${players.length} players, got ${deck.length}`,
    );
  }

  const remaining = [...deck];

  const dealt: Player[] = players.map((player) => ({
    ...player,
    hand: remaining.splice(0, CARDS_PER_ZONE),
    faceUp: remaining.splice(0, CARDS_PER_ZONE),
    faceDown: remaining.splice(0, CARDS_PER_ZONE),
  }));

  return { players: dealt, deck: remaining };
}
