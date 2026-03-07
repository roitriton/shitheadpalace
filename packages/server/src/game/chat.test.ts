import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameRoom, type RoomConfig } from './GameRoom';
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

describe('GameRoom chat', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('room-1', makeConfig());
    room.addPlayer('user-1', 'Alice', 'socket-1');
  });

  afterEach(() => {
    room.dispose();
  });

  it('adds a player message with correct fields', () => {
    const msg = room.addChatMessage('user-1', 'Hello!');
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('player');
    expect(msg!.playerName).toBe('Alice');
    expect(msg!.message).toBe('Hello!');
    expect(msg!.playerId).toContain('player-');
    expect(room.chatMessages).toHaveLength(1);
  });

  it('adds a system message', () => {
    const msg = room.addSystemMessage('Alice a rejoint la partie');
    expect(msg.type).toBe('system');
    expect(msg.playerId).toBe('__system__');
    expect(msg.message).toBe('Alice a rejoint la partie');
    expect(room.chatMessages).toHaveLength(1);
  });

  it('rejects message from unknown userId', () => {
    const msg = room.addChatMessage('unknown-user', 'Hello!');
    expect(msg).toBeNull();
    expect(room.chatMessages).toHaveLength(0);
  });

  it('rejects empty message (whitespace only)', () => {
    const msg = room.addChatMessage('user-1', '   ');
    expect(msg).toBeNull();
    expect(room.chatMessages).toHaveLength(0);
  });

  it('rejects message exceeding 200 characters', () => {
    const longMsg = 'a'.repeat(201);
    const msg = room.addChatMessage('user-1', longMsg);
    expect(msg).toBeNull();
    expect(room.chatMessages).toHaveLength(0);
  });

  it('trims whitespace from messages', () => {
    const msg = room.addChatMessage('user-1', '  Hello World  ');
    expect(msg).not.toBeNull();
    expect(msg!.message).toBe('Hello World');
  });

  it('limits chat history to 100 messages', () => {
    for (let i = 0; i < 105; i++) {
      room.addChatMessage('user-1', `Message ${i}`);
    }
    expect(room.chatMessages).toHaveLength(100);
    expect(room.chatMessages[0]!.message).toBe('Message 5');
    expect(room.chatMessages[99]!.message).toBe('Message 104');
  });
});
