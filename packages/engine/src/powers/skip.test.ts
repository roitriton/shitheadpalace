import { describe, it, expect } from 'vitest';
import { getSkipCount, logSkip } from './skip';
import type { Card, GameState, GameVariant } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

const defaultVariant: GameVariant = {
  name: 'default',
  powerAssignments: { skip: '7' },
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
    lastPowerTriggered: null,
    ...overrides,
  };
}

// ─── getSkipCount ─────────────────────────────────────────────────────────────

describe('getSkipCount', () => {
  it('returns 1 for a single Skip card', () => {
    expect(getSkipCount([card('7')], defaultVariant, 'playing')).toBe(1);
  });

  it('returns 2 for two Skip cards (cumulative)', () => {
    const c7a = card('7', 'hearts');
    const c7b = card('7', 'spades');
    expect(getSkipCount([c7a, c7b], defaultVariant, 'playing')).toBe(2);
  });

  it('returns 3 for three Skip cards', () => {
    const cards = [card('7'), card('7', 'spades'), card('7', 'diamonds')];
    expect(getSkipCount(cards, defaultVariant, 'playing')).toBe(3);
  });

  it('returns 0 when no Skip card is played', () => {
    expect(getSkipCount([card('K')], defaultVariant, 'playing')).toBe(0);
  });

  it('returns 0 when Skip assignment is absent', () => {
    expect(getSkipCount([card('7')], emptyVariant, 'playing')).toBe(0);
  });

  it('returns 0 during revolution', () => {
    expect(getSkipCount([card('7')], defaultVariant, 'revolution')).toBe(0);
  });

  it('returns 0 during superRevolution', () => {
    expect(getSkipCount([card('7')], defaultVariant, 'superRevolution')).toBe(0);
  });
});

// ─── getSkipCount — Mirror augments the count ─────────────────────────────────

describe('getSkipCount — Mirror augments Skip count', () => {
  const skipMirrorVariant: GameVariant = {
    name: 'skip-mirror',
    powerAssignments: { skip: '7', mirror: '9' },
    playerCount: 4,
    deckCount: 1,
  };

  it('Skip + Mirror: returns 2 (1 skip + 1 mirror)', () => {
    expect(getSkipCount([card('7'), card('9')], skipMirrorVariant, 'playing')).toBe(2);
  });

  it('Skip + 2 Mirrors: returns 3 (1 skip + 2 mirrors)', () => {
    const cards = [card('7'), card('9', 'spades'), card('9', 'diamonds')];
    expect(getSkipCount(cards, skipMirrorVariant, 'playing')).toBe(3);
  });

  it('Mirror without a Skip card: returns 0 (skip not triggered)', () => {
    expect(getSkipCount([card('9'), card('K')], skipMirrorVariant, 'playing')).toBe(0);
  });

  it('2 Skips + 1 Mirror: returns 3', () => {
    const cards = [card('7', 'hearts'), card('7', 'spades'), card('9')];
    expect(getSkipCount(cards, skipMirrorVariant, 'playing')).toBe(3);
  });
});

// ─── logSkip ─────────────────────────────────────────────────────────────────

describe('logSkip', () => {
  it('appends a skip log entry with the correct skipCount', () => {
    const state = baseState();
    const next = logSkip(state, 2, 'p0', 0);
    const entry = next.log.find((e) => e.type === 'skip');
    expect(entry).toBeDefined();
    expect(entry!.data.skipCount).toBe(2);
    expect(entry!.playerId).toBe('p0');
  });

  it('does not mutate the input state', () => {
    const state = baseState();
    logSkip(state, 1, 'p0', 0);
    expect(state.log).toHaveLength(0);
  });
});
