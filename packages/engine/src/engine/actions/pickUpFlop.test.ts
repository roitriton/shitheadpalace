import { describe, it, expect } from 'vitest';
import { applyPickUpWithFlopCards, getAvailableFlopPickUpGroups } from './pickUpFlop';
import type { Card, GameState, GameVariant, PileEntry, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'px', playerName: 'PX', timestamp: 0 };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return { id, name: id, hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false, ...overrides };
}

const defaultVariant: GameVariant = {
  name: 'S',
  powerAssignments: { mirror: '9' as const },
  playerCount: 2,
  deckCount: 1,
};

const noMirrorVariant: GameVariant = {
  name: 'S',
  powerAssignments: {},
  playerCount: 2,
  deckCount: 1,
};

/**
 * Build a 2-player state where p0 is in flop phase (no hand, no deck).
 * p1 always has a hand card so the game doesn't end.
 */
function makeState(
  p0Flop: Card[],
  pileCards: Card[] = [],
  variant: GameVariant = defaultVariant,
  p0Overrides: Partial<Player> = {},
): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      makePlayer('p0', { hand: [], faceUp: p0Flop, faceDown: [card('K', 'clubs', 99)], ...p0Overrides }),
      makePlayer('p1', { hand: [card('4', 'clubs', 98)] }),
    ],
    deck: [],
    pile: pileCards.length > 0 ? [pileEntry(pileCards)] : [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// applyPickUpWithFlopCards
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyPickUpWithFlopCards', () => {
  // ─── Empty flopCardIds (regular pick-up) ─────────────────────────────────

  it('empty flopCardIds → regular pile pick-up', () => {
    const pK = card('K', 'hearts', 0);
    const state = makeState([card('5')], [pK]);

    const next = applyPickUpWithFlopCards(state, 'p0', []);

    expect(next.players[0]!.hand).toHaveLength(1);
    expect(next.players[0]!.hand[0]!.rank).toBe('K');
    expect(next.pile).toHaveLength(0);
    // Flop untouched
    expect(next.players[0]!.faceUp).toHaveLength(1);
  });

  it('empty flopCardIds + empty pile → picks up nothing, advances turn', () => {
    const state = makeState([card('5')], []);

    const next = applyPickUpWithFlopCards(state, 'p0', []);

    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.currentPlayerIndex).toBe(1);
  });

  // ─── Valid groups ────────────────────────────────────────────────────────

  it('picks up pile + single flop card of one rank', () => {
    const f5 = card('5', 'hearts', 0);
    const fQ = card('Q', 'diamonds', 1);
    const pK = card('K', 'spades', 0);
    const state = makeState([f5, fQ], [pK]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f5.id]);

    // hand = pile(K) + flop(5)
    expect(next.players[0]!.hand).toHaveLength(2);
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['5', 'K']);
    // flop: Q remains
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('Q');
    expect(next.pile).toHaveLength(0);
  });

  it('picks up pile + group of same-rank flop cards', () => {
    const f5a = card('5', 'hearts', 0);
    const f5b = card('5', 'spades', 1);
    const fQ = card('Q', 'diamonds', 2);
    const state = makeState([f5a, f5b, fQ], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f5a.id, f5b.id]);

    // hand = pile(K) + flop(5, 5) = 3
    expect(next.players[0]!.hand).toHaveLength(3);
    // flop: Q remains
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('Q');
  });

  it('picks up pile + group with mirror (9) acting as joker', () => {
    const f4 = card('4', 'spades', 0);
    const f9 = card('9', 'hearts', 1); // mirror
    const fQ = card('Q', 'diamonds', 2);
    const state = makeState([f4, f9, fQ], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f4.id, f9.id]);

    expect(next.players[0]!.hand).toHaveLength(3); // K + 4 + 9
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('Q');
  });

  it('picks up pile + mirror alone', () => {
    const f9 = card('9', 'hearts', 0); // mirror
    const fQ = card('Q', 'diamonds', 1);
    const state = makeState([f9, fQ], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f9.id]);

    expect(next.players[0]!.hand).toHaveLength(2); // K + 9
    expect(next.players[0]!.faceUp).toHaveLength(1);
  });

  it('picks up pile + two mirrors', () => {
    const f9a = card('9', 'hearts', 0);
    const f9b = card('9', 'spades', 1);
    const f5 = card('5', 'diamonds', 2);
    const state = makeState([f9a, f9b, f5], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f9a.id, f9b.id]);

    expect(next.players[0]!.hand).toHaveLength(3); // K + 9 + 9
    expect(next.players[0]!.faceUp).toHaveLength(1);
  });

  it('picks up: all 3 flop cards [5, 5, 9] as one group', () => {
    const f5a = card('5', 'hearts', 0);
    const f5b = card('5', 'spades', 1);
    const f9 = card('9', 'diamonds', 2); // mirror
    const state = makeState([f5a, f5b, f9], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f5a.id, f5b.id, f9.id]);

    expect(next.players[0]!.hand).toHaveLength(4); // K + 5 + 5 + 9
    expect(next.players[0]!.faceUp).toHaveLength(0);
  });

  // ─── Rejections ──────────────────────────────────────────────────────────

  it('rejects different ranks without mirror', () => {
    const f4 = card('4', 'spades', 0);
    const fQ = card('Q', 'diamonds', 1);
    const state = makeState([f4, fQ], [card('K')], noMirrorVariant);

    expect(() => applyPickUpWithFlopCards(state, 'p0', [f4.id, fQ.id]))
      .toThrow(/same rank/);
  });

  it('rejects different non-mirror ranks even with mirror variant', () => {
    const f4 = card('4', 'spades', 0);
    const fQ = card('Q', 'diamonds', 1);
    const state = makeState([f4, fQ, card('9', 'hearts', 2)], [card('K')]);

    // 4 and Q are different non-mirror ranks
    expect(() => applyPickUpWithFlopCards(state, 'p0', [f4.id, fQ.id]))
      .toThrow(/same rank/);
  });

  it('rejects if player still has hand cards', () => {
    const state = makeState([card('5')], [card('K')]);
    // Give p0 a hand card
    const withHand: GameState = {
      ...state,
      players: state.players.map((p, i) => i === 0 ? { ...p, hand: [card('3')] } : p),
    };

    expect(() => applyPickUpWithFlopCards(withHand, 'p0', []))
      .toThrow(/hand cards/);
  });

  it('rejects if deck is not empty', () => {
    const state = { ...makeState([card('5')], [card('K')]), deck: [card('A')] };

    expect(() => applyPickUpWithFlopCards(state, 'p0', []))
      .toThrow(/Deck is not empty/);
  });

  it('rejects if player has no flop cards', () => {
    const state = makeState([], [card('K')]);

    expect(() => applyPickUpWithFlopCards(state, 'p0', []))
      .toThrow(/no flop cards/);
  });

  it('rejects if cardId not found in flop', () => {
    const state = makeState([card('5')], [card('K')]);

    expect(() => applyPickUpWithFlopCards(state, 'p0', ['nonexistent']))
      .toThrow(/not found in player's flop/);
  });

  it('rejects if not the player\'s turn', () => {
    const state = makeState([card('5')], [card('K')]);

    expect(() => applyPickUpWithFlopCards(state, 'p1', []))
      .toThrow(/turn/);
  });

  it('rejects if phase is not playing/revolution/superRevolution', () => {
    const state = { ...makeState([card('5')], [card('K')]), phase: 'swapping' as const };

    expect(() => applyPickUpWithFlopCards(state, 'p0', []))
      .toThrow(/phase/);
  });

  it('rejects unknown player id', () => {
    const state = makeState([card('5')], [card('K')]);

    expect(() => applyPickUpWithFlopCards(state, 'ghost', []))
      .toThrow(/not found/);
  });

  // ─── State transitions ───────────────────────────────────────────────────

  it('advances turn after pick-up', () => {
    const state = makeState([card('5')], [card('K')]);
    const next = applyPickUpWithFlopCards(state, 'p0', []);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('clears activeUnder and pileResetActive', () => {
    const state = {
      ...makeState([card('5')], [card('K')]),
      activeUnder: 8,
      pileResetActive: true,
    };

    const next = applyPickUpWithFlopCards(state, 'p0', [card('5', 'hearts', 0).id]);

    expect(next.activeUnder).toBeNull();
    expect(next.pileResetActive).toBe(false);
  });

  it('logs pickUpWithFlop with flop info', () => {
    const f5 = card('5', 'hearts', 0);
    const state = makeState([f5, card('Q', 'diamonds', 1)], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', [f5.id]);

    const logEntry = next.log.find((l) => l.type === 'pickUpWithFlop');
    expect(logEntry).toBeDefined();
    expect(logEntry!.data.flopCardIds).toEqual([f5.id]);
    expect(logEntry!.data.flopRanks).toEqual(['5']);
  });

  it('logs regular pickUp when flopCardIds is empty', () => {
    const state = makeState([card('5')], [card('K')]);

    const next = applyPickUpWithFlopCards(state, 'p0', []);

    const logEntry = next.log.find((l) => l.type === 'pickUp');
    expect(logEntry).toBeDefined();
  });

  it('does not mutate input state', () => {
    const f5 = card('5', 'hearts', 0);
    const state = makeState([f5, card('Q')], [card('K')]);
    const originalFlopLength = state.players[0]!.faceUp.length;

    applyPickUpWithFlopCards(state, 'p0', [f5.id]);

    expect(state.players[0]!.faceUp).toHaveLength(originalFlopLength);
    expect(state.players[0]!.hand).toHaveLength(0);
  });

  it('ends revolution phase on pick-up (non-super)', () => {
    const state = { ...makeState([card('5')], [card('K')]), phase: 'revolution' as const };

    const next = applyPickUpWithFlopCards(state, 'p0', []);

    expect(next.phase).toBe('playing');
  });

  it('keeps superRevolution phase on pick-up', () => {
    const state = {
      ...makeState([card('5')], [card('K')]),
      phase: 'superRevolution' as const,
      superRevolution: true,
    };

    const next = applyPickUpWithFlopCards(state, 'p0', []);

    expect(next.phase).toBe('superRevolution');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getAvailableFlopPickUpGroups
// ═══════════════════════════════════════════════════════════════════════════════

describe('getAvailableFlopPickUpGroups', () => {
  it('returns empty array if player has hand cards', () => {
    const player = makePlayer('p0', { hand: [card('3')], faceUp: [card('5')] });
    const groups = getAvailableFlopPickUpGroups(player, defaultVariant);
    expect(groups).toHaveLength(0);
  });

  it('returns empty array if player has no flop cards', () => {
    const player = makePlayer('p0', { hand: [], faceUp: [] });
    const groups = getAvailableFlopPickUpGroups(player, defaultVariant);
    expect(groups).toHaveLength(0);
  });

  it('flop [4♠, 9♥, Q♦] → 6 groups', () => {
    const f4 = card('4', 'spades', 0);
    const f9 = card('9', 'hearts', 1); // mirror
    const fQ = card('Q', 'diamonds', 2);
    const player = makePlayer('p0', { hand: [], faceUp: [f4, f9, fQ] });

    const groups = getAvailableFlopPickUpGroups(player, defaultVariant);
    const groupSets = groups.map((g) => new Set(g));

    // Expected groups: {4}, {Q}, {9}, {4,9}, {Q,9}
    // That's 5 groups
    expect(groupSets).toContainEqual(new Set([f4.id]));
    expect(groupSets).toContainEqual(new Set([fQ.id]));
    expect(groupSets).toContainEqual(new Set([f9.id]));
    expect(groupSets).toContainEqual(new Set([f4.id, f9.id]));
    expect(groupSets).toContainEqual(new Set([fQ.id, f9.id]));
    expect(groups.length).toBe(5);
  });

  it('flop [5♠, 5♥, 9♦] → 7 groups', () => {
    const f5a = card('5', 'spades', 0);
    const f5b = card('5', 'hearts', 1);
    const f9 = card('9', 'diamonds', 2); // mirror
    const player = makePlayer('p0', { hand: [], faceUp: [f5a, f5b, f9] });

    const groups = getAvailableFlopPickUpGroups(player, defaultVariant);
    const groupSets = groups.map((g) => new Set(g));

    // Expected: {5a}, {5b}, {9}, {5a,5b}, {5a,9}, {5b,9}, {5a,5b,9}
    expect(groupSets).toContainEqual(new Set([f5a.id]));
    expect(groupSets).toContainEqual(new Set([f5b.id]));
    expect(groupSets).toContainEqual(new Set([f9.id]));
    expect(groupSets).toContainEqual(new Set([f5a.id, f5b.id]));
    expect(groupSets).toContainEqual(new Set([f5a.id, f9.id]));
    expect(groupSets).toContainEqual(new Set([f5b.id, f9.id]));
    expect(groupSets).toContainEqual(new Set([f5a.id, f5b.id, f9.id]));
    expect(groups.length).toBe(7);
  });

  it('flop with no mirror variant → only same-rank groups', () => {
    const f5a = card('5', 'hearts', 0);
    const f5b = card('5', 'spades', 1);
    const fQ = card('Q', 'diamonds', 2);
    const player = makePlayer('p0', { hand: [], faceUp: [f5a, f5b, fQ] });

    const groups = getAvailableFlopPickUpGroups(player, noMirrorVariant);
    const groupSets = groups.map((g) => new Set(g));

    // {5a}, {5b}, {Q}, {5a,5b}
    expect(groupSets).toContainEqual(new Set([f5a.id]));
    expect(groupSets).toContainEqual(new Set([f5b.id]));
    expect(groupSets).toContainEqual(new Set([fQ.id]));
    expect(groupSets).toContainEqual(new Set([f5a.id, f5b.id]));
    expect(groups.length).toBe(4);
  });

  it('single flop card → 1 group', () => {
    const f5 = card('5', 'hearts', 0);
    const player = makePlayer('p0', { hand: [], faceUp: [f5] });

    const groups = getAvailableFlopPickUpGroups(player, defaultVariant);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([f5.id]);
  });
});
