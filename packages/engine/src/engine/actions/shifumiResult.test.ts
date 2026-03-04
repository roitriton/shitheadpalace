import { describe, it, expect } from 'vitest';
import { applyShifumiChoice, resolveShifumiResult } from './applyShifumiChoice';
import { applyFirstPlayerShifumiChoice } from './ready';
import type { Card, GameState, GameVariant, PendingShifumiResult, PendingShifumi, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
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

const variant: GameVariant = {
  name: 'test',
  powerAssignments: { mirror: '9' },
  playerCount: 4,
  deckCount: 1,
};

const cK = card('K');
const c5 = card('5', 'spades', 9);

function makeState(overrides: Partial<GameState> = {}): GameState {
  const players = [
    makePlayer('p0', { hand: [c5] }),
    makePlayer('p1', { hand: [c5] }),
    makePlayer('p2', { hand: [c5] }),
    makePlayer('p3', { hand: [c5] }),
  ];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile: [{ cards: [cK], playerId: 'p2', playerName: 'p2', timestamp: 0 }],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2, 3],
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

function stateReadyForChoices(type: 'shifumi' | 'superShifumi' = 'shifumi'): GameState {
  return makeState({
    pendingAction: { type, initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' },
  });
}

// ─── PendingShifumiResult production ─────────────────────────────────────────

describe('PendingShifumiResult', () => {

  describe('production after both choices', () => {
    it('produces a PendingShifumiResult instead of directly resolving (normal win)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      // Should be a PendingShifumiResult, not immediately resolved
      expect(s2.pendingAction).not.toBeNull();
      expect(s2.pendingAction!.type).toBe('shifumiResult');
      const result = s2.pendingAction as PendingShifumiResult;
      expect(result.player1Id).toBe('p1');
      expect(result.player2Id).toBe('p2');
      expect(result.player1Choice).toBe('rock');
      expect(result.player2Choice).toBe('scissors');
      expect(result.result).toBe('player1'); // rock beats scissors
      expect(result.shifumiType).toBe('normal');
    });

    it('produces a PendingShifumiResult for a tie', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock');
      expect(s2.pendingAction!.type).toBe('shifumiResult');
      const result = s2.pendingAction as PendingShifumiResult;
      expect(result.result).toBe('tie');
    });

    it('produces a PendingShifumiResult for super shifumi', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices('superShifumi'), 'p1', 'paper');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock');
      expect(s2.pendingAction!.type).toBe('shifumiResult');
      const result = s2.pendingAction as PendingShifumiResult;
      expect(result.result).toBe('player1'); // paper beats rock
      expect(result.shifumiType).toBe('super');
    });

    it('stores correct player names from the game state', () => {
      const state = makeState({
        players: [
          makePlayer('p0', { name: 'Alice', hand: [c5] }),
          makePlayer('p1', { name: 'Bob', hand: [c5] }),
          makePlayer('p2', { name: 'Charlie', hand: [c5] }),
          makePlayer('p3', { name: 'Diana', hand: [c5] }),
        ],
        pendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' } as PendingShifumi,
      });
      const s1 = applyShifumiChoice(state, 'p1', 'scissors');
      const s2 = applyShifumiChoice(s1, 'p2', 'paper');
      const result = s2.pendingAction as PendingShifumiResult;
      expect(result.player1Name).toBe('Bob');
      expect(result.player2Name).toBe('Charlie');
      expect(result.result).toBe('player1'); // scissors beats paper
    });
  });

  describe('resolveShifumiResult — normal shifumi', () => {
    it('loser picks up the pile after resolving (player1 wins)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors'); // p1 wins
      expect(s2.pendingAction!.type).toBe('shifumiResult');
      const s3 = resolveShifumiResult(s2);
      // p2 (loser) picks up pile
      const p2 = s3.players.find((p) => p.id === 'p2')!;
      expect(p2.hand).toEqual(expect.arrayContaining([cK]));
      expect(s3.pile).toHaveLength(0);
      expect(s3.pendingAction).toBeNull();
    });

    it('loser picks up the pile after resolving (player2 wins)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'paper'); // p2 wins
      const s3 = resolveShifumiResult(s2);
      // p1 (loser) picks up pile
      const p1 = s3.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toEqual(expect.arrayContaining([cK]));
      expect(s3.pile).toHaveLength(0);
    });

    it('advances the turn after resolving', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      // Turn advances from initiator (p0, index 0) → next is index 1
      expect(s3.currentPlayerIndex).toBe(1);
    });

    it('logs a shifumiResolved entry after resolving', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      expect(s3.log.some((l) => l.type === 'shifumiResolved')).toBe(true);
    });
  });

  describe('resolveShifumiResult — tie', () => {
    it('resets choices and keeps same combatants after resolving a tie', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock');
      const s3 = resolveShifumiResult(s2);
      // Should be back to PendingShifumi with same players, no choices
      expect(s3.pendingAction!.type).toBe('shifumi');
      const pending = s3.pendingAction as PendingShifumi;
      expect(pending.player1Id).toBe('p1');
      expect(pending.player2Id).toBe('p2');
      expect(pending.player1Choice).toBeUndefined();
      expect(pending.player2Choice).toBeUndefined();
    });

    it('logs a shifumiTie entry', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'scissors');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      expect(s3.log.some((l) => l.type === 'shifumiTie')).toBe(true);
    });

    it('allows new round after tie resolution → final win resolves correctly', () => {
      // Round 1: tie
      let state = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      state = applyShifumiChoice(state, 'p2', 'rock');
      state = resolveShifumiResult(state); // back to PendingShifumi
      // Round 2: p2 wins (paper beats rock)
      state = applyShifumiChoice(state, 'p1', 'rock');
      state = applyShifumiChoice(state, 'p2', 'paper');
      expect(state.pendingAction!.type).toBe('shifumiResult');
      state = resolveShifumiResult(state);
      // p1 loses, picks up pile
      const p1 = state.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toEqual(expect.arrayContaining([cK]));
      expect(state.pendingAction).toBeNull();
    });
  });

  describe('resolveShifumiResult — super shifumi', () => {
    it('declares loser as Shit Head and ends the game', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices('superShifumi'), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      expect(s3.phase).toBe('finished');
      const p2 = s3.players.find((p) => p.id === 'p2')!;
      expect(p2.isShitHead).toBe(true);
      expect(p2.isFinished).toBe(true);
    });

    it('shit head is last in finishOrder', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices('superShifumi'), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      const last = s3.finishOrder[s3.finishOrder.length - 1];
      expect(last).toBe('p2');
    });

    it('logs superShifumiResolved and gameOver entries', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices('superShifumi'), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      expect(s3.log.some((l) => l.type === 'superShifumiResolved')).toBe(true);
      expect(s3.log.some((l) => l.type === 'gameOver')).toBe(true);
    });
  });

  describe('resolveShifumiResult — first-player shifumi (2-player)', () => {
    function swappingState(): GameState {
      const players = [
        makePlayer('p0', { hand: [card('3', 'hearts', 0)], isReady: true }),
        makePlayer('p1', { hand: [card('3', 'spades', 1)], isReady: true }),
      ];
      return {
        id: 'g1',
        phase: 'swapping' as const,
        players,
        deck: [],
        pile: [],
        graveyard: [],
        currentPlayerIndex: 0,
        direction: 1 as const,
        turnOrder: [],
        finishOrder: [],
        variant,
        pendingAction: {
          type: 'firstPlayerShifumi' as const,
          playerIds: ['p0', 'p1'],
          choices: {},
        },
        log: [],
        lastPowerTriggered: null,
      };
    }

    it('produces PendingShifumiResult with shifumiType firstPlayer', () => {
      let state = applyFirstPlayerShifumiChoice(swappingState(), 'p0', 'rock');
      state = applyFirstPlayerShifumiChoice(state, 'p1', 'scissors');
      expect(state.pendingAction!.type).toBe('shifumiResult');
      const result = state.pendingAction as PendingShifumiResult;
      expect(result.shifumiType).toBe('firstPlayer');
      expect(result.result).toBe('player1'); // rock beats scissors → p0 wins
    });

    it('resolveShifumiResult starts the game with the winner as first player', () => {
      let state = applyFirstPlayerShifumiChoice(swappingState(), 'p0', 'rock');
      state = applyFirstPlayerShifumiChoice(state, 'p1', 'scissors');
      state = resolveShifumiResult(state);
      expect(state.phase).toBe('playing');
      expect(state.pendingAction).toBeNull();
      // p0 won → should be first player
      expect(state.players[state.currentPlayerIndex]!.id).toBe('p0');
    });

    it('resolveShifumiResult on tie resets to firstPlayerShifumi', () => {
      let state = applyFirstPlayerShifumiChoice(swappingState(), 'p0', 'paper');
      state = applyFirstPlayerShifumiChoice(state, 'p1', 'paper');
      expect(state.pendingAction!.type).toBe('shifumiResult');
      state = resolveShifumiResult(state);
      // Should reset to firstPlayerShifumi
      expect(state.pendingAction!.type).toBe('firstPlayerShifumi');
    });
  });

  describe('resolveShifumiResult — guards', () => {
    it('throws when no pending shifumiResult action', () => {
      const state = makeState();
      expect(() => resolveShifumiResult(state)).toThrow('No pending shifumiResult action');
    });
  });
});
