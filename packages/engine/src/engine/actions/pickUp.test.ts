import { describe, it, expect } from 'vitest';
import { applyPickUpPile } from './pickUp';
import type { Card, GameState, PileEntry, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], idx = 0): Card {
  return { id: `${rank}-hearts-${idx}`, suit: 'hearts', rank };
}

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'px', playerName: 'PX', timestamp: 0 };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return { id, name: id, hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false, ...overrides };
}

function makeState(pileCards: Card[], currentHand: Card[] = []): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [makePlayer('p0', { hand: currentHand }), makePlayer('p1', { hand: [card('9')] })],
    deck: [],
    pile: pileCards.length > 0 ? [pileEntry(pileCards)] : [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
  };
}

// ─── applyPickUpPile ──────────────────────────────────────────────────────────

describe('applyPickUpPile', () => {
  it('moves all pile cards into the player\'s hand', () => {
    const pileCards = [card('K'), card('Q'), card('J')];
    const state = makeState(pileCards);
    const next = applyPickUpPile(state, 'p0');
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.hand.map((c) => c.rank)).toContain('K');
    expect(next.players[0]!.hand.map((c) => c.rank)).toContain('Q');
    expect(next.players[0]!.hand.map((c) => c.rank)).toContain('J');
  });

  it('appends pile cards to an existing hand', () => {
    const pileCards = [card('K'), card('Q')];
    const handCards = [card('3'), card('5')];
    const state = makeState(pileCards, handCards);
    const next = applyPickUpPile(state, 'p0');
    expect(next.players[0]!.hand).toHaveLength(4);
  });

  it('empties the pile after pick-up', () => {
    const state = makeState([card('K'), card('Q')]);
    const next = applyPickUpPile(state, 'p0');
    expect(next.pile).toHaveLength(0);
  });

  it('works when the pile is already empty (picks up nothing)', () => {
    const state = makeState([]);
    const next = applyPickUpPile(state, 'p0');
    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.pile).toHaveLength(0);
  });

  it('advances the turn to the next player', () => {
    const state = makeState([card('K')]);
    const next = applyPickUpPile(state, 'p0');
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('does not mark the player as finished (picking up never finishes you)', () => {
    const state = makeState([card('K')]);
    const next = applyPickUpPile(state, 'p0');
    expect(next.players[0]!.isFinished).toBe(false);
  });

  it('handles multi-entry pile (flattens all entries into hand)', () => {
    const state: GameState = {
      ...makeState([]),
      pile: [
        pileEntry([card('5'), card('5', 0)]),
        pileEntry([card('7')]),
      ],
    };
    const next = applyPickUpPile(state, 'p0');
    // 2 cards in first entry + 1 in second = 3
    expect(next.players[0]!.hand).toHaveLength(3);
  });

  it('throws when it is not the player\'s turn', () => {
    const state = makeState([card('K')]);
    expect(() => applyPickUpPile(state, 'p1')).toThrow(/turn/);
  });

  it('throws for an unknown player id', () => {
    const state = makeState([card('K')]);
    expect(() => applyPickUpPile(state, 'ghost')).toThrow(/not found/);
  });

  it('throws when phase is not playing / revolution / superRevolution', () => {
    const state = { ...makeState([card('K')]), phase: 'swapping' as const };
    expect(() => applyPickUpPile(state, 'p0')).toThrow(/phase/);
  });

  it('does not mutate the input state', () => {
    const pileCards = [card('K'), card('Q')];
    const state = makeState(pileCards);
    const originalPileLength = state.pile.length;
    applyPickUpPile(state, 'p0');
    expect(state.pile).toHaveLength(originalPileLength);
    expect(state.players[0]!.hand).toHaveLength(0);
  });
});
