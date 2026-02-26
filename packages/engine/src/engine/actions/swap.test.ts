import { describe, it, expect } from 'vitest';
import { applySwap } from './swap';
import type { Card, GameState, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return { id, name: id, hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false, ...overrides };
}

function swappingState(hand: Card[], faceUp: Card[]): GameState {
  return {
    id: 'g1',
    phase: 'swapping',
    players: [
      makePlayer('p0', { hand, faceUp }),
      makePlayer('p1', { hand: [card('9')], faceUp: [card('K')] }),
    ],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [0, 1],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
  };
}

// ─── applySwap ────────────────────────────────────────────────────────────────

describe('applySwap', () => {
  it('moves the hand card to faceUp and the faceUp card to hand', () => {
    const h = card('7');
    const f = card('K', 'spades');
    const state = swappingState([h], [f]);
    const next = applySwap(state, 'p0', h.id, f.id);
    expect(next.players[0]!.hand).toContainEqual(f);
    expect(next.players[0]!.faceUp).toContainEqual(h);
    expect(next.players[0]!.hand).not.toContainEqual(h);
    expect(next.players[0]!.faceUp).not.toContainEqual(f);
  });

  it('preserves other cards in hand and faceUp when swapping one pair', () => {
    const h1 = card('5');
    const h2 = card('7');
    const f1 = card('K');
    const f2 = card('A', 'spades');
    const state = swappingState([h1, h2], [f1, f2]);
    const next = applySwap(state, 'p0', h1.id, f1.id);
    // h2 still in hand, f2 still in faceUp
    expect(next.players[0]!.hand).toContainEqual(h2);
    expect(next.players[0]!.faceUp).toContainEqual(f2);
  });

  it('can be applied multiple times (chained swaps)', () => {
    const h = card('3');
    const f = card('A');
    const state = swappingState([h], [f]);
    const after1 = applySwap(state, 'p0', h.id, f.id);
    // Now swap back
    const after2 = applySwap(after1, 'p0', f.id, h.id);
    expect(after2.players[0]!.hand).toContainEqual(h);
    expect(after2.players[0]!.faceUp).toContainEqual(f);
  });

  it('does not affect other players', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    const next = applySwap(state, 'p0', h.id, f.id);
    // p1 unchanged
    expect(next.players[1]).toEqual(state.players[1]);
  });

  it('does not change the phase', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    const next = applySwap(state, 'p0', h.id, f.id);
    expect(next.phase).toBe('swapping');
  });

  it('does not mutate the input state', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    const origHand = [...state.players[0]!.hand];
    applySwap(state, 'p0', h.id, f.id);
    expect(state.players[0]!.hand).toEqual(origHand);
  });

  it('throws when phase is not swapping', () => {
    const h = card('7');
    const f = card('K');
    const state = { ...swappingState([h], [f]), phase: 'playing' as const };
    expect(() => applySwap(state, 'p0', h.id, f.id)).toThrow(/swapping/);
  });

  it('throws for an unknown player id', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    expect(() => applySwap(state, 'ghost', h.id, f.id)).toThrow(/not found/);
  });

  it('throws when the hand card id does not exist in hand', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    expect(() => applySwap(state, 'p0', 'bad-id', f.id)).toThrow(/not found in hand/);
  });

  it('throws when the faceUp card id does not exist in faceUp', () => {
    const h = card('7');
    const f = card('K');
    const state = swappingState([h], [f]);
    expect(() => applySwap(state, 'p0', h.id, 'bad-id')).toThrow(/not found in faceUp/);
  });
});
