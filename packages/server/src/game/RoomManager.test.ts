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
      expect(summary.players).toEqual([{ userId: 'user-1', username: 'Alice' }]);
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
});
