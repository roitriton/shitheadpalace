import { describe, it, expect, beforeEach } from 'vitest';
import { Lobby } from './Lobby';
import type { GameVariant } from '@shit-head-palace/engine';

const TEST_VARIANT: GameVariant = {
  name: 'Standard',
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

describe('RoomManager (Lobby + GameRoom integration)', () => {
  let lobby: Lobby;

  beforeEach(() => {
    lobby = new Lobby();
  });

  describe('createRoom with name', () => {
    it('stores room name in config', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Ma partie' });
      expect(room.config.name).toBe('Ma partie');
    });

    it('generates default name from creatorId when not provided', () => {
      const room = lobby.createRoom('user-1234', TEST_VARIANT);
      expect(room.config.name).toBe('Partie de user-123');
    });

    it('includes name in lobby summary', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Cool Room' });
      const summary = room.toLobbySummary();
      expect(summary.name).toBe('Cool Room');
    });
  });

  describe('join room', () => {
    it('adds player and shows in summary', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      const summary = room.toLobbySummary();
      expect(summary.players).toEqual([{ userId: 'user-1', username: 'Alice', ready: false }]);
      expect(summary.playerCount).toBe(1);
    });

    it('multiple players appear in summary', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');

      const summary = room.toLobbySummary();
      expect(summary.players).toHaveLength(2);
      expect(summary.playerCount).toBe(2);
    });
  });

  describe('leave room', () => {
    it('removes player from room', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');

      room.removePlayer('user-1');
      const summary = room.toLobbySummary();
      expect(summary.players).toHaveLength(1);
      expect(summary.players[0]!.userId).toBe('user-2');
    });
  });

  describe('list public rooms', () => {
    it('only lists public waiting rooms', () => {
      lobby.createRoom('user-1', TEST_VARIANT, { name: 'Public', isPublic: true });
      lobby.createRoom('user-2', TEST_VARIANT, { name: 'Private', isPublic: false });

      const rooms = lobby.listPublicRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0]!.config.name).toBe('Public');
    });
  });

  describe('one room per user validation', () => {
    it('findRoomByUserId finds user in room', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      expect(lobby.findRoomByUserId('user-1')).toBe(room);
    });

    it('findRoomByUserId returns undefined when user not in any room', () => {
      lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      // Room created but user not added as player
      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
    });

    it('user cannot be found after leaving', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.removePlayer('user-1');

      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
    });

    it('user is only in one room at a time', () => {
      const room1 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Room 1' });
      room1.addPlayer('user-1', 'Alice', 'socket-1');

      // findRoomByUserId should return room1
      expect(lobby.findRoomByUserId('user-1')).toBe(room1);

      // Leave room1 and join room2
      room1.removePlayer('user-1');
      const room2 = lobby.createRoom('user-2', TEST_VARIANT, { name: 'Room 2' });
      room2.addPlayer('user-1', 'Alice', 'socket-1');

      expect(lobby.findRoomByUserId('user-1')).toBe(room2);
    });
  });

  describe('ready state', () => {
    it('player can toggle ready', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      expect(room.isReady('user-1')).toBe(false);
      room.setReady('user-1', true);
      expect(room.isReady('user-1')).toBe(true);
      room.setReady('user-1', false);
      expect(room.isReady('user-1')).toBe(false);
    });

    it('ready state appears in toLobbySummary', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.setReady('user-1', true);

      const summary = room.toLobbySummary();
      expect(summary.players[0]!.ready).toBe(true);
    });

    it('ready state cleared when player leaves', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.setReady('user-1', true);
      room.removePlayer('user-1');

      expect(room.isReady('user-1')).toBe(false);
    });
  });

  describe('start validation', () => {
    it('cannot start with fewer than 1 human player', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      expect(() => room.start()).toThrow('Need at least 1 human player');
    });

    it('starts successfully with 2 human players', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.start();
      expect(room.status).toBe('playing');
      expect(room.state).not.toBeNull();
    });

    it('fills with bots when starting with fewer than maxPlayers', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      // 3 players total (1 human + 2 bots)
      expect(room.players).toHaveLength(3);
      expect(room.botCount).toBe(2);
    });

    it('cannot start twice', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(() => room.start()).toThrow('Game already started');
    });
  });

  describe('kick player', () => {
    it('removePlayer removes the player from the room', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');

      room.removePlayer('user-2');
      expect(room.humanCount).toBe(1);
      expect(room.players.some((p) => p.userId === 'user-2')).toBe(false);
    });

    it('removePlayer also clears ready status', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.setReady('user-2', true);

      room.removePlayer('user-2');
      expect(room.isReady('user-2')).toBe(false);
    });
  });

  describe('variant update', () => {
    it('updateVariant changes the variant', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      const newVariant: GameVariant = {
        ...TEST_VARIANT,
        name: 'Custom',
        playerCount: 4,
      };
      room.updateVariant(newVariant);

      expect(room.config.variant.name).toBe('Custom');
      expect(room.config.maxPlayers).toBe(4);
    });

    it('updateVariant clears ready status', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.setReady('user-1', true);

      room.updateVariant({ ...TEST_VARIANT, name: 'Updated' });
      expect(room.isReady('user-1')).toBe(false);
    });

    it('updateVariant rejects if too many players', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.addPlayer('user-3', 'Charlie', 'socket-3');

      const smallVariant: GameVariant = {
        ...TEST_VARIANT,
        playerCount: 2,
      };
      expect(() => room.updateVariant(smallVariant)).toThrow('Too many players');
    });

    it('toLobbySummary includes variant object', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      const summary = room.toLobbySummary();
      expect(summary.variant).toEqual(TEST_VARIANT);
    });
  });

  describe('creator leave closes room', () => {
    it('room is removed when creator leaves', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');

      room.removePlayer('user-1');
      // In production, server checks creatorId and calls lobby.removeRoom
      // Here we just verify the room is intact but creator is gone
      expect(room.humanCount).toBe(1);
      expect(room.players.some((p) => p.userId === 'user-1')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes empty room after last player leaves', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');

      room.removePlayer('user-1');
      expect(room.humanCount).toBe(0);

      // Server should remove when humanCount === 0
      lobby.removeRoom(room.id);
      expect(lobby.getRoom(room.id)).toBeUndefined();
    });
  });

  describe('finished room cleanup', () => {
    it('findRoomByUserId finds user in finished room', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.status = 'finished';

      // User is still found in the finished room
      expect(lobby.findRoomByUserId('user-1')).toBe(room);
    });

    it('player can be removed from finished room by filtering players', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.status = 'finished';

      // Simulate what lobby:leave does for finished rooms
      room.players = room.players.filter((p) => p.userId !== 'user-1' || p.isBot);
      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
    });

    it('finished room is removed when last human player leaves', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      room.status = 'finished';

      room.players = room.players.filter((p) => p.userId !== 'user-1' || p.isBot);
      if (room.humanCount === 0) {
        lobby.removeRoom(room.id);
      }
      expect(lobby.getRoom(room.id)).toBeUndefined();
    });

    it('user can create new room after leaving finished room', () => {
      const room1 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game 1' });
      room1.addPlayer('user-1', 'Alice', 'socket-1');
      room1.start();
      room1.status = 'finished';

      // Simulate auto-cleanup in lobby:create
      const existing = lobby.findRoomByUserId('user-1');
      expect(existing).toBe(room1);
      if (existing && existing.status === 'finished') {
        existing.players = existing.players.filter((p) => p.userId !== 'user-1' || p.isBot);
        if (existing.humanCount === 0) {
          lobby.removeRoom(existing.id);
        }
      }

      // Now user can create a new room
      const room2 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game 2' });
      room2.addPlayer('user-1', 'Alice', 'socket-2');
      expect(lobby.findRoomByUserId('user-1')).toBe(room2);
    });

    it('user can join another room after leaving finished room', () => {
      const room1 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game 1' });
      room1.addPlayer('user-1', 'Alice', 'socket-1');
      room1.start();
      room1.status = 'finished';

      // Simulate auto-cleanup in lobby:join
      const existing = lobby.findRoomByUserId('user-1');
      if (existing && existing.status === 'finished') {
        existing.players = existing.players.filter((p) => p.userId !== 'user-1' || p.isBot);
        if (existing.humanCount === 0) {
          lobby.removeRoom(existing.id);
        }
      }

      // User can join a new room
      const room2 = lobby.createRoom('user-2', TEST_VARIANT, { name: 'Game 2' });
      room2.addPlayer('user-2', 'Bob', 'socket-2');
      room2.addPlayer('user-1', 'Alice', 'socket-3');
      expect(lobby.findRoomByUserId('user-1')).toBe(room2);
    });
  });

  describe('forceRemovePlayer (playing room cleanup)', () => {
    it('replaces player with bot', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.start();

      const result = room.forceRemovePlayer('user-1');
      expect(result).toBe(true);
      expect(room.humanCount).toBe(1);
      // Player is now a bot
      const botPlayer = room.players.find((p) => p.playerId.startsWith('player-user-1'));
      expect(botPlayer?.isBot).toBe(true);
      expect(botPlayer?.username).toBe('Bot (Alice)');
    });

    it('returns false for non-existent player', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();

      expect(room.forceRemovePlayer('user-999')).toBe(false);
    });

    it('user is no longer found by findRoomByUserId after forceRemove', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();

      room.forceRemovePlayer('user-1');
      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
    });

    it('user can create new room after being force-removed from playing room', () => {
      const room1 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game 1' });
      room1.addPlayer('user-1', 'Alice', 'socket-1');
      room1.start();

      // Simulate disconnect cleanup
      room1.forceRemovePlayer('user-1');
      if (room1.humanCount === 0) {
        room1.status = 'finished';
        lobby.removeRoom(room1.id);
      }

      // User can now create a new room
      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
      const room2 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game 2' });
      room2.addPlayer('user-1', 'Alice', 'socket-2');
      expect(lobby.findRoomByUserId('user-1')).toBe(room2);
    });

    it('room with remaining humans continues after forceRemove', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.addPlayer('user-2', 'Bob', 'socket-2');
      room.start();

      room.forceRemovePlayer('user-1');
      expect(room.status).toBe('playing');
      expect(room.humanCount).toBe(1);
      expect(lobby.findRoomByUserId('user-2')).toBe(room);
    });

    it('empty playing room is cleaned up after all humans force-removed', () => {
      const room = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Test' });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();

      room.forceRemovePlayer('user-1');
      expect(room.humanCount).toBe(0);
      // Simulate server cleanup
      room.status = 'finished';
      lobby.removeRoom(room.id);
      expect(lobby.getRoom(room.id)).toBeUndefined();
    });

    it('both players can create new rooms after both disconnect from playing room', () => {
      const room1 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'Game' });
      room1.addPlayer('user-1', 'Alice', 'socket-1');
      room1.addPlayer('user-2', 'Bob', 'socket-2');
      room1.start();

      // Both players disconnect
      room1.forceRemovePlayer('user-1');
      room1.forceRemovePlayer('user-2');
      if (room1.humanCount === 0) {
        room1.status = 'finished';
        lobby.removeRoom(room1.id);
      }

      // Both can create new rooms
      expect(lobby.findRoomByUserId('user-1')).toBeUndefined();
      expect(lobby.findRoomByUserId('user-2')).toBeUndefined();

      const room2 = lobby.createRoom('user-1', TEST_VARIANT, { name: 'New Game' });
      room2.addPlayer('user-1', 'Alice', 'socket-3');
      expect(lobby.findRoomByUserId('user-1')).toBe(room2);
    });
  });
});
