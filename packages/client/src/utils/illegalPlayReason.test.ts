import { describe, it, expect } from 'vitest';
import type { Card, GameState, PileEntry } from '@shit-head-palace/engine';
import { createVariant } from '@shit-head-palace/engine';
import { getIllegalPlayReason } from './illegalPlayReason';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'p1', playerName: 'P1', timestamp: 0 };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      { id: 'p1', name: 'P1', hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false },
      { id: 'p2', name: 'P2', hand: [], faceUp: [], faceDown: [], isFinished: false, isBot: false },
    ],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: createVariant(),
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('getIllegalPlayReason', () => {
  // ── Cas 1 — Valeur trop basse ──────────────────────────────────────────────

  it('returns "Il faut jouer ≥ Roi" when a 3 is played on a King', () => {
    const state = makeState({ pile: [pileEntry([card('K')])] });
    expect(getIllegalPlayReason([card('3')], state, 'p1')).toBe('Il faut jouer ≥ Roi');
  });

  it('returns "Il faut jouer ≥ Dame" when a 5 is played on a Queen', () => {
    const state = makeState({ pile: [pileEntry([card('Q')])] });
    expect(getIllegalPlayReason([card('5')], state, 'p1')).toBe('Il faut jouer ≥ Dame');
  });

  it('returns correct message for multiple cards of same value too low', () => {
    const state = makeState({ pile: [pileEntry([card('K')])] });
    expect(getIllegalPlayReason([card('4', 'hearts'), card('4', 'spades')], state, 'p1')).toBe('Il faut jouer ≥ Roi');
  });

  // ── Cas 2 — Révolution active ──────────────────────────────────────────────

  it('returns revolution message when value is too high during revolution', () => {
    const state = makeState({
      phase: 'revolution',
      pile: [pileEntry([card('5')])],
    });
    expect(getIllegalPlayReason([card('K')], state, 'p1')).toBe('Il faut jouer ≤ 5 (révolution)');
  });

  it('returns revolution message with rank name for face cards', () => {
    const state = makeState({
      phase: 'superRevolution',
      pile: [pileEntry([card('Q')])],
    });
    expect(getIllegalPlayReason([card('K')], state, 'p1')).toBe('Il faut jouer ≤ Dame (révolution)');
  });

  // ── Cas 3 — Under actif ───────────────────────────────────────────────────

  it('returns under message when value is too high under constraint', () => {
    const state = makeState({
      pile: [pileEntry([card('3')])],
      activeUnder: 8, // must play ≤ 8
    });
    expect(getIllegalPlayReason([card('K')], state, 'p1')).toBe('Il faut jouer ≤ 8 (under)');
  });

  // ── Cas 4 — Mirror seul ───────────────────────────────────────────────────

  it('returns mirror message when only mirrors are selected', () => {
    const state = makeState({ pile: [pileEntry([card('5')])] });
    // Default variant: mirror = '9'
    expect(getIllegalPlayReason([card('9')], state, 'p1')).toBe(
      "Il faut jouer Mirror en accompagnement d'une autre valeur",
    );
  });

  // ── Cas 5 — Pouvoir unique sur pile vide ───────────────────────────────────

  it('returns unique power on empty pile message', () => {
    const state = makeState({ pile: [] });
    expect(getIllegalPlayReason([card('J', 'diamonds')], state, 'p1')).toBe(
      'Cette carte ne se joue pas dans une pile vide. Jamais à sec',
    );
  });

  // ── Coups légaux → null ────────────────────────────────────────────────────

  it('returns null for an empty selection', () => {
    const state = makeState({ pile: [pileEntry([card('5')])] });
    expect(getIllegalPlayReason([], state, 'p1')).toBeNull();
  });

  it('returns null for a legal play (higher value)', () => {
    const state = makeState({ pile: [pileEntry([card('5')])] });
    expect(getIllegalPlayReason([card('K')], state, 'p1')).toBeNull();
  });

  it('returns null when under is active and value is valid (≤)', () => {
    const state = makeState({
      pile: [pileEntry([card('3')])],
      activeUnder: 8,
    });
    expect(getIllegalPlayReason([card('6')], state, 'p1')).toBeNull();
  });

  it('returns null when revolution is active and value is valid (≤)', () => {
    const state = makeState({
      phase: 'revolution',
      pile: [pileEntry([card('K')])],
    });
    expect(getIllegalPlayReason([card('5')], state, 'p1')).toBeNull();
  });
});
