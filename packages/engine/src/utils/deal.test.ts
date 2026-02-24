import { describe, it, expect } from 'vitest';
import { dealCards, CARDS_PER_ZONE } from './deal';
import { createDeck } from './deck';
import type { Player } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i + 1}`,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    isBot: false,
  }));
}

// ─── CARDS_PER_ZONE ───────────────────────────────────────────────────────────

describe('CARDS_PER_ZONE', () => {
  it('equals 3', () => {
    expect(CARDS_PER_ZONE).toBe(3);
  });
});

// ─── dealCards ────────────────────────────────────────────────────────────────

describe('dealCards', () => {
  it('deals exactly 3 cards to each zone for every player', () => {
    const { players } = dealCards(makePlayers(4), createDeck());
    for (const p of players) {
      expect(p.hand).toHaveLength(CARDS_PER_ZONE);
      expect(p.faceUp).toHaveLength(CARDS_PER_ZONE);
      expect(p.faceDown).toHaveLength(CARDS_PER_ZONE);
    }
  });

  it('leaves the correct number of cards in the remaining deck (4 players, 1 deck)', () => {
    const players = makePlayers(4);
    const deck = createDeck();
    const { deck: remaining } = dealCards(players, deck);
    expect(remaining).toHaveLength(52 - 4 * 9);
  });

  it('leaves the correct number of cards for 2 players', () => {
    const { deck: remaining } = dealCards(makePlayers(2), createDeck());
    expect(remaining).toHaveLength(52 - 2 * 9);
  });

  it('leaves the correct number of cards for 5 players', () => {
    const { deck: remaining } = dealCards(makePlayers(5), createDeck());
    expect(remaining).toHaveLength(52 - 5 * 9);
  });

  it('leaves the correct number of cards for 6 players with 2 decks', () => {
    const { deck: remaining } = dealCards(makePlayers(6), createDeck(2));
    expect(remaining).toHaveLength(104 - 6 * 9);
  });

  it('distributes every card exactly once — no duplicates, no losses (4 players)', () => {
    const deck = createDeck();
    const { players, deck: remaining } = dealCards(makePlayers(4), deck);
    const allCards = [
      ...remaining,
      ...players.flatMap((p) => [...p.hand, ...p.faceUp, ...p.faceDown]),
    ];
    const ids = allCards.map((c) => c.id);
    expect(ids).toHaveLength(52);
    expect(new Set(ids).size).toBe(52);
  });

  it('distributes every card exactly once across 2 decks (6 players)', () => {
    const deck = createDeck(2);
    const { players, deck: remaining } = dealCards(makePlayers(6), deck);
    const allCards = [
      ...remaining,
      ...players.flatMap((p) => [...p.hand, ...p.faceUp, ...p.faceDown]),
    ];
    expect(allCards).toHaveLength(104);
    expect(new Set(allCards.map((c) => c.id)).size).toBe(104);
  });

  it('does not mutate the input players array', () => {
    const players = makePlayers(3);
    const originalHands = players.map((p) => [...p.hand]);
    dealCards(players, createDeck());
    players.forEach((p, i) => expect(p.hand).toEqual(originalHands[i]));
  });

  it('does not mutate the input deck array', () => {
    const deck = createDeck();
    const originalLength = deck.length;
    dealCards(makePlayers(3), deck);
    expect(deck).toHaveLength(originalLength);
  });

  it('preserves player metadata unchanged', () => {
    const players = makePlayers(2);
    const { players: dealt } = dealCards(players, createDeck());
    dealt.forEach((p, i) => {
      expect(p.id).toBe(`player-${i}`);
      expect(p.name).toBe(`Player ${i + 1}`);
      expect(p.isBot).toBe(false);
      expect(p.isFinished).toBe(false);
    });
  });

  it('throws when the deck has fewer cards than required', () => {
    // 6 players × 9 cards = 54 needed; 52-card deck is insufficient
    expect(() => dealCards(makePlayers(6), createDeck(1))).toThrow();
  });

  it('error message mentions the shortfall', () => {
    try {
      dealCards(makePlayers(6), createDeck(1));
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/6/);
    }
  });

  it('works correctly with exactly zero cards remaining', () => {
    // 5 players × 9 cards = 45 cards; a deck of 45 leaves 0 remaining
    const exactDeck = createDeck().slice(0, 45);
    const { players, deck: remaining } = dealCards(makePlayers(5), exactDeck);
    expect(remaining).toHaveLength(0);
    for (const p of players) {
      expect(p.hand).toHaveLength(3);
      expect(p.faceUp).toHaveLength(3);
      expect(p.faceDown).toHaveLength(3);
    }
  });
});
