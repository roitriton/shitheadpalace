import { describe, it, expect } from 'vitest';
import { createInitialGameState, type PlayerSetup } from './gameInit';
import { CARDS_PER_ZONE } from './deal';
import type { GameVariant } from '../types';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const STANDARD_VARIANT: GameVariant = {
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

const FOUR_PLAYERS: PlayerSetup[] = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
  { id: 'p3', name: 'Charlie', isBot: true, botDifficulty: 'easy' },
  { id: 'p4', name: 'Diana', isBot: true, botDifficulty: 'hard' },
];

const TWO_PLAYERS: PlayerSetup[] = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
];

// ─── createInitialGameState ───────────────────────────────────────────────────

describe('createInitialGameState', () => {
  // ── Identity ────────────────────────────────────────────────────────────────

  it('assigns the provided game id', () => {
    const state = createInitialGameState('game-xyz', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.id).toBe('game-xyz');
  });

  it('attaches the variant unchanged', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.variant).toEqual(STANDARD_VARIANT);
  });

  // ── Phase ───────────────────────────────────────────────────────────────────

  it("starts in the 'swapping' phase", () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.phase).toBe('swapping');
  });

  // ── Players ─────────────────────────────────────────────────────────────────

  it('creates the correct number of players', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.players).toHaveLength(4);
  });

  it('preserves player id, name, and isBot flag', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.players[0]!.id).toBe('p1');
    expect(state.players[0]!.name).toBe('Alice');
    expect(state.players[0]!.isBot).toBe(false);
    expect(state.players[2]!.isBot).toBe(true);
  });

  it('preserves botDifficulty when provided', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.players[2]!.botDifficulty).toBe('easy');
    expect(state.players[3]!.botDifficulty).toBe('hard');
  });

  it('leaves botDifficulty undefined for human players', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.players[0]!.botDifficulty).toBeUndefined();
  });

  it('sets isFinished = false for every player', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    for (const p of state.players) expect(p.isFinished).toBe(false);
  });

  // ── Card distribution ────────────────────────────────────────────────────────

  it('deals exactly 3 cards to each zone per player', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    for (const p of state.players) {
      expect(p.hand).toHaveLength(CARDS_PER_ZONE);
      expect(p.faceUp).toHaveLength(CARDS_PER_ZONE);
      expect(p.faceDown).toHaveLength(CARDS_PER_ZONE);
    }
  });

  it('leaves the correct number of cards in the draw pile (4 players, 1 deck)', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.deck).toHaveLength(52 - 4 * 9);
  });

  it('contains every card exactly once across all zones (no duplicates, no losses)', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    const allCards = [
      ...state.deck,
      ...state.players.flatMap((p) => [...p.hand, ...p.faceUp, ...p.faceDown]),
    ];
    expect(allCards).toHaveLength(52);
    expect(new Set(allCards.map((c) => c.id)).size).toBe(52);
  });

  // ── Initial state fields ──────────────────────────────────────────────────────

  it('initializes pile as an empty array', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.pile).toHaveLength(0);
  });

  it('initializes graveyard as an empty array', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.graveyard).toHaveLength(0);
  });

  it('initializes finishOrder as an empty array', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.finishOrder).toHaveLength(0);
  });

  it('initializes log as an empty array', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.log).toHaveLength(0);
  });

  it('sets direction to 1 (clockwise)', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.direction).toBe(1);
  });

  it('sets pendingAction to null', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.pendingAction).toBeNull();
  });

  it('initializes currentPlayerIndex to 0 (first player TBD at ready phase)', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('initializes turnOrder as [0, 1, …, n-1]', () => {
    const state = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(state.turnOrder).toEqual([0, 1, 2, 3]);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────────

  it('works with the minimum of 2 players', () => {
    const state = createInitialGameState('g1', TWO_PLAYERS, STANDARD_VARIANT);
    expect(state.players).toHaveLength(2);
    expect(state.deck).toHaveLength(52 - 2 * 9);
  });

  it('works with 2 decks (large game)', () => {
    const variant2: GameVariant = { ...STANDARD_VARIANT, deckCount: 2 };
    const state = createInitialGameState('g1', FOUR_PLAYERS, variant2);
    const allCards = [
      ...state.deck,
      ...state.players.flatMap((p) => [...p.hand, ...p.faceUp, ...p.faceDown]),
    ];
    expect(allCards).toHaveLength(104);
    expect(new Set(allCards.map((c) => c.id)).size).toBe(104);
  });

  it('generates independent states on successive calls (not shared references)', () => {
    const s1 = createInitialGameState('g1', FOUR_PLAYERS, STANDARD_VARIANT);
    const s2 = createInitialGameState('g2', FOUR_PLAYERS, STANDARD_VARIANT);
    expect(s1.deck).not.toBe(s2.deck);
    expect(s1.players).not.toBe(s2.players);
  });

  // ── Validation errors ─────────────────────────────────────────────────────────

  it('throws when fewer than 2 players are provided', () => {
    const onePlayer: PlayerSetup[] = [{ id: 'p1', name: 'Solo', isBot: false }];
    expect(() => createInitialGameState('g1', onePlayer, STANDARD_VARIANT)).toThrow(/2 players/);
  });

  it('throws when the deck has insufficient cards for the player count', () => {
    // 6 players × 9 cards = 54 needed; 1 deck = 52 cards
    const sixPlayers: PlayerSetup[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      isBot: false,
    }));
    expect(() => createInitialGameState('g1', sixPlayers, STANDARD_VARIANT)).toThrow();
  });
});
