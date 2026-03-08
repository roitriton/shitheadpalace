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

describe('Lobby', () => {
  let lobbyInstance: Lobby;

  beforeEach(() => {
    lobbyInstance = new Lobby();
  });

  describe('createRoom', () => {
    it('creates a public room with join code', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: true });
      expect(room.id).toBeTruthy();
      expect(room.config.isPublic).toBe(true);
      expect(room.config.joinCode).toBeTruthy();
      expect(room.config.joinCode).toHaveLength(6);
      expect(room.config.maxPlayers).toBe(3);
    });

    it('creates a private room with join code', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: false });
      expect(room.config.isPublic).toBe(false);
      expect(room.config.joinCode).toBeTruthy();
      expect(room.config.joinCode).toHaveLength(6);
    });

    it('allows custom maxPlayers', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { maxPlayers: 4 });
      expect(room.config.maxPlayers).toBe(4);
    });
  });

  describe('getRoom', () => {
    it('returns room by ID', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT);
      expect(lobbyInstance.getRoom(room.id)).toBe(room);
    });

    it('returns undefined for unknown ID', () => {
      expect(lobbyInstance.getRoom('unknown')).toBeUndefined();
    });
  });

  describe('getRoomByCode', () => {
    it('finds private room by code', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: false });
      const found = lobbyInstance.getRoomByCode(room.config.joinCode!);
      expect(found).toBe(room);
    });

    it('finds public room by code', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: true });
      const found = lobbyInstance.getRoomByCode(room.config.joinCode!);
      expect(found).toBe(room);
    });

    it('returns undefined for unknown code', () => {
      expect(lobbyInstance.getRoomByCode('ABCDEF')).toBeUndefined();
    });

    it('does not find started rooms by code', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: false });
      room.addPlayer('user-1', 'Alice', 'socket-1');
      room.start();
      expect(lobbyInstance.getRoomByCode(room.config.joinCode!)).toBeUndefined();
    });
  });

  describe('listPublicRooms', () => {
    it('lists only public waiting rooms', () => {
      lobbyInstance.createRoom('user-1', TEST_VARIANT, { isPublic: true });
      lobbyInstance.createRoom('user-2', TEST_VARIANT, { isPublic: false });
      const started = lobbyInstance.createRoom('user-3', TEST_VARIANT, { isPublic: true });
      started.addPlayer('user-3', 'Charlie', 'socket-3');
      started.start();

      const rooms = lobbyInstance.listPublicRooms();
      expect(rooms.length).toBe(1);
      expect(rooms[0]!.config.isPublic).toBe(true);
      expect(rooms[0]!.status).toBe('waiting');
    });
  });

  describe('removeRoom', () => {
    it('removes a room', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT);
      lobbyInstance.removeRoom(room.id);
      expect(lobbyInstance.getRoom(room.id)).toBeUndefined();
      expect(lobbyInstance.roomCount).toBe(0);
    });
  });

  describe('findRoomByUserId', () => {
    it('finds the room a user is in', () => {
      const room = lobbyInstance.createRoom('user-1', TEST_VARIANT);
      room.addPlayer('user-1', 'Alice', 'socket-1');
      expect(lobbyInstance.findRoomByUserId('user-1')).toBe(room);
    });

    it('returns undefined for users not in any room', () => {
      expect(lobbyInstance.findRoomByUserId('unknown')).toBeUndefined();
    });
  });

  describe('roomCount', () => {
    it('tracks count correctly', () => {
      expect(lobbyInstance.roomCount).toBe(0);
      const r1 = lobbyInstance.createRoom('user-1', TEST_VARIANT);
      expect(lobbyInstance.roomCount).toBe(1);
      lobbyInstance.createRoom('user-2', TEST_VARIANT);
      expect(lobbyInstance.roomCount).toBe(2);
      lobbyInstance.removeRoom(r1.id);
      expect(lobbyInstance.roomCount).toBe(1);
    });
  });
});
