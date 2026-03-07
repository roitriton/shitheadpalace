import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameRoom, type RoomConfig } from './GameRoom';
import type { Card, GameState, GameVariant, Player, PileEntry } from '@shit-head-palace/engine';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TEST_VARIANT: GameVariant = {
  name: 'Test',
  powerAssignments: { mirror: '9', burn: '10' },
  playerCount: 2,
  deckCount: 1,
};

function makeConfig(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    maxPlayers: 2,
    variant: TEST_VARIANT,
    isPublic: true,
    joinCode: null,
    creatorId: 'creator-1',
    name: 'Test Room',
    ...overrides,
  };
}

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

/**
 * Put p0 into flop phase: hand empty, deck empty, faceUp has cards,
 * pile has cards, and it's p0's turn.
 */
function setFlopPhaseForP0(room: GameRoom): void {
  const state = room.state!;
  const p0 = state.players[0]!;
  const p1 = state.players[1]!;

  const flopCards = [card('4', 'spades', 0), card('9', 'hearts', 1), card('Q', 'diamonds', 2)];
  const pileEntry: PileEntry = {
    cards: [card('K', 'clubs', 50)],
    playerId: p1.id,
    playerName: p1.name,
    timestamp: 0,
  };

  const newP0: Player = {
    ...p0,
    hand: [],
    faceUp: flopCards,
    faceDown: [card('3', 'clubs', 99)],
  };
  const newP1: Player = {
    ...p1,
    hand: [card('A', 'hearts', 98)],
  };

  room.state = {
    ...state,
    players: [newP0, newP1],
    deck: [],
    pile: [pileEntry],
    currentPlayerIndex: 0,
    phase: 'playing',
    pendingAction: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pickUpWithFlop via handleAction', () => {
  let room: GameRoom;
  let userId: string;

  beforeEach(() => {
    room = new GameRoom('room-1', makeConfig());
    userId = 'user-1';
    room.addPlayer(userId, 'Alice', 'socket-1');
    room.start();
  });

  afterEach(() => {
    room.dispose();
  });

  it('pickUpWithFlop with empty flopCardIds → regular pile pick-up', () => {
    setFlopPhaseForP0(room);
    const p0Id = room.players[0]!.playerId;

    room.handleAction(userId, { type: 'pickUpWithFlop', flopCardIds: [] });

    const state = room.state!;
    const p0 = state.players.find((p) => p.id === p0Id)!;
    // Pile card (K) moved to hand
    expect(p0.hand).toHaveLength(1);
    expect(p0.hand[0]!.rank).toBe('K');
    // Flop untouched
    expect(p0.faceUp).toHaveLength(3);
    expect(state.pile).toHaveLength(0);
  });

  it('pickUpWithFlop with valid flop card → pile + flop card in hand', () => {
    setFlopPhaseForP0(room);
    const p0Id = room.players[0]!.playerId;
    const f4Id = room.state!.players.find((p) => p.id === p0Id)!.faceUp[0]!.id;

    room.handleAction(userId, { type: 'pickUpWithFlop', flopCardIds: [f4Id] });

    const p0 = room.state!.players.find((p) => p.id === p0Id)!;
    // hand = pile(K) + flop(4) = 2
    expect(p0.hand).toHaveLength(2);
    // flop: 2 remaining
    expect(p0.faceUp).toHaveLength(2);
  });

  it('pickUpWithFlop with different non-mirror ranks → error', () => {
    setFlopPhaseForP0(room);
    const p0Id = room.players[0]!.playerId;
    const p0 = room.state!.players.find((p) => p.id === p0Id)!;
    const f4Id = p0.faceUp[0]!.id; // 4
    const fQId = p0.faceUp[2]!.id; // Q

    expect(() => {
      room.handleAction(userId, { type: 'pickUpWithFlop', flopCardIds: [f4Id, fQId] });
    }).toThrow(/same rank/);
  });

  it('pickUpWithFlop with card + mirror → valid', () => {
    setFlopPhaseForP0(room);
    const p0Id = room.players[0]!.playerId;
    const p0 = room.state!.players.find((p) => p.id === p0Id)!;
    const f4Id = p0.faceUp[0]!.id; // 4
    const f9Id = p0.faceUp[1]!.id; // 9 (mirror)

    room.handleAction(userId, { type: 'pickUpWithFlop', flopCardIds: [f4Id, f9Id] });

    const updated = room.state!.players.find((p) => p.id === p0Id)!;
    // hand = pile(K) + 4 + 9 = 3
    expect(updated.hand).toHaveLength(3);
    // flop: Q remains
    expect(updated.faceUp).toHaveLength(1);
  });

  it('pickUpWithFlop clears pile and logs action', () => {
    setFlopPhaseForP0(room);

    room.handleAction(userId, { type: 'pickUpWithFlop', flopCardIds: [] });

    // Pile cleared (action was processed by engine)
    expect(room.state!.pile).toHaveLength(0);
    // Log contains the pickUp entry
    const pickUpLog = room.state!.log.find((l) => l.type === 'pickUp');
    expect(pickUpLog).toBeDefined();
  });
});
