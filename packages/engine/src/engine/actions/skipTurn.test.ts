import { describe, it, expect } from 'vitest';
import { applySkipTurn } from './applySkipTurn';
import type { Card, GameState, GameVariant, Player } from '../../types';

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
  powerAssignments: { mirror: '9', burn: '10', skip: '7' },
  playerCount: 2,
  deckCount: 1,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      makePlayer('p0'),
      makePlayer('p1'),
    ],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('applySkipTurn', () => {
  it('pile vide + main [9, J] → skipTurn valide, tour avancé', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [card('9'), card('J', 'spades')] }),
        makePlayer('p1', { hand: [card('5'), card('K')] }),
      ],
    });

    const result = applySkipTurn(state, 'p0');
    expect(result.currentPlayerIndex).toBe(1);
    expect(result.log.length).toBe(2);
    expect(result.log[0]!.type).toBe('skipTurn');
    expect(result.log[1]!.type).toBe('skipTurnEffect');
  });

  it('pile vide + main [9, J, 5] → skipTurn invalide (le 5 est jouable)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [card('9'), card('J', 'spades'), card('5')] }),
        makePlayer('p1', { hand: [card('K')] }),
      ],
    });

    expect(() => applySkipTurn(state, 'p0')).toThrow('Cannot skip turn when you have a legal play available');
  });

  it('pile non vide + main [9, J] → skipTurn invalide (le joueur peut ramasser)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [card('9'), card('J', 'spades')] }),
        makePlayer('p1', { hand: [card('K')] }),
      ],
      pile: [{ cards: [card('K', 'diamonds')], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });

    expect(() => applySkipTurn(state, 'p0')).toThrow('Cannot skip turn when pile is not empty');
  });

  it('rejects skipTurn when it is not the player turn', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [card('9')] }),
        makePlayer('p1', { hand: [card('K')] }),
      ],
    });

    expect(() => applySkipTurn(state, 'p1')).toThrow('It is not your turn');
  });

  it('rejects skipTurn when a pending action is active', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [card('9')] }),
        makePlayer('p1', { hand: [card('K')] }),
      ],
      pendingAction: { type: 'target', launcherId: 'p0' },
    });

    expect(() => applySkipTurn(state, 'p0')).toThrow('Cannot skip turn while a pending action is active');
  });
});
