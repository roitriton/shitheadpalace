import { describe, it, expect } from 'vitest';
import { isResetTriggered, applyReset } from './reset';
import type { Card, GameState, GameVariant } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank']): Card {
  return { id: `${rank}-hearts`, suit: 'hearts', rank };
}

const defaultVariant: GameVariant = {
  name: 'default',
  powerAssignments: { reset: '2' },
  playerCount: 2,
  deckCount: 1,
};

const emptyVariant: GameVariant = {
  name: 'empty',
  powerAssignments: {},
  playerCount: 2,
  deckCount: 1,
};

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      { id: 'p0', name: 'P0', hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false },
    ],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [],
    finishOrder: [],
    variant: defaultVariant,
    pendingAction: null,
    log: [],
    ...overrides,
  };
}

// ─── isResetTriggered ─────────────────────────────────────────────────────────

describe('isResetTriggered', () => {
  it('returns true when played rank matches the Reset assignment (2)', () => {
    expect(isResetTriggered([card('2')], defaultVariant, 'playing')).toBe(true);
  });

  it('returns false when played rank does not match Reset assignment', () => {
    expect(isResetTriggered([card('5')], defaultVariant, 'playing')).toBe(false);
  });

  it('returns false when Reset assignment is absent', () => {
    expect(isResetTriggered([card('2')], emptyVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution', () => {
    expect(isResetTriggered([card('2')], defaultVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution', () => {
    expect(isResetTriggered([card('2')], defaultVariant, 'superRevolution')).toBe(false);
  });
});

// ─── applyReset ───────────────────────────────────────────────────────────────

describe('applyReset', () => {
  it('sets pileResetActive to true', () => {
    const state = baseState();
    const next = applyReset(state, 'p0', 0);
    expect(next.pileResetActive).toBe(true);
  });

  it('logs a reset entry', () => {
    const state = baseState();
    const next = applyReset(state, 'p0', 0);
    expect(next.log.some((e) => e.type === 'reset' && e.playerId === 'p0')).toBe(true);
  });

  it('does not mutate the input state', () => {
    const state = baseState();
    applyReset(state, 'p0', 0);
    expect(state.pileResetActive).toBeUndefined();
  });
});
