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

  // ── Rule 1: lowest card wins ───────────────────────────────────────────────

  it('returns single when one player has the clearly lowest card', () => {
    const p1 = makePlayer('p1', [card('A'), card('K'), card('Q')]);
    const p2 = makePlayer('p2', [card('2'), card('K'), card('J')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('2 beats 3 (2 is the absolute minimum)', () => {
    const p1 = makePlayer('p1', [card('3'), card('3', 'spades'), card('3', 'clubs')]);
    const p2 = makePlayer('p2', [card('2'), card('A'), card('K')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('handles three players: the one with the lowest card wins', () => {
    const p1 = makePlayer('p1', [card('5'), card('A'), card('K')]);
    const p2 = makePlayer('p2', [card('3'), card('Q'), card('J')]);
    const p3 = makePlayer('p3', [card('4'), card('K'), card('Q')]);
    expect(findFirstPlayer([p1, p2, p3])).toEqual({ type: 'single', playerId: 'p2' });
  });

  // ── Rule 2: most copies of minimum rank wins ───────────────────────────────

  it('returns the player with more copies of the tied minimum rank', () => {
    // p1: one 2 ; p2: two 2s  → p2 wins
    const p1 = makePlayer('p1', [card('2', 'hearts'), card('A'), card('K')]);
    const p2 = makePlayer('p2', [
      card('2', 'hearts', 1),
      card('2', 'diamonds'),
      card('J'),
    ]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('favours the player with 3 copies over the one with 2', () => {
    const p1 = makePlayer('p1', [card('2', 'hearts'), card('2', 'spades'), card('9')]);
    const p2 = makePlayer('p2', [
      card('2', 'hearts', 1),
      card('2', 'diamonds'),
      card('2', 'clubs'),
    ]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p2' });
  });

  it('player with all copies of the minimum rank beats others without it', () => {
    const p1 = makePlayer('p1', [card('2', 'hearts'), card('2', 'spades'), card('2', 'clubs')]);
    const p2 = makePlayer('p2', [card('3'), card('4'), card('5')]);
    expect(findFirstPlayer([p1, p2])).toEqual({ type: 'single', playerId: 'p1' });
  });

  // ── Rule 3: still tied → shifumi ──────────────────────────────────────────

  it('returns shifumi when two players each have one of the minimum rank', () => {
    const p1 = makePlayer('p1', [card('2', 'hearts'), card('A'), card('K')]);
    const p2 = makePlayer('p2', [card('2', 'spades'), card('Q'), card('J')]);
    const result = findFirstPlayer([p1, p2]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toHaveLength(2);
      expect(result.playerIds).toContain('p1');
      expect(result.playerIds).toContain('p2');
    }
  });

  it('returns shifumi with all three when a three-way tie occurs', () => {
    const p1 = makePlayer('p1', [card('3', 'hearts'), card('A'), card('K')]);
    const p2 = makePlayer('p2', [card('3', 'spades'), card('Q'), card('J')]);
    const p3 = makePlayer('p3', [card('3', 'diamonds'), card('K'), card('Q')]);
    const result = findFirstPlayer([p1, p2, p3]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toHaveLength(3);
    }
  });

  it('only includes the tied players in shifumi, not others with higher minimums', () => {
    // p1 and p2 tie on '2'; p3 has no 2 (min is 4) → only p1 and p2 in shifumi
    const p1 = makePlayer('p1', [card('2', 'hearts'), card('A'), card('K')]);
    const p2 = makePlayer('p2', [card('2', 'spades'), card('Q'), card('J')]);
    const p3 = makePlayer('p3', [card('4'), card('5'), card('6')]);
    const result = findFirstPlayer([p1, p2, p3]);
    expect(result.type).toBe('shifumi');
    if (result.type === 'shifumi') {
      expect(result.playerIds).toContain('p1');
      expect(result.playerIds).toContain('p2');
      expect(result.playerIds).not.toContain('p3');
    }
  });

  // ── single player ─────────────────────────────────────────────────────────

  it('works with a single player (returns that player)', () => {
    const p1 = makePlayer('p1', [card('5'), card('7'), card('A')]);
    expect(findFirstPlayer([p1])).toEqual({ type: 'single', playerId: 'p1' });
  });
});
