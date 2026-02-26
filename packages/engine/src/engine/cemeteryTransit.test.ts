import { describe, it, expect } from 'vitest';
import type { Card, GameState, GameVariant, PileEntry, Player } from '../types';
import { resolveCemeteryTransit } from './cemeteryTransit';
import { applyPlay } from './actions/play';
import { createInitialGameState } from '../utils/gameInit';
import { filterGameStateForPlayer } from './filter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileOf(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r, i) => ({
    cards: [card(r, 'hearts', i + 100)],
    playerId: 'other',
    playerName: 'Other',
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

const allPowers: GameVariant = {
  name: 'all',
  powerAssignments: { burn: '10', reset: '2', under: '8', skip: '7', mirror: '9' },
  playerCount: 4,
  deckCount: 1,
};

function makeState(
  p0: Partial<Player>,
  pile: PileEntry[] = [],
  otherPlayers: Partial<Player>[] = [{}, {}, {}],
  overrides: Partial<GameState> = {},
): GameState {
  const players = [
    makePlayer('p0', p0),
    ...otherPlayers.map((o, i) => makePlayer(`p${i + 1}`, o)),
  ];
  return {
    id: 'test-game',
    phase: 'playing',
    players,
    deck: [],
    pile,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: players.map((_, i) => i),
    finishOrder: [],
    variant: allPowers,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    pendingCemeteryTransit: false,
    ...overrides,
  };
}

// ─── resolveCemeteryTransit — burn transit ──────────────────────────────────

describe('resolveCemeteryTransit — burn transit', () => {
  it('moves entire pile to graveyard when lastPowerTriggered is burn', () => {
    const pile = pileOf('5', '6', '10');
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: { type: 'burn', playerId: 'p0' },
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toEqual([]);
    expect(result.graveyard).toHaveLength(3);
    expect(result.graveyard.map((c) => c.rank)).toEqual(['5', '6', '10']);
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('handles burn by quad (4 identical cards in one pile entry)', () => {
    const quadEntry: PileEntry = {
      cards: [card('6', 'hearts'), card('6', 'diamonds', 1), card('6', 'clubs', 2), card('6', 'spades', 3)],
      playerId: 'p0',
      playerName: 'p0',
      timestamp: 0,
    };
    const state = makeState({}, [quadEntry], [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: { type: 'burn', playerId: 'p0' },
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toEqual([]);
    expect(result.graveyard).toHaveLength(4);
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('handles burn by accumulation (cards across multiple pile entries)', () => {
    const pile: PileEntry[] = [
      { cards: [card('6', 'hearts', 0)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
      { cards: [card('6', 'diamonds', 1)], playerId: 'p2', playerName: 'p2', timestamp: 0 },
      { cards: [card('6', 'clubs', 2)], playerId: 'p0', playerName: 'p0', timestamp: 0 },
      { cards: [card('6', 'spades', 3)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
    ];
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: { type: 'burn', playerId: 'p1' },
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toEqual([]);
    expect(result.graveyard).toHaveLength(4);
    expect(result.pendingCemeteryTransit).toBe(false);
  });
});

// ─── resolveCemeteryTransit — jack transit ──────────────────────────────────

describe('resolveCemeteryTransit — jack transit', () => {
  it('moves only top pile entry to graveyard when lastPowerTriggered is not burn', () => {
    const pile: PileEntry[] = [
      { cards: [card('5', 'hearts', 0)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
      { cards: [card('J', 'spades', 1)], playerId: 'p0', playerName: 'p0', timestamp: 0 },
    ];
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: null, // jack power is deferred → null
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toHaveLength(1);
    expect(result.pile[0]!.cards[0]!.rank).toBe('5');
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0]!.rank).toBe('J');
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('moves super jack (J + mirror) top entry to graveyard', () => {
    const pile: PileEntry[] = [
      { cards: [card('3', 'hearts', 0)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
      {
        cards: [card('J', 'spades', 1), card('9', 'hearts', 2)],
        playerId: 'p0',
        playerName: 'p0',
        timestamp: 0,
      },
    ];
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: null,
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toHaveLength(1);
    expect(result.pile[0]!.cards[0]!.rank).toBe('3');
    expect(result.graveyard).toHaveLength(2);
    expect(result.graveyard.map((c) => c.rank)).toEqual(['J', '9']);
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('preserves pile below jack entry', () => {
    const pile: PileEntry[] = [
      { cards: [card('3', 'hearts', 0)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
      { cards: [card('4', 'diamonds', 1)], playerId: 'p2', playerName: 'p2', timestamp: 0 },
      { cards: [card('J', 'clubs', 2)], playerId: 'p0', playerName: 'p0', timestamp: 0 },
    ];
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: true,
      lastPowerTriggered: null,
    });

    const result = resolveCemeteryTransit(state);

    expect(result.pile).toHaveLength(2);
    expect(result.pile[0]!.cards[0]!.rank).toBe('3');
    expect(result.pile[1]!.cards[0]!.rank).toBe('4');
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0]!.rank).toBe('J');
  });
});

// ─── resolveCemeteryTransit — no-op ─────────────────────────────────────────

describe('resolveCemeteryTransit — no-op', () => {
  it('returns state unchanged when flag is false', () => {
    const pile = pileOf('5', '6');
    const state = makeState({}, pile, [{}, {}, {}], {
      pendingCemeteryTransit: false,
    });

    const result = resolveCemeteryTransit(state);

    expect(result).toBe(state); // reference equality — no copy
  });

  it('returns state unchanged when flag is undefined', () => {
    const pile = pileOf('5', '6');
    const state = makeState({}, pile, [{}, {}, {}]);
    // Explicitly remove the field to simulate undefined
    const stateWithoutFlag = { ...state };
    delete (stateWithoutFlag as unknown as Record<string, unknown>)['pendingCemeteryTransit'];

    const result = resolveCemeteryTransit(stateWithoutFlag);

    expect(result).toBe(stateWithoutFlag);
  });
});

// ─── Integration through applyPlay ──────────────────────────────────────────

describe('integration through applyPlay', () => {
  it('burn by 10: pile empty, graveyard correct, flag false', () => {
    const pile = pileOf('5');
    const state = makeState(
      { hand: [card('10', 'hearts', 0), card('K', 'spades', 1), card('Q', 'diamonds', 2)] },
      pile,
    );

    const result = applyPlay(state, 'p0', [card('10', 'hearts', 0).id]);

    expect(result.pile).toEqual([]);
    expect(result.graveyard.length).toBeGreaterThanOrEqual(2); // at least the original pile + burn card
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('burn by 4+ identical: pile empty, graveyard correct', () => {
    const pile: PileEntry[] = [
      { cards: [card('6', 'hearts', 100)], playerId: 'p1', playerName: 'p1', timestamp: 0 },
      { cards: [card('6', 'diamonds', 101)], playerId: 'p2', playerName: 'p2', timestamp: 0 },
      { cards: [card('6', 'clubs', 102)], playerId: 'p3', playerName: 'p3', timestamp: 0 },
    ];
    const state = makeState(
      { hand: [card('6', 'spades', 0), card('K', 'spades', 1), card('Q', 'diamonds', 2)] },
      pile,
    );

    const result = applyPlay(state, 'p0', [card('6', 'spades', 0).id]);

    expect(result.pile).toEqual([]);
    expect(result.graveyard).toHaveLength(4);
    expect(result.pendingCemeteryTransit).toBe(false);
  });

  it('jack played: flag false, jack in graveyard, rest of pile intact', () => {
    const pile = pileOf('5');
    const state = makeState(
      { hand: [card('J', 'spades', 0), card('K', 'spades', 1), card('Q', 'diamonds', 2)] },
      pile,
      [{ hand: [card('3', 'hearts', 10)] }, {}, {}],
    );

    const result = applyPlay(state, 'p0', [card('J', 'spades', 0).id], 0, 'p1');

    expect(result.pendingCemeteryTransit).toBe(false);
    // Jack should be in the graveyard
    expect(result.graveyard.some((c) => c.rank === 'J')).toBe(true);
    // The original pile entry (5) should still be in the pile
    expect(result.pile.some((e) => e.cards.some((c) => c.rank === '5'))).toBe(true);
  });

  it('super jack (J + mirror): flag false, both in graveyard', () => {
    const pile = pileOf('5');
    const state = makeState(
      {
        hand: [
          card('J', 'spades', 0),
          card('9', 'hearts', 1),
          card('Q', 'diamonds', 2),
        ],
      },
      pile,
      [{ hand: [card('3', 'hearts', 10)] }, {}, {}],
    );

    const result = applyPlay(state, 'p0', [card('J', 'spades', 0).id, card('9', 'hearts', 1).id], 0, 'p1');

    expect(result.pendingCemeteryTransit).toBe(false);
    // J and 9 should be in the graveyard
    expect(result.graveyard.some((c) => c.rank === 'J')).toBe(true);
    expect(result.graveyard.some((c) => c.rank === '9')).toBe(true);
    // Original pile entry should still be there
    expect(result.pile.some((e) => e.cards.some((c) => c.rank === '5'))).toBe(true);
  });
});

// ─── Default & filter ───────────────────────────────────────────────────────

describe('default & filter', () => {
  it('createInitialGameState sets pendingCemeteryTransit to false', () => {
    const variant: GameVariant = {
      name: 'test',
      powerAssignments: { burn: '10' },
      playerCount: 2,
      deckCount: 1,
    };
    const state = createInitialGameState('g1', [
      { id: 'p1', name: 'Player 1', isBot: false },
      { id: 'p2', name: 'Player 2', isBot: false },
    ], variant);

    expect(state.pendingCemeteryTransit).toBe(false);
  });

  it('filterGameStateForPlayer preserves pendingCemeteryTransit', () => {
    const state = makeState({}, [], [{}, {}, {}], {
      pendingCemeteryTransit: true,
    });

    const filtered = filterGameStateForPlayer(state, 'p0');

    expect(filtered.pendingCemeteryTransit).toBe(true);
  });

  it('jack during revolution: no transit (jack stays in pile, flag false)', () => {
    const pile = pileOf('K');
    const state = makeState(
      { hand: [card('J', 'diamonds', 0), card('K', 'spades', 1), card('Q', 'diamonds', 2)] },
      pile,
      [{}, {}, {}],
      { phase: 'revolution', revolution: true },
    );

    const result = applyPlay(state, 'p0', [card('J', 'diamonds', 0).id]);

    expect(result.pendingCemeteryTransit).toBeFalsy();
    // Jack should remain in the pile (powers suppressed during revolution)
    const allPileCards = result.pile.flatMap((e) => e.cards);
    expect(allPileCards.some((c) => c.rank === 'J')).toBe(true);
    // Jack should NOT be in the graveyard
    expect(result.graveyard.some((c) => c.rank === 'J')).toBe(false);
  });
});
