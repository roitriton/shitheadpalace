import { describe, it, expect } from 'vitest';
import { RANK_VALUES, getRankValue, compareRanks, getMinRank } from './ranks';
import { RANKS } from './deck';
import type { Card, Rank } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeCard(rank: Rank, index = 0): Card {
  return { id: `${rank}-hearts-${index}`, suit: 'hearts', rank };
}

// ─── RANK_VALUES ──────────────────────────────────────────────────────────────

describe('RANK_VALUES', () => {
  it('covers all 13 ranks', () => {
    expect(Object.keys(RANK_VALUES)).toHaveLength(13);
  });

  it('assigns the correct numeric value to each rank', () => {
    expect(RANK_VALUES['2']).toBe(2);
    expect(RANK_VALUES['3']).toBe(3);
    expect(RANK_VALUES['4']).toBe(4);
    expect(RANK_VALUES['5']).toBe(5);
    expect(RANK_VALUES['6']).toBe(6);
    expect(RANK_VALUES['7']).toBe(7);
    expect(RANK_VALUES['8']).toBe(8);
    expect(RANK_VALUES['9']).toBe(9);
    expect(RANK_VALUES['10']).toBe(10);
    expect(RANK_VALUES['J']).toBe(11);
    expect(RANK_VALUES['Q']).toBe(12);
    expect(RANK_VALUES['K']).toBe(13);
    expect(RANK_VALUES['A']).toBe(14);
  });

  it('all values are unique integers between 2 and 14', () => {
    const values = Object.values(RANK_VALUES);
    expect(new Set(values).size).toBe(13);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(14);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

// ─── getRankValue ─────────────────────────────────────────────────────────────

describe('getRankValue', () => {
  it('returns the correct value for each rank', () => {
    expect(getRankValue('2')).toBe(2);
    expect(getRankValue('7')).toBe(7);
    expect(getRankValue('10')).toBe(10);
    expect(getRankValue('J')).toBe(11);
    expect(getRankValue('A')).toBe(14);
  });
});

// ─── compareRanks ─────────────────────────────────────────────────────────────

describe('compareRanks', () => {
  it('returns a negative number when the first rank is lower', () => {
    expect(compareRanks('2', 'A')).toBeLessThan(0);
    expect(compareRanks('3', '4')).toBeLessThan(0);
    expect(compareRanks('J', 'Q')).toBeLessThan(0);
    expect(compareRanks('K', 'A')).toBeLessThan(0);
  });

  it('returns 0 for identical ranks', () => {
    expect(compareRanks('7', '7')).toBe(0);
    expect(compareRanks('A', 'A')).toBe(0);
    expect(compareRanks('2', '2')).toBe(0);
  });

  it('returns a positive number when the first rank is higher', () => {
    expect(compareRanks('A', '2')).toBeGreaterThan(0);
    expect(compareRanks('K', 'Q')).toBeGreaterThan(0);
    expect(compareRanks('Q', 'J')).toBeGreaterThan(0);
  });

  it('satisfies strict ascending ordering: 2 < 3 < … < K < A', () => {
    for (let i = 0; i < RANKS.length - 1; i++) {
      expect(compareRanks(RANKS[i] as Rank, RANKS[i + 1] as Rank)).toBeLessThan(0);
    }
  });

  it('is antisymmetric: compareRanks(a, b) = -compareRanks(b, a)', () => {
    expect(compareRanks('5', 'J')).toBe(-compareRanks('J', '5'));
    expect(compareRanks('A', '2')).toBe(-compareRanks('2', 'A'));
  });
});

// ─── getMinRank ───────────────────────────────────────────────────────────────

describe('getMinRank', () => {
  it('returns null for an empty array', () => {
    expect(getMinRank([])).toBeNull();
  });

  it('returns the rank of a single card', () => {
    expect(getMinRank([makeCard('7')])).toBe('7');
  });

  it('returns the lowest rank in a mixed hand', () => {
    expect(getMinRank([makeCard('K'), makeCard('2'), makeCard('A')])).toBe('2');
  });

  it('returns the correct rank when multiple cards share the minimum', () => {
    expect(getMinRank([makeCard('5', 0), makeCard('5', 1), makeCard('7')])).toBe('5');
  });

  it('correctly identifies 2 as the absolute minimum', () => {
    const allRanks: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const cards = allRanks.map((r, i) => makeCard(r, i));
    expect(getMinRank(cards)).toBe('2');
  });

  it('correctly identifies A as the maximum among high cards', () => {
    const cards = [makeCard('Q'), makeCard('K'), makeCard('A')];
    // getMinRank returns the lowest, which is Q
    expect(getMinRank(cards)).toBe('Q');
  });
});
