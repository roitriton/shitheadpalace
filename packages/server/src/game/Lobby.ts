import { randomBytes } from 'crypto';
import { GameRoom, generateJoinCode, type RoomConfig } from './GameRoom';
import type { GameVariant } from '@shit-head-palace/engine';

/** In-memory lobby that manages all active game rooms. */
export class Lobby {
  private rooms = new Map<string, GameRoom>();

  /** Create a new game room. Returns the room. */
  createRoom(
    creatorId: string,
    variant: GameVariant,
    options: { isPublic?: boolean; maxPlayers?: number } = {},
  ): GameRoom {
    const id = randomBytes(8).toString('hex');
    const isPublic = options.isPublic ?? true;
    const maxPlayers = options.maxPlayers ?? variant.playerCount;

    const config: RoomConfig = {
      maxPlayers,
      variant,
      isPublic,
      joinCode: isPublic ? null : generateJoinCode(),
      creatorId,
    };

    const room = new GameRoom(id, config);
    this.rooms.set(id, room);
    return room;
  }

  /** Get a room by ID. */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /** Find a room by its join code (for private rooms). */
  getRoomByCode(code: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.config.joinCode === code && room.status === 'waiting') {
        return room;
      }
    }
    return undefined;
  }

  /** List all public rooms that are still in 'waiting' status. */
  listPublicRooms(): GameRoom[] {
    const result: GameRoom[] = [];
    for (const room of this.rooms.values()) {
      if (room.config.isPublic && room.status === 'waiting') {
        result.push(room);
      }
    }
    return result;
  }

  /** Remove a room (after game ends or when empty). */
  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.dispose();
      this.rooms.delete(roomId);
    }
  }

  /** Find which room a user is currently in. */
  findRoomByUserId(userId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.userId === userId && !p.isBot)) {
        return room;
      }
    }
    return undefined;
  }

  /** Get count of active rooms. */
  get roomCount(): number {
    return this.rooms.size;
  }
}

/** Singleton lobby instance. */
export const lobby = new Lobby();
