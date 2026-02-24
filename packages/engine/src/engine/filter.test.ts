import { describe, it, expect } from 'vitest';
import { filterGameStateForPlayer } from './filter';
import type { Card, GameState, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    isBot: false,
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: players.length, deckCount: 1 },
    pendingAction: null,
    log: [],
  };
}

// ─── filterGameStateForPlayer ─────────────────────────────────────────────────

describe('filterGameStateForPlayer', () => {
  it("returns the viewer's own cards unmodified", () => {
    const myHand = [card('7'), card('K')];
    const myFaceUp = [card('A')];
    const myFaceDown = [card('2'), card('3')];
    const state = makeState([
      makePlayer('me', { hand: myHand, faceUp: myFaceUp, faceDown: myFaceDown }),
      makePlayer('opp', { hand: [card('Q')], faceDown: [card('5')] }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');

    expect(filtered.players[0]!.hand).toEqual(myHand);
    expect(filtered.players[0]!.faceUp).toEqual(myFaceUp);
    expect(filtered.players[0]!.faceDown).toEqual(myFaceDown);
  });

  it("replaces each opponent's hand with hidden cards of equal count", () => {
    const oppHand = [card('Q'), card('J'), card('9')];
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { hand: oppHand }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');
    const hiddenHand = filtered.players[1]!.hand;

    expect(hiddenHand).toHaveLength(oppHand.length);
    expect(hiddenHand.every((c) => c.hidden === true)).toBe(true);
  });

  it("replaces each opponent's faceDown with hidden cards of equal count", () => {
    const oppFaceDown = [card('5'), card('6')];
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { faceDown: oppFaceDown }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');
    const hiddenFaceDown = filtered.players[1]!.faceDown;

    expect(hiddenFaceDown).toHaveLength(oppFaceDown.length);
    expect(hiddenFaceDown.every((c) => c.hidden === true)).toBe(true);
  });

  it("keeps each opponent's faceUp cards visible (public information)", () => {
    const oppFaceUp = [card('K'), card('A')];
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { faceUp: oppFaceUp }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');

    expect(filtered.players[1]!.faceUp).toEqual(oppFaceUp);
  });

  it('hidden placeholder cards do not reveal rank or suit of the original', () => {
    const secret = card('A', 'spades'); // highest card — must not be revealed
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { hand: [secret], faceDown: [secret] }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');
    const opp = filtered.players[1]!;

    // The placeholder's rank/suit must not equal the original's
    opp.hand.forEach((c) => {
      expect(c.id).not.toBe(secret.id);
    });
    opp.faceDown.forEach((c) => {
      expect(c.id).not.toBe(secret.id);
    });
  });

  it('works with more than 2 players — only the viewer sees their own cards', () => {
    const state = makeState([
      makePlayer('p0', { hand: [card('7'), card('9')], faceDown: [card('A')] }),
      makePlayer('p1', { hand: [card('Q')], faceDown: [card('K')] }),
      makePlayer('p2', { hand: [card('3'), card('4')], faceDown: [card('5'), card('6')] }),
    ]);

    // Filtered for p1
    const filtered = filterGameStateForPlayer(state, 'p1');

    // p0: hidden
    expect(filtered.players[0]!.hand.every((c) => c.hidden)).toBe(true);
    expect(filtered.players[0]!.faceDown.every((c) => c.hidden)).toBe(true);
    // p1: own cards intact
    expect(filtered.players[1]!.hand).toEqual(state.players[1]!.hand);
    expect(filtered.players[1]!.faceDown).toEqual(state.players[1]!.faceDown);
    // p2: hidden
    expect(filtered.players[2]!.hand.every((c) => c.hidden)).toBe(true);
    expect(filtered.players[2]!.faceDown.every((c) => c.hidden)).toBe(true);
  });

  it('empty hand/faceDown remains empty after filtering', () => {
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { hand: [], faceDown: [] }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');

    expect(filtered.players[1]!.hand).toHaveLength(0);
    expect(filtered.players[1]!.faceDown).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { hand: [card('Q')], faceDown: [card('K')] }),
    ]);
    const originalOppHand = state.players[1]!.hand[0]!.rank;
    filterGameStateForPlayer(state, 'me');

    expect(state.players[1]!.hand[0]!.rank).toBe(originalOppHand);
    expect(state.players[1]!.hand[0]!.hidden).toBeUndefined();
  });

  it('other state fields (deck, pile, graveyard, phase, …) are left unchanged', () => {
    const state = makeState([
      makePlayer('me', { hand: [card('7')] }),
      makePlayer('opp', { hand: [card('Q')] }),
    ]);
    const filtered = filterGameStateForPlayer(state, 'me');

    expect(filtered.id).toBe(state.id);
    expect(filtered.phase).toBe(state.phase);
    expect(filtered.deck).toBe(state.deck);
    expect(filtered.pile).toBe(state.pile);
    expect(filtered.graveyard).toBe(state.graveyard);
    expect(filtered.log).toBe(state.log);
  });
});
