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
    name: 'Test Room',
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

    it('returns false when room is full due to bots', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addBot('easy');
      room.addBot('hard');
      expect(room.canJoin).toBe(false);
    });

    it('returns false when game has started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(room.canJoin).toBe(false);
    });
  });

  // ── addBot / removeBot ────────────────────────────────────────────────────

  describe('addBot / removeBot', () => {
    it('adds a bot with easy difficulty', () => {
      const bot = room.addBot('easy');
      expect(bot.isBot).toBe(true);
      expect(bot.botDifficulty).toBe('easy');
      expect(bot.username).toContain('Facile');
      expect(room.botCount).toBe(1);
      expect(room.players.length).toBe(1);
    });

    it('adds bots with different difficulties', () => {
      room.addBot('easy');
      room.addBot('medium');
      room.addBot('hard');
      expect(room.botCount).toBe(3);
      expect(room.players[0]!.username).toContain('Facile');
      expect(room.players[1]!.username).toContain('Moyen');
      expect(room.players[2]!.username).toContain('Expert');
    });

    it('rejects adding bot when room is full', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addBot('easy');
      room.addBot('hard');
      expect(() => room.addBot('medium')).toThrow('Room is full');
    });

    it('rejects adding bot after game started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(() => room.addBot('easy')).toThrow('Game already started');
    });

    it('removes a bot from the waiting room', () => {
      const bot = room.addBot('easy');
      room.removeBot(bot.userId);
      expect(room.botCount).toBe(0);
      expect(room.players.length).toBe(0);
    });

    it('rejects removing a non-existent bot', () => {
      expect(() => room.removeBot('fake-bot-id')).toThrow('Bot not found');
    });

    it('rejects removing bot after game started', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      const bot = room.addBot('easy');
      room.start();
      expect(() => room.removeBot(bot.userId)).toThrow('Game already started');
    });

    it('blocks human join when bots fill the room', () => {
      room.addBot('easy');
      room.addBot('medium');
      room.addBot('hard');
      expect(() => room.addPlayer('user-1', 'Alice', 'socket-1')).toThrow('Room is full');
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

    it('starts with 1 human + pre-added bots', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addBot('easy');
      room.addBot('hard');
      room.start();
      expect(room.status).toBe('playing');
      expect(room.state).not.toBeNull();
      expect(room.players.length).toBe(3);
      expect(room.humanCount).toBe(1);
      expect(room.botCount).toBe(2);
    });

    it('preserves pre-added bot difficulty in playerDefs', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      const bot = room.addBot('hard');
      room.start();
      const botPlayer = room.state!.players.find((p) => p.id === bot.playerId);
      expect(botPlayer).toBeTruthy();
      expect(botPlayer!.botDifficulty).toBe('hard');
    });

    it('fills remaining slots with easy bots on start', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addBot('hard');
      room.start();
      // 1 human + 1 hard bot + 1 auto-filled easy bot = 3
      expect(room.players.length).toBe(3);
      const autoFilledBot = room.players.find((p) => p.isBot && p.botDifficulty === 'easy');
      expect(autoFilledBot).toBeTruthy();
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

    it('includes bots in player list with isBot flag', () => {
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addBot('easy');
      room.addBot('hard');
      const summary = room.toLobbySummary();
      expect(summary.playerCount).toBe(3);
      expect(summary.players.length).toBe(3);

      const humanPlayer = summary.players.find((p) => !p.isBot);
      expect(humanPlayer).toBeTruthy();
      expect(humanPlayer!.username).toBe('Alice');

      const bots = summary.players.filter((p) => p.isBot);
      expect(bots.length).toBe(2);
      expect(bots[0]!.ready).toBe(true);
      expect(bots[1]!.ready).toBe(true);
      expect(bots[0]!.botDifficulty).toBe('easy');
      expect(bots[1]!.botDifficulty).toBe('hard');
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
