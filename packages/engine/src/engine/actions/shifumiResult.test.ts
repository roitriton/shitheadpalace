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
const cJC = card('J', 'clubs', 1);
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

    it('advances the turn after resolving (from loser position)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const s3 = resolveShifumiResult(s2);
      // p2 (index 2) loses and picks up → turn advances from p2 → next is p3 (index 3)
      expect(s3.currentPlayerIndex).toBe(3);
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

  describe('resolveShifumiResult — turn advances from loser (3 players)', () => {
    it('turn goes to player after loser, not after launcher', () => {
      // 3 players: Human (p0), Bot A (p1), Bot B (p2)
      // Bot B (p2) played J♣, shifumi between p1 and p2, p1 loses and picks up
      // Next = player AFTER loser (p1) = p2 (Bot B)
      const state = makeState({
        players: [
          makePlayer('p0', { name: 'Human', hand: [c5] }),
          makePlayer('p1', { name: 'BotA', hand: [c5] }),
          makePlayer('p2', { name: 'BotB', hand: [c5] }),
        ],
        pile: [
          { cards: [cK], playerId: 'p0', playerName: 'Human', timestamp: 0 },
          { cards: [cJC], playerId: 'p2', playerName: 'BotB', timestamp: 1 },
        ],
        currentPlayerIndex: 2, // Bot B is the launcher
        turnOrder: [0, 1], // Human, Bot A
        pendingAction: {
          type: 'shifumiResult',
          player1Id: 'p1',
          player1Name: 'BotA',
          player1Choice: 'scissors',
          player2Id: 'p2',
          player2Name: 'BotB',
          player2Choice: 'rock',
          result: 'player2', // Bot B wins, Bot A (p1) loses
          shifumiType: 'normal',
          _savedPendingAction: { type: 'shifumi', initiatorId: 'p2', player1Id: 'p1', player2Id: 'p2' } as PendingShifumi,
          _savedInitiatorId: 'p2',
        } as PendingShifumiResult,
        pendingCemeteryTransit: true,
      });

      const next = resolveShifumiResult(state);

      // Turn should go to Bot B (p2), the player AFTER Bot A (loser)
      expect(next.currentPlayerIndex).toBe(2);
      expect(next.players[next.currentPlayerIndex]!.id).toBe('p2');
      // pendingCemeteryTransit resolved: J♣ sent to graveyard
      expect(next.pendingCemeteryTransit).toBeFalsy();
      expect(next.graveyard).toHaveLength(1);
      expect(next.graveyard[0]!.rank).toBe('J');
      // Bot A (loser) picked up remaining pile (cK, without J♣)
      const botA = next.players.find((p) => p.id === 'p1')!;
      expect(botA.hand).toHaveLength(2); // original c5 + pile cK
    });

    it('turn goes to player after loser even when launcher is between them', () => {
      // Players: p0 (launcher), p1 (loser), p2 (bystander)
      // p0 plays J♣ → shifumi between p0 and p1 → p1 loses
      // Next = player AFTER p1 = p2
      const state = makeState({
        players: [
          makePlayer('p0', { name: 'Launcher', hand: [c5] }),
          makePlayer('p1', { name: 'Loser', hand: [c5] }),
          makePlayer('p2', { name: 'Bystander', hand: [c5] }),
        ],
        currentPlayerIndex: 0, // p0 is the launcher
        turnOrder: [1, 2],
        pendingAction: {
          type: 'shifumiResult',
          player1Id: 'p0',
          player1Name: 'Launcher',
          player1Choice: 'rock',
          player2Id: 'p1',
          player2Name: 'Loser',
          player2Choice: 'scissors',
          result: 'player1', // p0 wins, p1 loses
          shifumiType: 'normal',
          _savedPendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p0', player2Id: 'p1' } as PendingShifumi,
          _savedInitiatorId: 'p0',
        } as PendingShifumiResult,
        pendingCemeteryTransit: true,
      });

      const next = resolveShifumiResult(state);

      // Turn should go to p2 (player AFTER loser p1)
      expect(next.currentPlayerIndex).toBe(2);
      expect(next.players[next.currentPlayerIndex]!.id).toBe('p2');
    });

    it('launcher replays when they are right after the loser in turn order', () => {
      // Players: p0 (launcher), p1 (bystander), p2 (loser)
      // p0 plays J♣ → shifumi between p1 and p2 → p2 loses
      // Next = player AFTER p2 = p0 (launcher replays)
      const state = makeState({
        players: [
          makePlayer('p0', { name: 'Launcher', hand: [c5] }),
          makePlayer('p1', { name: 'Bystander', hand: [c5] }),
          makePlayer('p2', { name: 'Loser', hand: [c5] }),
        ],
        currentPlayerIndex: 0,
        turnOrder: [1, 2],
        pendingAction: {
          type: 'shifumiResult',
          player1Id: 'p1',
          player1Name: 'Bystander',
          player1Choice: 'rock',
          player2Id: 'p2',
          player2Name: 'Loser',
          player2Choice: 'scissors',
          result: 'player1', // p1 wins, p2 loses
          shifumiType: 'normal',
          _savedPendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' } as PendingShifumi,
          _savedInitiatorId: 'p0',
        } as PendingShifumiResult,
        pendingCemeteryTransit: true,
      });

      const next = resolveShifumiResult(state);

      // Turn should go to p0 (launcher), who is after loser p2 in turn order
      expect(next.currentPlayerIndex).toBe(0);
      expect(next.players[next.currentPlayerIndex]!.id).toBe('p0');
    });
  });
});
