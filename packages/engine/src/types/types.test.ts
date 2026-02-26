import { describe, it, expect } from 'vitest';
import type { Card, GameState, Player, GameVariant, Suit, Rank } from './index';

describe('Engine types', () => {
  it('Card interface is structurally sound', () => {
    const card: Card = {
      id: 'card-1',
      suit: 'hearts' satisfies Suit,
      rank: 'A' satisfies Rank,
    };
    expect(card.id).toBe('card-1');
    expect(card.suit).toBe('hearts');
    expect(card.rank).toBe('A');
  });

  it('GameVariant has correct default shape', () => {
    const variant: GameVariant = {
      name: 'Standard',
      powerAssignments: {
        burn: '10',
        reset: '2',
        under: '8',
        skip: '7',
        target: 'A',
        mirror: '9',
      },
      playerCount: 4,
      deckCount: 1,
    };
    expect(variant.name).toBe('Standard');
    expect(variant.powerAssignments.burn).toBe('10');
    expect(variant.deckCount).toBe(1);
  });

  it('GameState has required fields', () => {
    const player: Player = {
      id: 'p1',
      name: 'Alice',
      hand: [],
      faceUp: [],
      faceDown: [],
      isFinished: false,
      isBot: false,
    };

    const state: GameState = {
      id: 'game-1',
      phase: 'setup',
      players: [player],
      deck: [],
      pile: [],
      graveyard: [],
      currentPlayerIndex: 0,
      direction: 1,
      turnOrder: [0],
      finishOrder: [],
      variant: {
        name: 'Standard',
        powerAssignments: {},
        playerCount: 1,
        deckCount: 1,
      },
      pendingAction: null,
      log: [],
      lastPowerTriggered: null,
    };

    expect(state.id).toBe('game-1');
    expect(state.phase).toBe('setup');
    expect(state.players).toHaveLength(1);
    expect(state.direction).toBe(1);
    expect(state.pendingAction).toBeNull();
  });

  it('GamePhase values are valid', () => {
    const phases = ['setup', 'swapping', 'playing', 'revolution', 'superRevolution', 'finished'];
    phases.forEach((phase) => {
      expect(typeof phase).toBe('string');
    });
  });
});
