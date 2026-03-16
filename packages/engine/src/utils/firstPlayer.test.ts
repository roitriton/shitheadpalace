import { describe, it, expect } from 'vitest';
import { findFirstPlayer } from './firstPlayer';
import type { Card, Player, Rank, Suit } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function card(rank: Rank, suit: Suit = 'hearts', index = 0): Card {
  return { id: `${rank}-${suit}-${index}`, suit, rank };
}

function makePlayer(id: string, hand: Card[]): Player {
  return { id, name: id, hand, faceUp: [], faceDown: [], isFinished: false, isBot: false };
}

// ─── findFirstPlayer ──────────────────────────────────────────────────────────

describe('findFirstPlayer', () => {
  it('throws when the players array is empty', () => {
    expect(() => findFirstPlayer([])).toThrow();
  });

  it('throws when all player hands are empty', () => {
    expect(() =>
      findFirstPlayer([makePlayer('p1', []), makePlayer('p2', [])]),
    ).toThrow('empty');
  });

  // ── Strength-based comparison ───────────────────────────────────────────────

  it('[3,4,5] vs [3,8,A] → player with [3,4,5] starts (4 < 8 in strength)', () => {
    const p1 = makePlayer('p1', [card('3'), card('4'), card('5')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('8'), card('A')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p1' });
  });

  it('[2,5,K] vs [3,4,5] → player with [3,4,5] starts (3 is weakest, 2 is power)', () => {
    const p1 = makePlayer('p1', [card('2'), card('5'), card('K')]);
    const p2 = makePlayer('p2', [card('3'), card('4'), card('5', 'spades')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('[3,5,K] vs [3,5,K] → tie → shifumi', () => {
    const p1 = makePlayer('p1', [card('3'), card('5'), card('K')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('5', 'spades'), card('K', 'spades')]);
    const result = findFirstPlayer([p1, p2]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toHaveLength(2);
      expect(result.playerIds).toContain('p1');
      expect(result.playerIds).toContain('p2');
    }
  });

  it('[3,4,A] vs [3,4,7] → tie (A and 7 are both power rank = strength 9)', () => {
    const p1 = makePlayer('p1', [card('3'), card('4'), card('A')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('4', 'spades'), card('7')]);
    const result = findFirstPlayer([p1, p2]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toHaveLength(2);
    }
  });

  it('3+ players: the player with the globally weakest hand wins', () => {
    // p1: [4,Q,K] strengths [2,7,8], p2: [3,J,A] strengths [1,6,9], p3: [5,8,K] strengths [3,5,8]
    // position 0: min=1 → p2 wins
    const p1 = makePlayer('p1', [card('4'), card('Q'), card('K')]);
    const p2 = makePlayer('p2', [card('3'), card('J', 'spades'), card('A')]);
    const p3 = makePlayer('p3', [card('5'), card('8'), card('K', 'spades')]);
    expect(findFirstPlayer([p1, p2, p3])).toEqual({ type: 'single', playerId: 'p2' });
  });

  // ── Power cards are the strongest ─────────────────────────────────────────

  it('3 is the weakest card (not 2)', () => {
    // [3,3,3] strengths [1,1,1] vs [2,A,K] strengths [8,9,9] → p1 starts
    const p1 = makePlayer('p1', [card('3'), card('3', 'spades'), card('3', 'clubs')]);
    const p2 = makePlayer('p2', [card('2'), card('A'), card('K')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p1' });
  });

  it('Ace is not weak — it is a power card (strength 9)', () => {
    // [A,K,Q] strengths [7,8,9] vs [3,4,5] strengths [1,2,3] → p2 starts
    const p1 = makePlayer('p1', [card('A'), card('K'), card('Q')]);
    const p2 = makePlayer('p2', [card('3'), card('4'), card('5')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('all power cards (2,7,10,A,9) are equal strength', () => {
    const p1 = makePlayer('p1', [card('2'), card('10'), card('A')]);
    const p2 = makePlayer('p2', [card('7'), card('9'), card('A', 'spades')]);
    const result = findFirstPlayer([p1, p2]);
    expect(result.type).toBe('shifumi');
  });

  // ── Card-by-card tiebreak ─────────────────────────────────────────────────

  it('tiebreak goes card-by-card: same first card, different second', () => {
    // [3,4,K] strengths [1,2,8] vs [3,6,8] strengths [1,4,5] → position 1: 2 < 4, p1 wins
    const p1 = makePlayer('p1', [card('3'), card('4'), card('K')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('6'), card('8')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p1' });
  });

  it('tiebreak resolves at third card when first two are equal', () => {
    // [3,4,6] strengths [1,2,4] vs [3,4,8] strengths [1,2,5] → position 2: 4 < 5, p1 wins
    const p1 = makePlayer('p1', [card('3'), card('4'), card('6')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('4', 'spades'), card('8')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p1' });
  });

  // ── 3+ player elimination ─────────────────────────────────────────────────

  it('3 players: eliminates non-contenders round by round', () => {
    // p1: [3,J,K] strengths [1,6,8]
    // p2: [3,4,A] strengths [1,2,9]
    // p3: [4,5,6] strengths [2,3,4]
    // position 0: min=1 → p3 eliminated. p1 and p2 remain.
    // position 1: 2 < 6 → p2 wins.
    const p1 = makePlayer('p1', [card('3'), card('J', 'spades'), card('K')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('4'), card('A')]);
    const p3 = makePlayer('p3', [card('4', 'diamonds'), card('5'), card('6')]);
    expect(findFirstPlayer([p1, p2, p3])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('3-way tie → shifumi with all three', () => {
    const p1 = makePlayer('p1', [card('3'), card('5'), card('K')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('5', 'spades'), card('K', 'spades')]);
    const p3 = makePlayer('p3', [card('3', 'diamonds'), card('5', 'diamonds'), card('K', 'diamonds')]);
    const result = findFirstPlayer([p1, p2, p3]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toHaveLength(3);
    }
  });

  // ── single player ─────────────────────────────────────────────────────────

  it('works with a single player (returns that player)', () => {
    const p1 = makePlayer('p1', [card('5'), card('7'), card('A')]);
    expect(findFirstPlayer([p1])).toEqual({ type: 'single', playerId: 'p1' });
  });
});
