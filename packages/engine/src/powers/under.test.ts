import { describe, it, expect } from 'vitest';
import { isUnderTriggered, getUnderValue, applyUnder } from './under';
import type { Card, GameState, GameVariant } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank']): Card {
  return { id: `${rank}-hearts`, suit: 'hearts', rank };
}

const defaultVariant: GameVariant = {
  name: 'default',
  powerAssignments: { under: '8' },
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

// ─── isUnderTriggered ─────────────────────────────────────────────────────────

describe('isUnderTriggered', () => {
  it('returns true when played rank matches the Under assignment (8)', () => {
    expect(isUnderTriggered([card('8')], defaultVariant, 'playing')).toBe(true);
  });

  it('returns false when played rank does not match Under assignment', () => {
    expect(isUnderTriggered([card('5')], defaultVariant, 'playing')).toBe(false);
  });

  it('returns false when Under assignment is absent', () => {
    expect(isUnderTriggered([card('8')], emptyVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution', () => {
    expect(isUnderTriggered([card('8')], defaultVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution', () => {
    expect(isUnderTriggered([card('8')], defaultVariant, 'superRevolution')).toBe(false);
  });
});

// ─── getUnderValue ────────────────────────────────────────────────────────────

describe('getUnderValue', () => {
  it('returns 8 for the default Under rank', () => {
    expect(getUnderValue([card('8')], defaultVariant)).toBe(8);
  });

  it('returns 0 when no Under card is in the played cards', () => {
    expect(getUnderValue([card('5')], defaultVariant)).toBe(0);
  });
});

// ─── applyUnder ───────────────────────────────────────────────────────────────

describe('applyUnder', () => {
  it('sets activeUnder to the Under card value', () => {
    const state = baseState();
    const next = applyUnder(state, 8, 'p0', 0);
    expect(next.activeUnder).toBe(8);
  });

  it('logs an under entry with the underValue', () => {
    const state = baseState();
    const next = applyUnder(state, 8, 'p0', 0);
    const entry = next.log.find((e) => e.type === 'under');
    expect(entry).toBeDefined();
    expect(entry!.data.underValue).toBe(8);
  });

  it('does not mutate the input state', () => {
    const state = baseState();
    applyUnder(state, 8, 'p0', 0);
    expect(state.activeUnder).toBeUndefined();
  });
});
