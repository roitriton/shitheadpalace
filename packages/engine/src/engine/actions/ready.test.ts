import { describe, it, expect } from 'vitest';
import { applyReady, applyFirstPlayerShifumiChoice } from './ready';
import type { Card, GameState, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function makePlayer(id: string, hand: Card[], overrides: Partial<Player> = {}): Player {
  return {
    id, name: id,
    hand, faceUp: [card('K', 'spades', 99)], faceDown: [card('A', 'clubs', 99)],
    isFinished: false, isBot: false, ...overrides,
  };
}

function swappingState(players: Player[]): GameState {
  return {
    id: 'g1',
    phase: 'swapping',
    players,
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: players.map((_, i) => i),
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: players.length, deckCount: 1 },
    pendingAction: null,
    log: [],
  };
}

// ─── applyReady ───────────────────────────────────────────────────────────────

describe('applyReady', () => {
  it('marks the player as ready', () => {
    const state = swappingState([
      makePlayer('p0', [card('5')]),
      makePlayer('p1', [card('7')]),
    ]);
    const next = applyReady(state, 'p0');
    expect(next.players[0]!.isReady).toBe(true);
  });

  it('stays in swapping phase until all players are ready', () => {
    const state = swappingState([
      makePlayer('p0', [card('5')]),
      makePlayer('p1', [card('7')]),
    ]);
    const next = applyReady(state, 'p0');
    expect(next.phase).toBe('swapping');
    expect(next.pendingAction).toBeNull();
  });

  it('transitions to playing when all players signal ready (no tie)', () => {
    // p0 has the lowest card (2) → goes first
    const state = swappingState([
      makePlayer('p0', [card('2'), card('K'), card('Q')]),
      makePlayer('p1', [card('5'), card('A'), card('J')]),
    ]);
    const after0 = applyReady(state, 'p0');
    const after1 = applyReady(after0, 'p1');

    expect(after1.phase).toBe('playing');
    expect(after1.pendingAction).toBeNull();
    expect(after1.currentPlayerIndex).toBe(0);
    expect(after1.turnOrder).toEqual([1]);
  });

  it('sets pendingAction = firstPlayerShifumi when first-player is tied', () => {
    const state = swappingState([
      makePlayer('p0', [card('2', 'hearts'), card('K'), card('Q')]),
      makePlayer('p1', [card('2', 'spades'), card('A'), card('J')]),
    ]);
    const after0 = applyReady(state, 'p0');
    const after1 = applyReady(after0, 'p1');

    expect(after1.phase).toBe('swapping');
    expect(after1.pendingAction?.type).toBe('firstPlayerShifumi');
    if (after1.pendingAction?.type === 'firstPlayerShifumi') {
      expect(after1.pendingAction.playerIds).toContain('p0');
      expect(after1.pendingAction.playerIds).toContain('p1');
    }
  });

  it('works with 4 players — transitions when last one signals ready', () => {
    const state = swappingState([
      makePlayer('p0', [card('3'), card('K'), card('Q')]),
      makePlayer('p1', [card('2'), card('A'), card('J')]),
      makePlayer('p2', [card('5'), card('K'), card('Q')]),
      makePlayer('p3', [card('7'), card('A'), card('J')]),
    ]);

    let s = applyReady(state, 'p0');
    s = applyReady(s, 'p1');
    s = applyReady(s, 'p2');
    s = applyReady(s, 'p3');

    expect(s.phase).toBe('playing');
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.turnOrder).toEqual([2, 3, 0]);
  });

  it('sets firstPlayerShifumi when 3 players are tied', () => {
    const state = swappingState([
      makePlayer('p0', [card('3', 'hearts'), card('A'), card('K')]),
      makePlayer('p1', [card('3', 'spades'), card('Q'), card('J')]),
      makePlayer('p2', [card('3', 'diamonds'), card('K'), card('Q')]),
    ]);
    let s = applyReady(state, 'p0');
    s = applyReady(s, 'p1');
    s = applyReady(s, 'p2');

    expect(s.phase).toBe('swapping');
    expect(s.pendingAction?.type).toBe('firstPlayerShifumi');
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      expect(s.pendingAction.playerIds).toHaveLength(3);
      expect(s.pendingAction.playerIds).toContain('p0');
      expect(s.pendingAction.playerIds).toContain('p1');
      expect(s.pendingAction.playerIds).toContain('p2');
    }
  });

  it('sets firstPlayerShifumi when all 4 players are tied', () => {
    const state = swappingState([
      makePlayer('p0', [card('2', 'hearts'), card('K'), card('Q')]),
      makePlayer('p1', [card('2', 'spades'), card('A'), card('J')]),
      makePlayer('p2', [card('2', 'diamonds'), card('K'), card('Q')]),
      makePlayer('p3', [card('2', 'clubs'), card('A'), card('J')]),
    ]);
    let s = applyReady(state, 'p0');
    s = applyReady(s, 'p1');
    s = applyReady(s, 'p2');
    s = applyReady(s, 'p3');

    expect(s.phase).toBe('swapping');
    expect(s.pendingAction?.type).toBe('firstPlayerShifumi');
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      expect(s.pendingAction.playerIds).toHaveLength(4);
      expect(s.pendingAction.playerIds).toContain('p0');
      expect(s.pendingAction.playerIds).toContain('p1');
      expect(s.pendingAction.playerIds).toContain('p2');
      expect(s.pendingAction.playerIds).toContain('p3');
    }
  });

  it('excludes non-tied players when only some tie for first', () => {
    // p0 and p1 tie on lowest '2'; p2 and p3 don't have a '2'
    const state = swappingState([
      makePlayer('p0', [card('2', 'hearts'), card('K'), card('Q')]),
      makePlayer('p1', [card('2', 'spades'), card('A'), card('J')]),
      makePlayer('p2', [card('4'), card('K'), card('Q')]),
      makePlayer('p3', [card('5'), card('A'), card('J')]),
    ]);
    let s = applyReady(state, 'p0');
    s = applyReady(s, 'p1');
    s = applyReady(s, 'p2');
    s = applyReady(s, 'p3');

    expect(s.pendingAction?.type).toBe('firstPlayerShifumi');
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      expect(s.pendingAction.playerIds).toHaveLength(2);
      expect(s.pendingAction.playerIds).not.toContain('p2');
      expect(s.pendingAction.playerIds).not.toContain('p3');
    }
  });

  it('throws when phase is not swapping', () => {
    const state = { ...swappingState([makePlayer('p0', [card('5')])]), phase: 'playing' as const };
    expect(() => applyReady(state, 'p0')).toThrow(/swapping/);
  });

  it('throws for an unknown player id', () => {
    const state = swappingState([makePlayer('p0', [card('5')])]);
    expect(() => applyReady(state, 'ghost')).toThrow(/not found/);
  });

  it('does not mutate the input state', () => {
    const state = swappingState([
      makePlayer('p0', [card('5')]),
      makePlayer('p1', [card('7')]),
    ]);
    const originalReady = state.players[0]!.isReady;
    applyReady(state, 'p0');
    expect(state.players[0]!.isReady).toBe(originalReady);
  });

  it('appends a ready log entry', () => {
    const state = swappingState([
      makePlayer('p0', [card('5')]),
      makePlayer('p1', [card('7')]),
    ]);
    const next = applyReady(state, 'p0');
    expect(next.log.some((e) => e.type === 'ready' && e.playerId === 'p0')).toBe(true);
  });

  it('appends a gameStart log entry when all ready (no tie)', () => {
    const state = swappingState([
      makePlayer('p0', [card('2'), card('K'), card('Q')]),
      makePlayer('p1', [card('5'), card('A'), card('J')]),
    ]);
    const after1 = applyReady(applyReady(state, 'p0'), 'p1');
    expect(after1.log.some((e) => e.type === 'gameStart')).toBe(true);
  });
});

// ─── applyFirstPlayerShifumiChoice — 2-player ────────────────────────────────

describe('applyFirstPlayerShifumiChoice — 2 players', () => {
  function shifumiState2(): GameState {
    return {
      ...swappingState([
        makePlayer('p0', [card('2', 'hearts')]),
        makePlayer('p1', [card('2', 'spades')]),
      ]),
      pendingAction: {
        type: 'firstPlayerShifumi',
        playerIds: ['p0', 'p1'],
        choices: {},
      },
    };
  }

  it('records a choice without resolving yet', () => {
    const state = shifumiState2();
    const next = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    expect(next.pendingAction?.type).toBe('firstPlayerShifumi');
    expect(next.phase).toBe('swapping');
  });

  it('resolves and starts the game when p0 wins (rock beats scissors)', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    const after1 = applyFirstPlayerShifumiChoice(after0, 'p1', 'scissors');
    expect(after1.phase).toBe('playing');
    expect(after1.pendingAction).toBeNull();
    expect(after1.currentPlayerIndex).toBe(0);
  });

  it('resolves and starts the game when p1 wins (paper beats rock)', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    const after1 = applyFirstPlayerShifumiChoice(after0, 'p1', 'paper');
    expect(after1.phase).toBe('playing');
    expect(after1.currentPlayerIndex).toBe(1);
  });

  it('resets choices on a draw and keeps phase = swapping', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    const after1 = applyFirstPlayerShifumiChoice(after0, 'p1', 'rock');
    expect(after1.phase).toBe('swapping');
    if (after1.pendingAction?.type === 'firstPlayerShifumi') {
      expect(Object.keys(after1.pendingAction.choices)).toHaveLength(0);
    }
  });

  it('throws when no firstPlayerShifumi is pending', () => {
    const state = swappingState([makePlayer('p0', [card('5')]), makePlayer('p1', [card('7')])]);
    expect(() => applyFirstPlayerShifumiChoice(state, 'p0', 'rock')).toThrow(/pending/);
  });

  it('throws when player is not part of the shifumi', () => {
    const state = shifumiState2();
    expect(() => applyFirstPlayerShifumiChoice(state, 'ghost', 'rock')).toThrow();
  });

  it('throws when a player submits their choice a second time', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    expect(() => applyFirstPlayerShifumiChoice(after0, 'p0', 'scissors')).toThrow(/already submitted/);
  });

  it('appends a log entry when choice is submitted', () => {
    const state = shifumiState2();
    const next = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    expect(next.log.some((e) => e.type === 'firstPlayerShifumiChoice' && e.playerId === 'p0')).toBe(true);
  });

  it('appends a firstPlayerShifumiDraw log entry on draw', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    const after1 = applyFirstPlayerShifumiChoice(after0, 'p1', 'rock');
    expect(after1.log.some((e) => e.type === 'firstPlayerShifumiDraw')).toBe(true);
  });

  it('appends firstPlayerShifumiWin and gameStart log entries on win', () => {
    const state = shifumiState2();
    const after0 = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    const after1 = applyFirstPlayerShifumiChoice(after0, 'p1', 'scissors');
    expect(after1.log.some((e) => e.type === 'firstPlayerShifumiWin')).toBe(true);
    expect(after1.log.some((e) => e.type === 'gameStart')).toBe(true);
  });
});

// ─── applyFirstPlayerShifumiChoice — 3-player ────────────────────────────────

describe('applyFirstPlayerShifumiChoice — 3+ players (elimination)', () => {
  function shifumiState3(): GameState {
    return {
      ...swappingState([
        makePlayer('p0', [card('2', 'hearts')]),
        makePlayer('p1', [card('2', 'spades')]),
        makePlayer('p2', [card('2', 'diamonds')]),
      ]),
      pendingAction: {
        type: 'firstPlayerShifumi',
        playerIds: ['p0', 'p1', 'p2'],
        choices: {},
      },
    };
  }

  it('resets when all 3 choose the same (draw)', () => {
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p2', 'rock');

    expect(state.phase).toBe('swapping');
    if (state.pendingAction?.type === 'firstPlayerShifumi') {
      expect(state.pendingAction.playerIds).toEqual(['p0', 'p1', 'p2']);
      expect(Object.keys(state.pendingAction.choices)).toHaveLength(0);
    }
    expect(state.log.some((e) => e.type === 'firstPlayerShifumiDraw')).toBe(true);
  });

  it('resets when all 3 choices are different (triple draw)', () => {
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'paper');
    state = applyFirstPlayerShifumiChoice(state, 'p2', 'scissors');

    expect(state.phase).toBe('swapping');
    if (state.pendingAction?.type === 'firstPlayerShifumi') {
      expect(state.pendingAction.playerIds).toEqual(['p0', 'p1', 'p2']);
      expect(Object.keys(state.pendingAction.choices)).toHaveLength(0);
    }
    expect(state.log.some((e) => e.type === 'firstPlayerShifumiDraw')).toBe(true);
  });

  it('eliminates the loser and advances to the next round with 2 survivors', () => {
    // p0=rock, p1=rock, p2=scissors → rock wins → survivors p0, p1
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p2', 'scissors');

    expect(state.phase).toBe('swapping');
    if (state.pendingAction?.type === 'firstPlayerShifumi') {
      expect(state.pendingAction.playerIds).toContain('p0');
      expect(state.pendingAction.playerIds).toContain('p1');
      expect(state.pendingAction.playerIds).not.toContain('p2');
      expect(state.pendingAction.playerIds).toHaveLength(2);
      expect(Object.keys(state.pendingAction.choices)).toHaveLength(0);
    }
    expect(state.log.some((e) => e.type === 'firstPlayerShifumiNextRound')).toBe(true);
  });

  it('determines a winner when 2 remain after elimination round', () => {
    // Round 1: p0=rock, p1=rock, p2=scissors → survivors p0, p1
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p2', 'scissors');

    // Round 2: p0=paper, p1=rock → p0 wins (paper beats rock)
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'paper');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');

    expect(state.phase).toBe('playing');
    expect(state.pendingAction).toBeNull();
    expect(state.currentPlayerIndex).toBe(0); // p0 wins
  });

  it('handles draw in final round with 2 survivors, then resolves', () => {
    // Round 1: eliminate p2
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p2', 'scissors');

    // Round 2: draw
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'rock');

    expect(state.phase).toBe('swapping');
    if (state.pendingAction?.type === 'firstPlayerShifumi') {
      expect(Object.keys(state.pendingAction.choices)).toHaveLength(0);
      expect(state.pendingAction.playerIds).toHaveLength(2);
    }

    // Round 3: p1 wins
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    state = applyFirstPlayerShifumiChoice(state, 'p1', 'paper');

    expect(state.phase).toBe('playing');
    expect(state.currentPlayerIndex).toBe(1); // p1 wins
  });

  it('throws when a player in the tie group submits twice', () => {
    let state = shifumiState3();
    state = applyFirstPlayerShifumiChoice(state, 'p0', 'rock');
    expect(() => applyFirstPlayerShifumiChoice(state, 'p0', 'paper')).toThrow(/already submitted/);
  });

  it('handles 4-player round where 3 survive, then resolves in round 2', () => {
    // Round 1: p0, p1, p2 = rock; p3 = scissors → rock wins → 3 survivors
    const state4: GameState = {
      ...swappingState([
        makePlayer('p0', [card('2', 'hearts')]),
        makePlayer('p1', [card('2', 'spades')]),
        makePlayer('p2', [card('2', 'diamonds')]),
        makePlayer('p3', [card('2', 'clubs')]),
      ]),
      pendingAction: {
        type: 'firstPlayerShifumi',
        playerIds: ['p0', 'p1', 'p2', 'p3'],
        choices: {},
      },
    };

    let s = applyFirstPlayerShifumiChoice(state4, 'p0', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p1', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p2', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p3', 'scissors');

    // 3 survivors, p3 eliminated
    expect(s.phase).toBe('swapping');
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      expect(s.pendingAction.playerIds).toHaveLength(3);
      expect(s.pendingAction.playerIds).not.toContain('p3');
    }

    // Round 2: p0=scissors, p1=paper, p2=rock → all different → draw
    s = applyFirstPlayerShifumiChoice(s, 'p0', 'scissors');
    s = applyFirstPlayerShifumiChoice(s, 'p1', 'paper');
    s = applyFirstPlayerShifumiChoice(s, 'p2', 'rock');
    expect(s.phase).toBe('swapping');
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      expect(s.pendingAction.playerIds).toHaveLength(3); // still same 3
    }

    // Round 3: p0=rock, p1=scissors, p2=scissors → p0 wins
    s = applyFirstPlayerShifumiChoice(s, 'p0', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p1', 'scissors');
    s = applyFirstPlayerShifumiChoice(s, 'p2', 'scissors');
    expect(s.phase).toBe('playing');
    expect(s.currentPlayerIndex).toBe(0); // p0
  });

  it('full integration: applyReady 3-way tie → shifumi → game start', () => {
    // 3 players all have one '3' → tie
    const state = swappingState([
      makePlayer('p0', [card('3', 'hearts'), card('K')]),
      makePlayer('p1', [card('3', 'spades'), card('Q')]),
      makePlayer('p2', [card('3', 'diamonds'), card('J')]),
    ]);
    let s = applyReady(state, 'p0');
    s = applyReady(s, 'p1');
    s = applyReady(s, 'p2');

    expect(s.pendingAction?.type).toBe('firstPlayerShifumi');

    // All 3 submit choices — p1=scissors, p0=rock, p2=scissors → p0 wins
    s = applyFirstPlayerShifumiChoice(s, 'p0', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p1', 'scissors');
    s = applyFirstPlayerShifumiChoice(s, 'p2', 'scissors');

    expect(s.phase).toBe('playing');
    expect(s.pendingAction).toBeNull();
    expect(s.currentPlayerIndex).toBe(0); // p0
    expect(s.log.some((e) => e.type === 'gameStart')).toBe(true);
  });

  it('handles 4-player elimination down to 1 winner', () => {
    // 4 players: p0, p1, p2, p3
    const state4: GameState = {
      ...swappingState([
        makePlayer('p0', [card('2', 'hearts')]),
        makePlayer('p1', [card('2', 'spades')]),
        makePlayer('p2', [card('2', 'diamonds')]),
        makePlayer('p3', [card('2', 'clubs')]),
      ]),
      pendingAction: {
        type: 'firstPlayerShifumi',
        playerIds: ['p0', 'p1', 'p2', 'p3'],
        choices: {},
      },
    };

    // Round 1: p0=rock, p1=scissors, p2=scissors, p3=scissors → p0 wins immediately
    let s = applyFirstPlayerShifumiChoice(state4, 'p0', 'rock');
    s = applyFirstPlayerShifumiChoice(s, 'p1', 'scissors');
    s = applyFirstPlayerShifumiChoice(s, 'p2', 'scissors');
    s = applyFirstPlayerShifumiChoice(s, 'p3', 'scissors');

    expect(s.phase).toBe('playing');
    expect(s.currentPlayerIndex).toBe(0); // p0 wins
  });
});
