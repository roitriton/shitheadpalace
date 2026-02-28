import { describe, it, expect } from 'vitest';
import { applyPlay } from './actions/play';
import { applyPickUpPile } from './actions/pickUp';
import { filterGameStateForPlayer } from './filter';
import type { Card, GameState, PileEntry, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pile(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
  }));
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

function makeState(
  p0: Partial<Player>,
  pileEntries: PileEntry[] = [],
  deck: Card[] = [],
  p1: Partial<Player> = {},
): GameState {
  const players = [makePlayer('p0', p0), makePlayer('p1', p1)];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck,
    pile: pileEntries,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('lastPowerTriggered', () => {
  it('play of burn card (10) sets lastPowerTriggered to burn', () => {
    const c10 = card('10');
    const state = makeState(
      { hand: [c10, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { burn: '10' };

    const next = applyPlay(state, 'p0', [c10.id]);
    expect(next.lastPowerTriggered).toMatchObject({ type: 'burn', playerId: 'p0' });
    expect(next.lastPowerTriggered!.cardsPlayed).toEqual([{ rank: '10', suit: 'hearts' }]);
  });

  it('play of skip card (7) sets lastPowerTriggered to skip with skipCount', () => {
    const c7 = card('7');
    const state = makeState(
      { hand: [c7, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { skip: '7' };

    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.lastPowerTriggered).toMatchObject({ type: 'skip', playerId: 'p0', skipCount: 1 });
    expect(next.lastPowerTriggered!.cardsPlayed).toEqual([{ rank: '7', suit: 'hearts' }]);
  });

  it('play of reset card (2) sets lastPowerTriggered to reset', () => {
    const c2 = card('2');
    const state = makeState(
      { hand: [c2, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { reset: '2' };

    const next = applyPlay(state, 'p0', [c2.id]);
    expect(next.lastPowerTriggered).toMatchObject({ type: 'reset', playerId: 'p0' });
    expect(next.lastPowerTriggered!.cardsPlayed).toEqual([{ rank: '2', suit: 'hearts' }]);
  });

  it('play of under card (8) sets lastPowerTriggered to under', () => {
    const c8 = card('8');
    const state = makeState(
      { hand: [c8, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { under: '8' };

    const next = applyPlay(state, 'p0', [c8.id]);
    expect(next.lastPowerTriggered).toMatchObject({ type: 'under', playerId: 'p0' });
    expect(next.lastPowerTriggered!.cardsPlayed).toEqual([{ rank: '8', suit: 'hearts' }]);
  });

  it('play of target card (A) does NOT set lastPowerTriggered (deferred to applyTargetChoice)', () => {
    const cA = card('A');
    const state = makeState(
      { hand: [cA, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { target: 'A' };

    const next = applyPlay(state, 'p0', [cA.id]);
    // Target overlay is deferred until the choice is made
    expect(next.lastPowerTriggered).toBeNull();
  });

  it('play of revolution card (J diamonds) sets PendingRevolutionConfirm (deferred)', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { revolution: 'J' };

    const next = applyPlay(state, 'p0', [jd.id]);
    // Revolution is now deferred — overlay comes after confirmation
    expect(next.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect(next.lastPowerTriggered).toBeNull();
  });

  it('mirror (9+10) sets lastPowerTriggered to burn (copies the accompanied power)', () => {
    const c9 = card('9');
    const c10 = card('10');
    const state = makeState(
      { hand: [c9, c10, card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { mirror: '9', burn: '10' };

    const next = applyPlay(state, 'p0', [c9.id, c10.id]);
    expect(next.lastPowerTriggered).toMatchObject({ type: 'burn', playerId: 'p0' });
    expect(next.lastPowerTriggered!.cardsPlayed).toEqual([
      { rank: '9', suit: 'hearts' },
      { rank: '10', suit: 'hearts' },
    ]);
  });

  it('normal play without power sets lastPowerTriggered to null', () => {
    const c5 = card('5');
    const state = makeState(
      { hand: [c5, card('K'), card('Q')] },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c5.id]);
    expect(next.lastPowerTriggered).toBeNull();
  });

  it('pickUp resets lastPowerTriggered to null', () => {
    const state = makeState(
      { hand: [card('3')] },
      pile('5', 'K'),
    );
    // Pretend a previous power was triggered
    state.lastPowerTriggered = { type: 'skip', playerId: 'p0', skipCount: 1 };

    const next = applyPickUpPile(state, 'p0');
    expect(next.lastPowerTriggered).toBeNull();
  });

  it('filterGameStateForPlayer preserves lastPowerTriggered', () => {
    const state = makeState(
      { hand: [card('3')] },
      pile('5'),
    );
    state.lastPowerTriggered = { type: 'burn', playerId: 'p0' };

    const filtered = filterGameStateForPlayer(state, 'p1');
    expect(filtered.lastPowerTriggered).toEqual({ type: 'burn', playerId: 'p0' });
  });
});
