import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameRoom, generateJoinCode, type RoomConfig } from './GameRoom';
import type { GameVariant } from '@shit-head-palace/engine';

const TEST_VARIANT: GameVariant = {
  name: 'Test',
  powerAssignments: {
    burn: '10',
    reset: '2',
    under: '8',
    skip: '7',
    mirror: '9',
    target: 'A',
  },
  playerCount: 3,
  deckCount: 1,
};

function makeConfig(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    maxPlayers: 3,
    variant: TEST_VARIANT,
    isPublic: true,
    joinCode: null,
    creatorId: 'creator-1',
    ...overrides,
  };
}

describe('GameRoom', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('room-1', makeConfig());
  });

  afterEach(() => {
    room.dispose();
  });

  // ── Lobby / joining ────────────────────────────────────────────────────────

  describe('addPlayer / removePlayer', () => {
    it('adds a human player', () => {
      const player = room.addPlayer('user-1', 'Alice', 'socket-1');
      expect(player.userId).toBe('user-1');
      expect(player.username).toBe('Alice');
      expect(player.isBot).toBe(false);
      expect(room.humanCount).toBe(1);
    });

    it('rejects duplicate user', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      expect(() => room.addPlayer('user-1', 'Alice', 'socket-2')).toThrow('Already in this room');
    });

    it('rejects when room is full', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.addPlayer('user-3', 'Charlie', 'socket-3');
      expect(() => room.addPlayer('user-4', 'Dave', 'socket-4')).toThrow('Room is full');
    });

    it('removes a player from waiting room', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.removePlayer('user-1');
      expect(room.humanCount).toBe(0);
    });

    it('rejects adding after game started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(() => room.addPlayer('user-2', 'Bob', 'socket-2')).toThrow('Game already started');
    });

    it('rejects removing after game started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(() => room.removePlayer('user-1')).toThrow('Cannot leave a game in progress');
    });
  });

  // ── canJoin ────────────────────────────────────────────────────────────────

  describe('canJoin', () => {
    it('returns true when room has space and is waiting', () => {
      expect(room.canJoin).toBe(true);
    });

    it('returns false when room is full', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.addPlayer('user-3', 'Charlie', 'socket-3');
      expect(room.canJoin).toBe(false);
    });

    it('returns false when game has started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(room.canJoin).toBe(false);
    });
  });

  // ── fillWithBots ───────────────────────────────────────────────────────────

  describe('fillWithBots', () => {
    it('fills remaining slots with bots', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.fillWithBots();
      expect(room.players.length).toBe(3);
      expect(room.botCount).toBe(2);
    });
  });

  // ── start ──────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('starts the game and sets status to playing', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(room.status).toBe('playing');
      expect(room.state).not.toBeNull();
      expect(room.players.length).toBe(3);
    });

    it('rejects starting without players', () => {
      expect(() => room.start()).toThrow('Need at least 1 human player');
    });

    it('rejects starting twice', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(() => room.start()).toThrow('Game already started');
    });
  });

  // ── getPlayerId ────────────────────────────────────────────────────────────

  describe('getPlayerId', () => {
    it('returns playerId for a valid user', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      const playerId = room.getPlayerId('user-1');
      expect(playerId).toBeTruthy();
      expect(playerId).toContain('player-');
    });

    it('returns null for unknown user', () => {
      expect(room.getPlayerId('unknown')).toBeNull();
    });
  });

  // ── State filtering ────────────────────────────────────────────────────────

  describe('state filtering', () => {
    it('returns null when game not started', () => {
      expect(room.getStateForPlayer('any')).toBeNull();
      expect(room.getStateForSpectator()).toBeNull();
    });

    it('returns filtered state for player after start', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      const playerId = room.getPlayerId('user-1')!;
      const state = room.getStateForPlayer(playerId);
      expect(state).not.toBeNull();
    });

    it('returns spectator state after start', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      const state = room.getStateForSpectator();
      expect(state).not.toBeNull();
    });
  });

  // ── Reconnection ───────────────────────────────────────────────────────────

  describe('disconnect / reconnect', () => {
    it('marks player as disconnected', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.handleDisconnect('user-1');
      const player = room.players.find((p) => p.userId === 'user-1');
      expect(player?.socketId).toBeNull();
      expect(player?.disconnectedAt).toBeTruthy();
    });

    it('reconnects a player before timeout', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.handleDisconnect('user-1');
      const success = room.handleReconnect('user-1', 'socket-2');
      expect(success).toBe(true);
      const player = room.players.find((p) => p.userId === 'user-1');
      expect(player?.socketId).toBe('socket-2');
      expect(player?.disconnectedAt).toBeNull();
    });

    it('replaces with bot after timeout', async () => {
      vi.useFakeTimers();
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.handleDisconnect('user-1');

      vi.advanceTimersByTime(60_001);

      const player = room.players.find((p) => p.userId === 'user-1');
      expect(player?.isBot).toBe(true);
      expect(player?.username).toBe('Bot (Alice)');
      vi.useRealTimers();
    });

    it('does not replace if reconnected in time', () => {
      vi.useFakeTimers();
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.handleDisconnect('user-1');

      vi.advanceTimersByTime(30_000);
      room.handleReconnect('user-1', 'socket-2');
      vi.advanceTimersByTime(31_000);

      const player = room.players.find((p) => p.userId === 'user-1');
      expect(player?.isBot).toBe(false);
      vi.useRealTimers();
    });
  });

  // ── Spectators ─────────────────────────────────────────────────────────────

  describe('spectators', () => {
    it('adds and removes spectators', () => {
      room.addSpectator('spectator-1');
      expect(room.spectatorSocketIds.size).toBe(1);
      room.removeSpectator('spectator-1');
      expect(room.spectatorSocketIds.size).toBe(0);
    });
  });

  // ── toLobbySummary ─────────────────────────────────────────────────────────

  describe('toLobbySummary', () => {
    it('returns correct summary', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      const summary = room.toLobbySummary();
      expect(summary.id).toBe('room-1');
      expect(summary.status).toBe('waiting');
      expect(summary.playerCount).toBe(1);
      expect(summary.maxPlayers).toBe(3);
      expect(summary.variantName).toBe('Test');
      expect(summary.isPublic).toBe(true);
    });
  });
});

describe('generateJoinCode', () => {
  it('returns a 6-character uppercase hex string', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[0-9A-F]{6}$/);
  });
});
