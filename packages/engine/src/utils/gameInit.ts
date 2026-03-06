import type { BotDifficulty, Card, GameState, GameVariant, Player } from '../types';
import { createDeck, shuffleDeck } from './deck';
import { dealCards } from './deal';

/** Minimal information required to create a player slot in a new game. */
export interface PlayerSetup {
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

/**
 * Creates the initial GameState for a new game session.
 *
 * Steps performed:
 * 1. Build and shuffle a fresh deck (variant.deckCount × 52 cards).
 * 2. Deal 3 cards to each player's hand, faceUp (flop), and faceDown (dark flop).
 * 3. Return the complete initial state with phase = 'swapping' so players
 *    can exchange hand ↔ faceUp cards before the game proper begins.
 *
 * The first player is NOT determined here; that happens when all players
 * signal 'ready' and the phase transitions to 'playing'.
 *
 * @param gameId - Unique identifier for this game session (provided by the server).
 * @param playerSetups - Ordered list of players. Minimum 2, no hard maximum
 *   (the deck size implicitly caps player count via dealCards).
 * @param variant - The game variant configuration including deck count and power assignments.
 * @throws {Error} If fewer than 2 players are provided.
 * @throws {Error} If the deck doesn't have enough cards for all players.
 */
export function createInitialGameState(
  gameId: string,
  playerSetups: PlayerSetup[],
  variant: GameVariant,
): GameState {
  if (playerSetups.length < 2) {
    throw new Error(`At least 2 players are required, got ${playerSetups.length}`);
  }

  // Build and shuffle the deck
  const shuffledDeck = shuffleDeck(createDeck(variant.deckCount));

  // Create empty player shells
  const emptyPlayers: Player[] = playerSetups.map((setup): Player => {
    const player: Player = {
      id: setup.id,
      name: setup.name,
      hand: [] as Card[],
      faceUp: [] as Card[],
      faceDown: [] as Card[],
      isFinished: false,
      isBot: setup.isBot,
    };
    if (setup.botDifficulty !== undefined) {
      player.botDifficulty = setup.botDifficulty;
    }
    return player;
  });

  // Deal cards (respect variant hand / flop sizes)
  const { players, deck: remainingDeck } = dealCards(
    emptyPlayers,
    shuffledDeck,
    variant.minHandSize ?? 3,
    variant.flopSize ?? 3,
  );

  return {
    id: gameId,
    phase: 'swapping',
    players,
    deck: remainingDeck,
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: players.map((_, i) => i),
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    pendingCardsPlayed: undefined,
    pendingCemeteryTransit: false,
  };
}
