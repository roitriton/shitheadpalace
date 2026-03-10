import { describe, it, expect } from 'vitest';
import { autoDraw, isPlayerFinished, isGameOver, buildTurnQueue, advanceTurn, resolveAutoSkip, TARGET_HAND_SIZE } from './turn';
import { applyAllBlockedShifumiChoice } from './actions/applyAllBlockedShifumiChoice';
import type { Card, GameState, PileEntry, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], idx = 0): Card {
  return { id: `${rank}-hearts-${idx}`, suit: 'hearts', rank };
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

function makeState(overrides: Partial<GameState> = {}): GameState {
  const players = [makePlayer('p0'), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2, 3],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 4, deckCount: 1 },
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// ─── TARGET_HAND_SIZE ─────────────────────────────────────────────────────────

describe('TARGET_HAND_SIZE', () => {
  it('equals 3', () => expect(TARGET_HAND_SIZE).toBe(3));
});

// ─── autoDraw ─────────────────────────────────────────────────────────────────

describe('autoDraw', () => {
  it('draws until hand reaches TARGET_HAND_SIZE', () => {
    const player = makePlayer('p', { hand: [card('2')] }); // 1 card
    const deck = [card('5'), card('7'), card('A'), card('K')];
    const { player: p2, deck: d2 } = autoDraw(player, deck);
    expect(p2.hand).toHaveLength(TARGET_HAND_SIZE);
    expect(d2).toHaveLength(deck.length - 2); // drew 2
  });

  it('draws the correct cards (from the top of the deck)', () => {
    const player = makePlayer('p', { hand: [card('2')] });
    const deck = [card('5', 0), card('7', 1), card('A', 2)];
    const { player: p2 } = autoDraw(player, deck);
    expect(p2.hand[1]!.id).toBe('5-hearts-0');
    expect(p2.hand[2]!.id).toBe('7-hearts-1');
  });

  it('does nothing when hand is already at TARGET_HAND_SIZE', () => {
    const player = makePlayer('p', { hand: [card('2'), card('5'), card('7')] });
    const deck = [card('A')];
    const { player: p2, deck: d2 } = autoDraw(player, deck);
    expect(p2.hand).toHaveLength(3);
    expect(d2).toHaveLength(1);
  });

  it('does nothing when the deck is empty', () => {
    const player = makePlayer('p', { hand: [card('2')] });
    const { player: p2, deck: d2 } = autoDraw(player, []);
    expect(p2.hand).toHaveLength(1);
    expect(d2).toHaveLength(0);
  });

  it('draws as many as available if deck has fewer than needed', () => {
    const player = makePlayer('p', { hand: [] });
    const deck = [card('A')]; // only 1 card, need 3
    const { player: p2, deck: d2 } = autoDraw(player, deck);
    expect(p2.hand).toHaveLength(1);
    expect(d2).toHaveLength(0);
  });

  it('does not mutate the input player or deck', () => {
    const player = makePlayer('p', { hand: [card('2')] });
    const deck = [card('5'), card('7')];
    const originalDeckLength = deck.length;
    const originalHandLength = player.hand.length;
    autoDraw(player, deck);
    expect(deck).toHaveLength(originalDeckLength);
    expect(player.hand).toHaveLength(originalHandLength);
  });

  it('draws until hand reaches custom targetHandSize = 5', () => {
    const player = makePlayer('p', { hand: [card('2')] });
    const deck = [card('3'), card('4'), card('5'), card('6'), card('7')];
    const { player: p2, deck: d2 } = autoDraw(player, deck, 5);
    expect(p2.hand).toHaveLength(5);
    expect(d2).toHaveLength(1);
  });

  it('draws until hand reaches custom targetHandSize = 1 (draws nothing if already 1)', () => {
    const player = makePlayer('p', { hand: [card('2')] });
    const deck = [card('3'), card('4')];
    const { player: p2, deck: d2 } = autoDraw(player, deck, 1);
    expect(p2.hand).toHaveLength(1);
    expect(d2).toHaveLength(2);
  });

  it('draws until hand reaches custom targetHandSize = 2', () => {
    const player = makePlayer('p', { hand: [] });
    const deck = [card('3'), card('4'), card('5')];
    const { player: p2, deck: d2 } = autoDraw(player, deck, 2);
    expect(p2.hand).toHaveLength(2);
    expect(d2).toHaveLength(1);
  });
});

// ─── isPlayerFinished ─────────────────────────────────────────────────────────

describe('isPlayerFinished', () => {
  it('returns true when all zones are empty', () => {
    expect(isPlayerFinished(makePlayer('p'))).toBe(true);
  });
  it('returns false when hand has cards', () => {
    expect(isPlayerFinished(makePlayer('p', { hand: [card('5')] }))).toBe(false);
  });
  it('returns false when faceUp has cards', () => {
    expect(isPlayerFinished(makePlayer('p', { faceUp: [card('5')] }))).toBe(false);
  });
  it('returns false when faceDown has cards', () => {
    expect(isPlayerFinished(makePlayer('p', { faceDown: [card('5')] }))).toBe(false);
  });
});

// ─── isGameOver ───────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  it('returns false when multiple players are active', () => {
    expect(isGameOver(makeState())).toBe(false);
  });

  it('returns true when only one active player remains', () => {
    const state = makeState({
      players: [
        makePlayer('p0'),
        makePlayer('p1', { isFinished: true }),
        makePlayer('p2', { isFinished: true }),
        makePlayer('p3', { isFinished: true }),
      ],
    });
    expect(isGameOver(state)).toBe(true);
  });

  it('returns true when all players are finished', () => {
    const state = makeState({
      players: makeState().players.map((p) => ({ ...p, isFinished: true })),
    });
    expect(isGameOver(state)).toBe(true);
  });
});

// ─── buildTurnQueue ───────────────────────────────────────────────────────────

describe('buildTurnQueue', () => {
  const players = [makePlayer('p0'), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];

  it('builds correct queue clockwise (direction = 1)', () => {
    expect(buildTurnQueue(players, 2, 1)).toEqual([3, 0, 1]);
  });

  it('builds correct queue counter-clockwise (direction = -1)', () => {
    expect(buildTurnQueue(players, 2, -1)).toEqual([1, 0, 3]);
  });

  it('wraps around correctly at index 0 (clockwise)', () => {
    expect(buildTurnQueue(players, 0, 1)).toEqual([1, 2, 3]);
  });

  it('wraps around correctly at index 3 (clockwise)', () => {
    expect(buildTurnQueue(players, 3, 1)).toEqual([0, 1, 2]);
  });

  it('excludes finished players', () => {
    const withFinished = players.map((p, i) =>
      i === 1 ? { ...p, isFinished: true } : p,
    );
    // Player 1 is finished: queue after player 0 = [2, 3]
    expect(buildTurnQueue(withFinished, 0, 1)).toEqual([2, 3]);
  });

  it('throws when firstPlayerIndex is not in the active players list', () => {
    const allFinished = players.map((p) => ({ ...p, isFinished: true }));
    expect(() => buildTurnQueue(allFinished, 0, 1)).toThrow();
  });
});

// ─── advanceTurn ─────────────────────────────────────────────────────────────

describe('advanceTurn', () => {
  it('moves to the next player in turnOrder', () => {
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, false);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.turnOrder).toEqual([2, 3, 0]); // 0 appended at tail
  });

  it('does NOT append finished player back to the queue', () => {
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, true);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.turnOrder).toEqual([2, 3]); // 0 not re-added
  });

  it('strips players that became finished from the queue', () => {
    const players = makeState().players.map((p, i) =>
      i === 2 ? { ...p, isFinished: true } : p,
    );
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, false);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.turnOrder).not.toContain(2); // 2 is finished — stripped
  });

  it('returns empty turnOrder when no active players remain', () => {
    const allFinished = makeState().players.map((p, i) =>
      i === 0 ? p : { ...p, isFinished: true },
    );
    const state = makeState({ players: allFinished, currentPlayerIndex: 0, turnOrder: [] });
    const next = advanceTurn(state, true);
    expect(next.turnOrder).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const originalTurnOrder = [...state.turnOrder];
    advanceTurn(state, false);
    expect(state.turnOrder).toEqual(originalTurnOrder);
  });

  // ── Skip ────────────────────────────────────────────────────────────────────

  it('skips 1 player when skipCount = 1', () => {
    // Queue: p0 (current) → [1, 2, 3]. Skip 1 → p1 skips, p2 plays next.
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, false, 1);
    expect(next.currentPlayerIndex).toBe(2); // p1 skipped
    // p1 should still be in turnOrder (not permanently removed)
    expect(next.turnOrder).toContain(1);
  });

  it('skips 2 players when skipCount = 2', () => {
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, false, 2);
    expect(next.currentPlayerIndex).toBe(3); // p1 and p2 skipped
    expect(next.turnOrder).toContain(1);
    expect(next.turnOrder).toContain(2);
  });

  it('skipped players are appended to the back of the queue', () => {
    // p0 (current), turnOrder [1, 2, 3], skip 1
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const next = advanceTurn(state, false, 1);
    // After: current = 2, turnOrder = [3, 0, 1]  (p1 moved to back)
    expect(next.turnOrder).toEqual([3, 0, 1]);
  });

  it('large skipCount wraps via modulo (odd count in 2-player → launcher replays)', () => {
    // 2 active players: p0, p1. Skip 99 → 99 % 2 = 1 → p1 skipped, p0 replays.
    const players = [makePlayer('p0'), makePlayer('p1'), ...makeState().players.slice(2).map(p => ({ ...p, isFinished: true }))];
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1] });
    const next = advanceTurn(state, false, 99);
    expect(next.currentPlayerIndex).toBe(0); // p0 replays (99 % 2 = 1)
  });

  it('skipCount = 0 behaves identically to no-skip call', () => {
    const state = makeState({ currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const noSkip = advanceTurn(state, false);
    const zeroSkip = advanceTurn(state, false, 0);
    expect(zeroSkip).toEqual(noSkip);
  });
});

// ─── advanceTurn — circular skip wrap-around ──────────────────────────────────

describe('advanceTurn — circular skip wrap-around', () => {
  function make2Player(): GameState {
    // p0 current, p1 next, p2/p3 finished
    const players = makeState().players.map((p, i) =>
      i >= 2 ? { ...p, isFinished: true } : p,
    );
    return makeState({ players, currentPlayerIndex: 0, turnOrder: [1] });
  }

  function make3Player(): GameState {
    // p0 current, p1/p2 next, p3 finished
    const players = makeState().players.map((p, i) =>
      i === 3 ? { ...p, isFinished: true } : p,
    );
    return makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2] });
  }

  // ── 2-player ──────────────────────────────────────────────────────────────

  it('2-player, skip 1: B skipped → launcher (A) replays', () => {
    const next = advanceTurn(make2Player(), false, 1);
    expect(next.currentPlayerIndex).toBe(0); // A replays
    expect(next.turnOrder).toContain(1);     // B still in queue
  });

  it('2-player, skip 2: B skipped, A skipped → B plays', () => {
    const next = advanceTurn(make2Player(), false, 2);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('2-player, skip 3: wraps again → A replays', () => {
    const next = advanceTurn(make2Player(), false, 3);
    expect(next.currentPlayerIndex).toBe(0);
  });

  // ── 3-player ──────────────────────────────────────────────────────────────

  it('3-player, skip 1: B skipped → C plays', () => {
    const next = advanceTurn(make3Player(), false, 1);
    expect(next.currentPlayerIndex).toBe(2);
  });

  it('3-player, skip 2: B and C skipped → launcher (A) replays', () => {
    const next = advanceTurn(make3Player(), false, 2);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('3-player, skip 3: B, C, A skipped → B plays', () => {
    const next = advanceTurn(make3Player(), false, 3);
    expect(next.currentPlayerIndex).toBe(1);
  });
});

// ─── resolveAutoSkip ─────────────────────────────────────────────────────────

describe('resolveAutoSkip', () => {
  function pileOf(...ranks: Card['rank'][]): PileEntry[] {
    return ranks.map((r) => ({
      cards: [card(r)],
      playerId: 'px',
      playerName: 'PX',
      timestamp: 0,
    }));
  }

  it('returns state unchanged when pile is non-empty', () => {
    const state = makeState({ pile: pileOf('5') });
    const result = resolveAutoSkip(state);
    expect(result).toBe(state);
  });

  it('returns state unchanged when phase is finished', () => {
    const state = makeState({ phase: 'finished' as const });
    const result = resolveAutoSkip(state);
    expect(result).toBe(state);
  });

  it('returns state unchanged when pendingAction is set', () => {
    const state = makeState({
      pendingAction: { type: 'target', launcherId: 'p0' },
    });
    const result = resolveAutoSkip(state);
    expect(result).toBe(state);
  });

  it('returns state unchanged when current player can play', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [card('5')] } : { ...p, hand: [card('K')] },
    );
    const state = makeState({ players });
    const result = resolveAutoSkip(state);
    expect(result.currentPlayerIndex).toBe(0);
  });

  it('skips current player when they cannot play on empty pile (only Jacks)', () => {
    const players = makeState().players.map((p, i) =>
      i === 0
        ? { ...p, hand: [{ id: 'J-h-0', suit: 'hearts' as const, rank: 'J' as const }] }
        : { ...p, hand: [card('5')] },
    );
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const result = resolveAutoSkip(state);
    // p0 skipped, p1 becomes current (p1 has a playable '5')
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('skips multiple players until finding one who can play', () => {
    const jHeart: Card = { id: 'J-h-0', suit: 'hearts', rank: 'J' };
    const jDiamond: Card = { id: 'J-d-0', suit: 'diamonds', rank: 'J' };
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart] };     // only Jack
      if (i === 1) return { ...p, hand: [jDiamond] };   // only Jack
      if (i === 2) return { ...p, hand: [card('5')] };   // playable
      return { ...p, hand: [card('K')] };
    });
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const result = resolveAutoSkip(state);
    expect(result.currentPlayerIndex).toBe(2);
  });

  it('triggers allBlockedShifumi when ALL players are blocked', () => {
    const jHeart: Card = { id: 'J-h-0', suit: 'hearts', rank: 'J' };
    const jDiamond: Card = { id: 'J-d-0', suit: 'diamonds', rank: 'J' };
    const jClub: Card = { id: 'J-c-0', suit: 'clubs', rank: 'J' };
    const jSpade: Card = { id: 'J-s-0', suit: 'spades', rank: 'J' };
    const players = makeState().players.map((p, i) => {
      const suits: Card[] = [jHeart, jDiamond, jClub, jSpade];
      return { ...p, hand: [suits[i]!] };
    });
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const result = resolveAutoSkip(state);
    expect(result.pendingAction).not.toBeNull();
    expect(result.pendingAction!.type).toBe('allBlockedShifumi');
    if (result.pendingAction!.type === 'allBlockedShifumi') {
      expect(result.pendingAction!.playerIds).toHaveLength(4);
    }
  });

  it('logs skipTurn + skipTurnEffect when auto-skipping a player', () => {
    const players = makeState().players.map((p, i) =>
      i === 0
        ? { ...p, hand: [{ id: 'J-h-0', suit: 'hearts' as const, rank: 'J' as const }] }
        : { ...p, hand: [card('5')] },
    );
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const result = resolveAutoSkip(state);
    expect(result.currentPlayerIndex).toBe(1);
    // Should have 2 log entries: skipTurn + skipTurnEffect for p0
    expect(result.log).toHaveLength(2);
    expect(result.log[0]!.type).toBe('skipTurn');
    expect(result.log[0]!.playerId).toBe('p0');
    expect(result.log[0]!.data.message).toBe('p0 ne peut pas jouer');
    expect(result.log[1]!.type).toBe('skipTurnEffect');
    expect(result.log[1]!.playerId).toBe('p0');
    expect(result.log[1]!.data.message).toBe('p0 passe son tour');
    expect(result.log[1]!.entryType).toBe('effect');
  });

  it('logs multiple skips when several players are auto-skipped', () => {
    const jHeart: Card = { id: 'J-h-0', suit: 'hearts', rank: 'J' };
    const jDiamond: Card = { id: 'J-d-0', suit: 'diamonds', rank: 'J' };
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart] };     // only Jack
      if (i === 1) return { ...p, hand: [jDiamond] };   // only Jack
      if (i === 2) return { ...p, hand: [card('5')] };   // playable
      return { ...p, hand: [card('K')] };
    });
    const state = makeState({ players, currentPlayerIndex: 0, turnOrder: [1, 2, 3] });
    const result = resolveAutoSkip(state);
    expect(result.currentPlayerIndex).toBe(2);
    // Should have 4 log entries: 2 per skipped player (p0 and p1)
    expect(result.log).toHaveLength(4);
    expect(result.log[0]!.type).toBe('skipTurn');
    expect(result.log[0]!.playerId).toBe('p0');
    expect(result.log[1]!.type).toBe('skipTurnEffect');
    expect(result.log[1]!.playerId).toBe('p0');
    expect(result.log[2]!.type).toBe('skipTurn');
    expect(result.log[2]!.playerId).toBe('p1');
    expect(result.log[3]!.type).toBe('skipTurnEffect');
    expect(result.log[3]!.playerId).toBe('p1');
  });

  it('uses timestamp from last log entry when available', () => {
    const players = makeState().players.map((p, i) =>
      i === 0
        ? { ...p, hand: [{ id: 'J-h-0', suit: 'hearts' as const, rank: 'J' as const }] }
        : { ...p, hand: [card('5')] },
    );
    const state = makeState({
      players,
      currentPlayerIndex: 0,
      turnOrder: [1, 2, 3],
      log: [{ id: 'prev-0', timestamp: 42000, type: 'play', data: {} }],
    });
    const result = resolveAutoSkip(state);
    // New log entries should inherit the timestamp from the previous entry
    expect(result.log[1]!.timestamp).toBe(42000);
    expect(result.log[2]!.timestamp).toBe(42000);
  });
});

// ─── applyAllBlockedShifumiChoice ────────────────────────────────────────────

describe('applyAllBlockedShifumiChoice', () => {
  function blockedState(playerCount = 3): GameState {
    const players = Array.from({ length: playerCount }, (_, i) =>
      makePlayer(`p${i}`, { hand: [{ id: `J-h-${i}`, suit: 'hearts', rank: 'J' }] }),
    );
    return {
      ...makeState({ players }),
      pendingAction: {
        type: 'allBlockedShifumi' as const,
        playerIds: players.map((p) => p.id),
        choices: {},
        rankedIds: [],
      },
      turnOrder: players.slice(1).map((_, i) => i + 1),
    };
  }

  it('throws when no pending allBlockedShifumi action', () => {
    const state = makeState();
    expect(() => applyAllBlockedShifumiChoice(state, 'p0', 'rock')).toThrow(
      /No pending allBlockedShifumi/,
    );
  });

  it('throws when player is not part of the shifumi', () => {
    const state = blockedState();
    expect(() => applyAllBlockedShifumiChoice(state, 'ghost', 'rock')).toThrow(/not part/);
  });

  it('throws when player already submitted', () => {
    let state = blockedState();
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    expect(() => applyAllBlockedShifumiChoice(state, 'p0', 'paper')).toThrow(
      /already submitted/,
    );
  });

  it('records choice without resolving when not all players have chosen', () => {
    const state = blockedState();
    const next = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    expect(next.pendingAction?.type).toBe('allBlockedShifumi');
  });

  it('draw: resets choices when all pick the same (3-way tie)', () => {
    let state = blockedState();
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p2', 'rock');
    // All same → draw, choices reset
    expect(state.pendingAction?.type).toBe('allBlockedShifumi');
    if (state.pendingAction?.type === 'allBlockedShifumi') {
      expect(state.pendingAction.choices).toEqual({});
      expect(state.pendingAction.playerIds).toHaveLength(3);
    }
  });

  it('single winner: eliminates winner and continues with remaining', () => {
    let state = blockedState();
    // p0=rock, p1=scissors, p2=scissors → rock beats scissors → p0 wins
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'scissors');
    state = applyAllBlockedShifumiChoice(state, 'p2', 'scissors');
    // p0 wins (best finish position), p1 and p2 remain
    expect(state.pendingAction?.type).toBe('allBlockedShifumi');
    if (state.pendingAction?.type === 'allBlockedShifumi') {
      expect(state.pendingAction.rankedIds).toEqual(['p0']);
      expect(state.pendingAction.playerIds).toEqual(['p1', 'p2']);
      expect(state.pendingAction.choices).toEqual({});
    }
  });

  it('full resolution: 3 players → game ends with ranked order', () => {
    let state = blockedState();
    // Round 1: p0=rock, p1=scissors, p2=scissors → p0 wins (1st)
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'scissors');
    state = applyAllBlockedShifumiChoice(state, 'p2', 'scissors');
    // Round 2: p1 vs p2
    state = applyAllBlockedShifumiChoice(state, 'p1', 'paper');
    state = applyAllBlockedShifumiChoice(state, 'p2', 'rock');
    // p1 wins (2nd), p2 is last (shit head)
    expect(state.phase).toBe('finished');
    expect(state.pendingAction).toBeNull();
    expect(state.finishOrder).toEqual(['p0', 'p1', 'p2']);
    expect(state.players.every((p) => p.isFinished)).toBe(true);
  });

  it('2-player resolution: winner is 1st, loser is last', () => {
    let state = blockedState(2);
    state = applyAllBlockedShifumiChoice(state, 'p0', 'scissors');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'rock');
    // p1 wins, p0 is last
    expect(state.phase).toBe('finished');
    expect(state.finishOrder).toEqual(['p1', 'p0']);
  });

  it('survivors: reduces to surviving players when 2+ survive', () => {
    // 4 players: p0=rock, p1=paper, p2=paper, p3=rock
    // 2 distinct choices: rock and paper. Paper beats rock.
    // Survivors: p1, p2 (paper). p0, p3 eliminated... wait no.
    // Actually survivors are the ones with the winning choice.
    // Winners: p1, p2 (paper). But they don't "win" yet — they move to next round.
    let state = blockedState(4);
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'paper');
    state = applyAllBlockedShifumiChoice(state, 'p2', 'paper');
    state = applyAllBlockedShifumiChoice(state, 'p3', 'rock');
    // Paper beats rock → p1 and p2 survive this round
    expect(state.pendingAction?.type).toBe('allBlockedShifumi');
    if (state.pendingAction?.type === 'allBlockedShifumi') {
      expect(state.pendingAction.playerIds).toEqual(['p1', 'p2']);
      expect(state.pendingAction.choices).toEqual({});
    }
  });

  it('logs allBlockedShifumiResolved and gameOver on final resolution', () => {
    let state = blockedState(2);
    state = applyAllBlockedShifumiChoice(state, 'p0', 'rock');
    state = applyAllBlockedShifumiChoice(state, 'p1', 'scissors');
    expect(state.log.some((l) => l.type === 'allBlockedShifumiResolved')).toBe(true);
    expect(state.log.some((l) => l.type === 'gameOver')).toBe(true);
  });
});
