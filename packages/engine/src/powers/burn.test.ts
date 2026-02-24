import { describe, it, expect } from 'vitest';
import { isBurnTriggered, applyBurn } from './burn';
import type { Card, GameState, GameVariant, PileEntry } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

const defaultVariant: GameVariant = {
  name: 'default',
  powerAssignments: { burn: '10' },
  playerCount: 2,
  deckCount: 1,
};

const emptyVariant: GameVariant = {
  name: 'empty',
  powerAssignments: {},
  playerCount: 2,
  deckCount: 1,
};

function pileOf(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
  }));
}

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'px', playerName: 'PX', timestamp: 0 };
}

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

// ─── isBurnTriggered ──────────────────────────────────────────────────────────

describe('isBurnTriggered', () => {
  it('returns true when played rank matches the Burn assignment (10)', () => {
    const pile = pileOf('10');
    expect(isBurnTriggered([card('10')], pile, defaultVariant, 'playing')).toBe(true);
  });

  it('returns false when played rank does not match Burn assignment', () => {
    const pile = pileOf('7');
    expect(isBurnTriggered([card('7')], pile, defaultVariant, 'playing')).toBe(false);
  });

  it('returns false when Burn assignment is absent in the variant', () => {
    const pile = pileOf('10');
    expect(isBurnTriggered([card('10')], pile, emptyVariant, 'playing')).toBe(false);
  });

  it('returns true when 4 consecutive same-rank cards are on top of the pile', () => {
    // 3 existing + 1 just played = 4
    const pile = [...pileOf('5', '5', '5'), pileEntry([card('5')])];
    expect(isBurnTriggered([card('5')], pile, emptyVariant, 'playing')).toBe(true);
  });

  it('returns true when 4-identical uses a multi-card entry', () => {
    // Entry 1: two 5s, Entry 2: two more 5s = 4 total
    const pile = [pileEntry([card('5'), card('5', 'spades')]), pileEntry([card('5', 'diamonds'), card('5', 'clubs')])];
    expect(isBurnTriggered([card('5', 'clubs')], pile, emptyVariant, 'playing')).toBe(true);
  });

  it('returns false when fewer than 4 consecutive same-rank cards', () => {
    const pile = [...pileOf('5', '5'), pileEntry([card('5')])]; // exactly 3
    expect(isBurnTriggered([card('5')], pile, emptyVariant, 'playing')).toBe(false);
  });

  it('does not count through a different-rank entry (streak broken)', () => {
    // pile: 5, 5, 7, 5 — the 7 breaks the streak; only 1 five at top
    const pile = [...pileOf('5', '5', '7'), pileEntry([card('5')])];
    expect(isBurnTriggered([card('5')], pile, emptyVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution (all powers disabled)', () => {
    const pile = pileOf('10');
    expect(isBurnTriggered([card('10')], pile, defaultVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution', () => {
    const pile = pileOf('10');
    expect(isBurnTriggered([card('10')], pile, defaultVariant, 'superRevolution')).toBe(false);
  });

  it('returns false for empty playedCards', () => {
    expect(isBurnTriggered([], [], defaultVariant, 'playing')).toBe(false);
  });
});

// ─── applyBurn ────────────────────────────────────────────────────────────────

describe('applyBurn', () => {
  it('moves all pile cards to the graveyard', () => {
    const state = baseState({ pile: pileOf('K', '10', '7') });
    const next = applyBurn(state, 'p0', 0);
    expect(next.graveyard).toHaveLength(3);
    expect(next.graveyard.map((c) => c.rank)).toContain('K');
    expect(next.graveyard.map((c) => c.rank)).toContain('10');
  });

  it('clears the pile after burn', () => {
    const state = baseState({ pile: pileOf('10') });
    const next = applyBurn(state, 'p0', 0);
    expect(next.pile).toHaveLength(0);
  });

  it('appends burned cards to an existing graveyard', () => {
    const state = baseState({
      pile: pileOf('10'),
      graveyard: [card('5')],
    });
    const next = applyBurn(state, 'p0', 0);
    expect(next.graveyard).toHaveLength(2);
  });

  it('logs a burn entry with the correct burnedCount', () => {
    const state = baseState({ pile: pileOf('K', '10') });
    const next = applyBurn(state, 'p0', 0);
    const burnEntry = next.log.find((e) => e.type === 'burn');
    expect(burnEntry).toBeDefined();
    expect(burnEntry!.data.burnedCount).toBe(2);
  });

  it('does NOT advance the turn (currentPlayerIndex unchanged)', () => {
    const state = baseState({ pile: pileOf('10') });
    const next = applyBurn(state, 'p0', 0);
    expect(next.currentPlayerIndex).toBe(state.currentPlayerIndex);
  });

  it('does not mutate the input state', () => {
    const state = baseState({ pile: pileOf('10') });
    const originalPileLen = state.pile.length;
    applyBurn(state, 'p0', 0);
    expect(state.pile).toHaveLength(originalPileLen);
    expect(state.graveyard).toHaveLength(0);
  });
});
