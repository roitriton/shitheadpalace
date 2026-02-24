import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, SUITS, RANKS } from './deck';
import type { Card } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function sortById(a: Card, b: Card): number {
  return a.id.localeCompare(b.id);
}

// ─── createDeck ───────────────────────────────────────────────────────────────

describe('createDeck', () => {
  it('creates exactly 52 cards by default (deckCount = 1)', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('creates 52 × deckCount cards', () => {
    expect(createDeck(1)).toHaveLength(52);
    expect(createDeck(2)).toHaveLength(104);
    expect(createDeck(3)).toHaveLength(156);
  });

  it('contains all 4 suits, each appearing 13 times per deck', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });

  it('contains all 13 ranks, each appearing 4 times per deck', () => {
    const deck = createDeck();
    for (const rank of RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
  });

  it('assigns a unique id to every card (single deck)', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(52);
  });

  it('assigns a unique id to every card (two decks)', () => {
    const deck = createDeck(2);
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(104);
  });

  it('gives every card a valid suit and rank', () => {
    for (const card of createDeck()) {
      expect(SUITS).toContain(card.suit);
      expect(RANKS).toContain(card.rank);
      expect(card.id).toBeTruthy();
    }
  });

  it('includes every rank×suit combination exactly once per deck', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const matches = deck.filter((c) => c.suit === suit && c.rank === rank);
        expect(matches).toHaveLength(1);
      }
    }
  });

  it('throws when deckCount is 0', () => {
    expect(() => createDeck(0)).toThrow();
  });

  it('throws when deckCount is negative', () => {
    expect(() => createDeck(-2)).toThrow();
  });
});

// ─── shuffleDeck ──────────────────────────────────────────────────────────────

describe('shuffleDeck', () => {
  it('returns an array of the same length', () => {
    const deck = createDeck();
    expect(shuffleDeck(deck)).toHaveLength(deck.length);
  });

  it('contains exactly the same cards as the original', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.slice().sort(sortById)).toEqual(deck.slice().sort(sortById));
  });

  it('does not mutate the input array', () => {
    const deck = createDeck();
    const snapshot = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(snapshot);
  });

  it('returns a new array reference', () => {
    const deck = createDeck();
    expect(shuffleDeck(deck)).not.toBe(deck);
  });

  it('handles an empty deck without error', () => {
    expect(shuffleDeck([])).toEqual([]);
  });

  it('handles a single-card deck', () => {
    const single = [createDeck()[0] as Card];
    expect(shuffleDeck(single)).toEqual(single);
  });

  it('produces a different order on average across many shuffles', () => {
    // Probability of ALL 52 shuffles being identical is astronomically small
    const deck = createDeck();
    const original = deck.map((c) => c.id).join(',');
    const differentCount = Array.from({ length: 20 }, () =>
      shuffleDeck(deck).map((c) => c.id).join(','),
    ).filter((order) => order !== original).length;
    // At least one shuffle should differ (probability of all same ≈ 0)
    expect(differentCount).toBeGreaterThan(0);
  });
});
