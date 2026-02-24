import { describe, it, expect } from 'vitest';
import { appendLog } from './log';
import type { GameState } from '../types';

function emptyState(): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
  };
}

describe('appendLog', () => {
  it('appends one entry to an empty log', () => {
    const state = emptyState();
    const next = appendLog(state, 'play', 0);
    expect(next.log).toHaveLength(1);
    expect(next.log[0]!.type).toBe('play');
  });

  it('generates a deterministic id from position + timestamp + type', () => {
    const state = emptyState();
    const next = appendLog(state, 'pickUp', 42);
    expect(next.log[0]!.id).toBe('0-42-pickUp');
  });

  it('increments the position part of the id on successive calls', () => {
    const state = emptyState();
    const s1 = appendLog(state, 'play', 0);
    const s2 = appendLog(s1, 'pickUp', 0);
    expect(s1.log[0]!.id).toBe('0-0-play');
    expect(s2.log[1]!.id).toBe('1-0-pickUp');
  });

  it('stores playerId and playerName when provided', () => {
    const state = emptyState();
    const next = appendLog(state, 'play', 0, 'p0', 'Alice');
    expect(next.log[0]!.playerId).toBe('p0');
    expect(next.log[0]!.playerName).toBe('Alice');
  });

  it('stores custom data payload', () => {
    const state = emptyState();
    const next = appendLog(state, 'play', 0, 'p0', 'Alice', { cardCount: 3 });
    expect(next.log[0]!.data).toEqual({ cardCount: 3 });
  });

  it('defaults data to an empty object when not provided', () => {
    const state = emptyState();
    const next = appendLog(state, 'ready', 0, 'p0', 'Alice');
    expect(next.log[0]!.data).toEqual({});
  });

  it('does not mutate the input state', () => {
    const state = emptyState();
    appendLog(state, 'play', 0);
    expect(state.log).toHaveLength(0);
  });

  it('preserves existing log entries', () => {
    const state = emptyState();
    const s1 = appendLog(state, 'play', 0, 'p0', 'Alice');
    const s2 = appendLog(s1, 'pickUp', 0, 'p1', 'Bob');
    expect(s2.log).toHaveLength(2);
    expect(s2.log[0]!.type).toBe('play');
    expect(s2.log[1]!.type).toBe('pickUp');
  });

  it('records the correct timestamp', () => {
    const state = emptyState();
    const next = appendLog(state, 'play', 1234567890);
    expect(next.log[0]!.timestamp).toBe(1234567890);
  });
});
