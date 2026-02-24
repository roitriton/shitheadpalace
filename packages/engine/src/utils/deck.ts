import type { Card, Rank, Suit } from '../types';

/** The four suits in a standard deck. */
export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

/** All 13 ranks ordered from lowest (2) to highest (A) face value. */
export const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

/**
 * Creates one or more standard 52-card decks.
 * Each card receives a unique id formatted as `{rank}-{suit}-{deckIndex}`.
 *
 * @param deckCount - Number of 52-card decks to include. Must be ≥ 1. Default: 1.
 * @throws {Error} If deckCount is less than 1.
 */
export function createDeck(deckCount = 1): Card[] {
  if (deckCount < 1) {
    throw new Error(`deckCount must be at least 1, got ${deckCount}`);
  }

  const cards: Card[] = [];

  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}-${suit}-${d}`, suit, rank });
      }
    }
  }

  return cards;
}

/**
 * Returns a new shuffled copy of the deck using the Fisher-Yates algorithm.
 * Pure function — the original array is never mutated.
 *
 * Note: this is the only non-deterministic function in the engine
 * (same inputs may produce different outputs due to Math.random()).
 *
 * @param deck - The deck to shuffle.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i] as Card;
    const b = shuffled[j] as Card;
    shuffled[i] = b;
    shuffled[j] = a;
  }

  return shuffled;
}
