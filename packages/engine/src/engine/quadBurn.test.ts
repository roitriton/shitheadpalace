import { describe, it, expect } from 'vitest';
import { applyPlay } from './actions/play';
import { canPlayCards } from './validation';
import { isBurnTriggered } from '../powers/burn';
import type { Card, GameState, GameVariant, PileEntry, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileOf(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
  }));
}

/** Build a pile entry with multiple cards and optional effectiveRank. */
function pileEntry(cards: Card[], effectiveRank?: Card['rank']): PileEntry {
  return {
    cards,
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
    ...(effectiveRank ? { effectiveRank } : {}),
  };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    isBot: false,
    ...overrides,
  };
}

/** Default variant matching the real server Standard variant (all 6 powers). */
const defaultVariant: GameVariant = {
  name: 'Standard',
  powerAssignments: { burn: '10', reset: '2', under: '8', skip: '7', mirror: '9', target: 'A' },
  playerCount: 3,
  deckCount: 1,
};

/** Variant with no power assignments (no burn rank, no mirror, etc.). */
const emptyVariant: GameVariant = {
  name: 'empty',
  powerAssignments: {},
  playerCount: 2,
  deckCount: 1,
};

/** Build a 2-player state where p0 is the current player. */
function makeState(
  p0Hand: Card[],
  pileEntries: PileEntry[] = [],
  overrides: Partial<GameState> = {},
  p1: Partial<Player> = {},
): GameState {
  const players = [makePlayer('p0', { hand: p0Hand }), makePlayer('p1', p1)];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile: pileEntries,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: defaultVariant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// ─── canPlayCards — quad burn bypass ─────────────────────────────────────────

describe('canPlayCards — quad burn (4+ identical)', () => {
  it('4 cards bypass pile value constraint', () => {
    const state = makeState([], pileOf('A'), { variant: emptyVariant });
    // 4 sixes on an Ace — normally blocked (6 < A), but quad burn bypasses
    const sixes = [card('6'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs')];
    expect(canPlayCards(sixes, state)).toBe(true);
  });

  it('5 cards also bypass', () => {
    const state = makeState([], pileOf('K'), { variant: emptyVariant });
    const fives = [card('5'), card('5', 'spades'), card('5', 'diamonds'), card('5', 'clubs'), card('5', 'hearts', 1)];
    expect(canPlayCards(fives, state)).toBe(true);
  });

  it('effectiveCount=4 with mirrors bypasses pile value', () => {
    const state = makeState([], pileOf('A'));
    // 2 sixes + 2 mirrors = 4 effective sixes; pass effectiveCount=4
    const sixes = [card('6'), card('6', 'spades')];
    expect(canPlayCards(sixes, state, 4)).toBe(true);
  });

  it('3 cards do NOT bypass (normal rules)', () => {
    const state = makeState([], pileOf('A'), { variant: emptyVariant });
    const sixes = [card('6'), card('6', 'spades'), card('6', 'diamonds')];
    expect(canPlayCards(sixes, state)).toBe(false);
  });

  it('4 identical blocked by Under', () => {
    const state = makeState([], pileOf('5'), { activeUnder: 5 });
    // 4 sixes with value 6 > Under value 5 → blocked
    const sixes = [card('6'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs')];
    expect(canPlayCards(sixes, state)).toBe(false);
  });

  it('4 identical in Revolution → no bypass, normal rules apply', () => {
    const state = makeState([], pileOf('5'), { phase: 'revolution', variant: emptyVariant });
    // Revolution: must play ≤ 5. Sixes (value 6) > 5 → blocked
    const sixes = [card('6'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs')];
    expect(canPlayCards(sixes, state)).toBe(false);
  });
});

// ─── isBurnTriggered — effectiveCount ────────────────────────────────────────

describe('isBurnTriggered — quad burn (effectiveCount)', () => {
  it('effectiveCount >= 4 triggers burn', () => {
    const pile = pileOf('6');
    expect(isBurnTriggered([card('6')], pile, emptyVariant, 'playing', 4)).toBe(true);
  });

  it('effectiveCount < 4 does not trigger burn (rank not burn either)', () => {
    const pile = pileOf('6');
    expect(isBurnTriggered([card('6')], pile, emptyVariant, 'playing', 3)).toBe(false);
  });

  it('effectiveCount >= 4 in revolution → no burn', () => {
    const pile = pileOf('6');
    expect(isBurnTriggered([card('6')], pile, emptyVariant, 'revolution', 4)).toBe(false);
  });
});

// ─── applyPlay integration — quad burn ───────────────────────────────────────

describe('applyPlay — quad burn (4+ identical in one play)', () => {
  it('4 identical cards → burn, player replays', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('3'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    // Pile burned → empty
    expect(next.pile).toHaveLength(0);
    // Cards went to graveyard (pile had 1 card + 4 played = 5)
    expect(next.graveyard.length).toBeGreaterThanOrEqual(5);
    // Player replays → currentPlayerIndex still 0
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('5 identical cards → burn too', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'),
      card('6', 'clubs'), card('6', 'hearts', 1),
    ];
    const state = makeState(hand, pileOf('3'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard.length).toBeGreaterThanOrEqual(6);
  });

  it('4 identical with mirrors (6+6+9+9) → burn', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'),
      card('9', 'hearts'), card('9', 'spades'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('3'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard.length).toBeGreaterThanOrEqual(5);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('4 identical with mirrors (6+6+6+9) → burn', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'),
      card('9', 'hearts'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('3'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard.length).toBeGreaterThanOrEqual(5);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('4 identical on pile with higher value → burn (ignores pile constraint)', () => {
    const hand = [
      card('3', 'hearts'), card('3', 'spades'), card('3', 'diamonds'), card('3', 'clubs'),
    ];
    // Pile top is Ace — normally can't play 3 on Ace, but quad burn bypasses
    const state = makeState(hand, pileOf('A'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard.length).toBeGreaterThanOrEqual(5);
  });

  it('4 identical on empty pile → burn', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs'),
    ];
    const state = makeState(hand, [], { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard).toHaveLength(4);
  });

  it('3 identical → NOT a burn (normal play)', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('3'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    // Not a burn → pile not cleared
    expect(next.pile.length).toBeGreaterThan(0);
  });

  it('4 identical blocked by Under → throws', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs'),
    ];
    const state = makeState(hand, pileOf('5'), { activeUnder: 5 });
    expect(() => applyPlay(state, 'p0', hand.map((c) => c.id))).toThrow(/value too low/);
  });

  it('4 identical in Revolution → no burn, normal play (must respect value)', () => {
    const hand = [
      card('3', 'hearts'), card('3', 'spades'), card('3', 'diamonds'), card('3', 'clubs'),
    ];
    // Revolution: must play ≤ top value (5). 3 ≤ 5 → legal, but no burn.
    const state = makeState(hand, pileOf('5'), { phase: 'revolution', variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.map((c) => c.id));
    // Pile should NOT be burned (powers disabled during revolution)
    expect(next.pile.length).toBeGreaterThan(0);
  });

  it('4 identical in Revolution with value too high → throws', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'), card('6', 'diamonds'), card('6', 'clubs'),
    ];
    // Revolution: must play ≤ 5. Sixes (6) > 5 → rejected.
    const state = makeState(hand, pileOf('5'), { phase: 'revolution', variant: emptyVariant });
    expect(() => applyPlay(state, 'p0', hand.map((c) => c.id))).toThrow(/value too low/);
  });
});

// ─── Fix A: low cards quad burn on high pile ─────────────────────────────────

describe('applyPlay — quad burn low cards on high pile (Fix A)', () => {
  it('4+4+4+4 on a Dame → accepted, burn', () => {
    const hand = [
      card('4', 'hearts'), card('4', 'spades'), card('4', 'diamonds'), card('4', 'clubs'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('Q'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('3+3+3+3 on a Roi → accepted, burn', () => {
    const hand = [
      card('3', 'hearts'), card('3', 'spades'), card('3', 'diamonds'), card('3', 'clubs'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('K'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('4+4+4+4 on an As → accepted, burn', () => {
    const hand = [
      card('4', 'hearts'), card('4', 'spades'), card('4', 'diamonds'), card('4', 'clubs'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('A'));
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });
});

// ─── Exact reproduction of user-reported bug: 4+4+4+4 on a 7 (real variant) ─

describe('applyPlay — exact user bug scenario', () => {
  it('4+4+4+4 on a 7 with full Standard variant (3 players) → accepted, burn', () => {
    const hand = [
      card('4', 'hearts'), card('4', 'spades'), card('4', 'diamonds'), card('4', 'clubs'),
      card('K'), card('Q'),
    ];
    const players = [
      makePlayer('p0', { hand }),
      makePlayer('p1', { hand: [card('5'), card('6'), card('8')] }),
      makePlayer('p2', { hand: [card('5', 'spades'), card('6', 'spades'), card('8', 'spades')] }),
    ];
    const state: GameState = {
      id: 'g1',
      phase: 'playing',
      players,
      deck: [],
      pile: pileOf('7'),
      graveyard: [],
      currentPlayerIndex: 0,
      direction: 1,
      turnOrder: [1, 2],
      finishOrder: [],
      variant: defaultVariant,
      pendingAction: null,
      log: [],
      lastPowerTriggered: null,
    };
    // This is the exact scenario: 4 fours on a 7, Standard variant, 3 players
    const next = applyPlay(state, 'p0', hand.slice(0, 4).map((c) => c.id));
    expect(next.pile).toHaveLength(0); // Burn happened
    expect(next.graveyard.length).toBeGreaterThanOrEqual(5); // 1 (pile) + 4 (played)
    expect(next.currentPlayerIndex).toBe(0); // Player replays
  });
});

// ─── Feature B: burn by cross-turn accumulation ──────────────────────────────

describe('applyPlay — burn by cross-turn accumulation', () => {
  it('pile has one 2, player plays 2+2+2 → total 4 → burn', () => {
    const hand = [
      card('2', 'hearts'), card('2', 'spades'), card('2', 'diamonds'),
      card('K'),
    ];
    // Pile already has a 2 (1 card). Playing 3 more → 4 total on pile → burn.
    const state = makeState(hand, pileOf('2'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('pile has two 6s (2 turns), player plays 6+6 → total 4 → burn', () => {
    const hand = [
      card('6', 'hearts'), card('6', 'spades'),
      card('K'),
    ];
    // Pile: [6] [6] — two separate entries. Playing 2 more → 4 accumulated → burn.
    const state = makeState(hand, pileOf('6', '6'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 2).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('pile has 6+9 (mirror entry, effectiveRank 6), player plays 6+9+9 → total 5 → burn', () => {
    const hand = [
      card('6', 'diamonds'), card('9', 'diamonds'), card('9', 'clubs'),
      card('K'),
    ];
    // Pile: one entry with [6♥, 9♥] and effectiveRank '6' (mirror resolved).
    // Playing 6+9+9 (3 cards, effective value 6) → pile gets 2 + 3 = 5 effective sixes → burn.
    const mirrorPile: PileEntry[] = [
      pileEntry([card('6', 'hearts'), card('9', 'hearts')], '6'),
    ];
    const state = makeState(hand, mirrorPile);
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('pile has two 2s, player plays one 2 → total 3 → NOT burn', () => {
    const hand = [
      card('2', 'hearts'),
      card('K'),
    ];
    const state = makeState(hand, pileOf('2', '2'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', [hand[0]!.id]);
    // 3 total → not enough for burn
    expect(next.pile.length).toBeGreaterThan(0);
  });

  it('accumulation in Revolution → no burn', () => {
    const hand = [
      card('2', 'hearts'), card('2', 'spades'), card('2', 'diamonds'),
      card('K'),
    ];
    // Revolution: powers disabled. 1 + 3 = 4 accumulated, but no burn.
    // Revolution inverts values, 2 (value 2) ≤ 2 → legal.
    const state = makeState(hand, pileOf('2'), { phase: 'revolution', variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    expect(next.pile.length).toBeGreaterThan(0);
  });

  it('pile has 7,7,5 → player plays 5+5+5 → 4 fives (7s not counted) → burn', () => {
    const hand = [
      card('5', 'hearts'), card('5', 'spades'), card('5', 'diamonds'),
      card('K'),
    ];
    // Pile: [7] [7] [5] — streak of 5s starts at the last entry (only 1 five).
    // Playing 3 more → 1 + 3 = 4 fives on top → burn.
    const state = makeState(hand, pileOf('7', '7', '5'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    expect(next.pile).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('pile has 6, player plays 7+7+7 → total 3 sevens (6 not counted) → NOT burn', () => {
    const hand = [
      card('7', 'hearts'), card('7', 'spades'), card('7', 'diamonds'),
      card('K'),
    ];
    // Pile: [6] — sevens start fresh. 3 sevens < 4 → no burn.
    const state = makeState(hand, pileOf('6'), { variant: emptyVariant });
    const next = applyPlay(state, 'p0', hand.slice(0, 3).map((c) => c.id));
    expect(next.pile.length).toBeGreaterThan(0);
  });
});
