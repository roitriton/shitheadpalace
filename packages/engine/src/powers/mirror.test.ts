import { describe, it, expect } from 'vitest';
import { getMirrorEffectiveRank, applyMirror } from './mirror';
import type { Card, GameState, GameVariant, PileEntry } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

const defaultVariant: GameVariant = {
  name: 'default',
  powerAssignments: { mirror: '9' },
  playerCount: 2,
  deckCount: 1,
};

const emptyVariant: GameVariant = {
  name: 'empty',
  powerAssignments: {},
  playerCount: 2,
  deckCount: 1,
};

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'p0', playerName: 'P0', timestamp: 0 };
}

function baseState(pile: PileEntry[] = []): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      { id: 'p0', name: 'P0', hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false },
    ],
    deck: [],
    pile,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [],
    finishOrder: [],
    variant: defaultVariant,
    pendingAction: null,
    log: [],
  };
}

// ─── getMirrorEffectiveRank ───────────────────────────────────────────────────

describe('getMirrorEffectiveRank', () => {
  it('returns the non-Mirror card rank when Mirror + another card is played', () => {
    expect(getMirrorEffectiveRank([card('9'), card('K')], defaultVariant)).toBe('K');
  });

  it('returns the non-Mirror rank regardless of card order', () => {
    expect(getMirrorEffectiveRank([card('A'), card('9')], defaultVariant)).toBe('A');
  });

  it('returns the non-Mirror rank when multiple Mirrors accompany one card', () => {
    // 9 + 9 + K → effective rank is K
    expect(getMirrorEffectiveRank([card('9'), card('9', 'spades'), card('K')], defaultVariant)).toBe('K');
  });

  it('returns null when no Mirror card is played', () => {
    expect(getMirrorEffectiveRank([card('K')], defaultVariant)).toBeNull();
  });

  it('returns null when only Mirror cards are played (invalid solo mirror)', () => {
    expect(getMirrorEffectiveRank([card('9')], defaultVariant)).toBeNull();
  });

  it('returns null when Mirror assignment is absent in the variant', () => {
    expect(getMirrorEffectiveRank([card('9'), card('K')], emptyVariant)).toBeNull();
  });
});

// ─── applyMirror ──────────────────────────────────────────────────────────────

describe('applyMirror', () => {
  it('sets effectiveRank on the last PileEntry', () => {
    const pile = [pileEntry([card('9'), card('K')])];
    const state = baseState(pile);
    const next = applyMirror(state, 'K', 'p0', 0);
    expect(next.pile[0]!.effectiveRank).toBe('K');
  });

  it('does not modify earlier PileEntries', () => {
    const pile = [
      pileEntry([card('7')]),
      pileEntry([card('9'), card('K')]),
    ];
    const state = baseState(pile);
    const next = applyMirror(state, 'K', 'p0', 0);
    expect(next.pile[0]!.effectiveRank).toBeUndefined();
    expect(next.pile[1]!.effectiveRank).toBe('K');
  });

  it('logs a mirror entry with the effectiveRank', () => {
    const pile = [pileEntry([card('9'), card('A')])];
    const state = baseState(pile);
    const next = applyMirror(state, 'A', 'p0', 0);
    const entry = next.log.find((e) => e.type === 'mirror');
    expect(entry).toBeDefined();
    expect(entry!.data.effectiveRank).toBe('A');
  });

  it('returns state unchanged when the pile is empty', () => {
    const state = baseState([]);
    const next = applyMirror(state, 'K', 'p0', 0);
    expect(next.pile).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const pile = [pileEntry([card('9'), card('K')])];
    const state = baseState(pile);
    applyMirror(state, 'K', 'p0', 0);
    expect(state.pile[0]!.effectiveRank).toBeUndefined();
  });
});
