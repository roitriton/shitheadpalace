import type { Card, Player } from '../types';

/** Default number of cards dealt to each zone (hand, faceUp, faceDown) per player. */
export const CARDS_PER_ZONE = 3;

/**
 * Deals cards from a deck to all players.
 *
 * Each player receives `handSize` cards to their hand, `flopSize` cards to
 * faceUp (flop), and `flopSize` cards to faceDown (dark flop).
 * Cards are dealt player-by-player: all three zones filled before moving to
 * the next player.
 *
 * Pure function — neither the players array nor the deck array is mutated.
 *
 * @param players  - The players to deal to. Existing hand/faceUp/faceDown are replaced.
 * @param deck     - The shuffled draw pile to deal from (top = index 0).
 * @param handSize - Number of cards to deal to each player's hand (default 3).
 * @param flopSize - Number of cards to deal to each player's faceUp AND faceDown (default 3).
 * @returns Updated players with cards assigned, and the remaining draw pile.
 * @throws {Error} If the deck contains fewer cards than required.
 */
export function dealCards(
  players: Player[],
  deck: Card[],
  handSize: number = CARDS_PER_ZONE,
  flopSize: number = CARDS_PER_ZONE,
): { players: Player[]; deck: Card[] } {
  const cardsPerPlayer = handSize + flopSize * 2;
  const cardsNeeded = players.length * cardsPerPlayer;

  if (deck.length < cardsNeeded) {
    throw new Error(
      `Not enough cards to deal: need ${cardsNeeded} for ${players.length} players, got ${deck.length}`,
    );
  }

  const remaining = [...deck];

  const dealt: Player[] = players.map((player) => ({
    ...player,
    hand: remaining.splice(0, handSize),
    faceUp: remaining.splice(0, flopSize),
    faceDown: remaining.splice(0, flopSize),
  }));

  return { players: dealt, deck: remaining };
}
