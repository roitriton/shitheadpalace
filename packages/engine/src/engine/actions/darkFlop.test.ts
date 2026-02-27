import { describe, it, expect } from 'vitest';
import { applyPlay } from './play';
import type { Card, GameState, PileEntry, Player } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pile(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
  }));
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

/** Build a 2-player state where p0 is the current player. */
function makeState(
  p0: Partial<Player>,
  pileEntries: PileEntry[] = [],
  deck: Card[] = [],
  p1: Partial<Player> = {},
): GameState {
  const players = [makePlayer('p0', p0), makePlayer('p1', { hand: [card('4', 'clubs', 99)], ...p1 })];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck,
    pile: pileEntries,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
  };
}

/** Variant with mirror=9 and burn=10 */
const mirrorVariant = {
  name: 'S',
  powerAssignments: { mirror: '9' as const, burn: '10' as const },
  playerCount: 2,
  deckCount: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Cas 1 — Sans hasSeenDarkFlop (aveugle)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dark flop — blind (no hasSeenDarkFlop)', () => {
  it('legal card → placed on pile, turn advances', () => {
    const c6 = card('6', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c6, cK] },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c6.id]);

    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('6');
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('illegal card → player picks up pile + that card only', () => {
    const c3 = card('3', 'hearts', 0);
    const c5 = card('5', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, c5] },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c3.id]);

    // pile cleared
    expect(next.pile).toHaveLength(0);
    // player picked up pile (K) + revealed card (3)
    expect(next.players[0]!.hand).toHaveLength(2);
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['3', 'K']);
    // other dark flop card remains
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(c5.id);
  });

  it('multiple card selection → refused (throw)', () => {
    const c5a = card('5', 'hearts', 0);
    const c5b = card('5', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5a, c5b] },
    );

    expect(() => applyPlay(state, 'p0', [c5a.id, c5b.id])).toThrow(/one dark-flop/);
  });

  it('legal card on empty pile always succeeds', () => {
    const c2 = card('2', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c2, cK] },
      [],
    );

    const next = applyPlay(state, 'p0', [c2.id]);
    expect(next.pile).toHaveLength(1);
    expect(next.pile[0]!.cards[0]!.rank).toBe('2');
  });

  it('illegal blind play clears activeUnder and pileResetActive', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = {
      ...makeState({ hand: [], faceUp: [], faceDown: [c3, cK] }, pile('K')),
      activeUnder: 8,
      pileResetActive: true,
    };

    const next = applyPlay(state, 'p0', [c3.id]);

    expect(next.activeUnder).toBeNull();
    expect(next.pileResetActive).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cas 2 — Avec hasSeenDarkFlop (après Flop Reverse / Flop Remake)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dark flop — known (hasSeenDarkFlop)', () => {
  it('legal combo (two cards same rank) → placed on pile', () => {
    const c5a = card('5', 'hearts', 0);
    const c5b = card('5', 'spades', 1);
    const cK = card('K', 'clubs', 2);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5a, c5b, cK], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c5a.id, c5b.id]);

    expect(next.pile.at(-1)!.cards).toHaveLength(2);
    expect(next.pile.at(-1)!.cards.map((c) => c.rank)).toEqual(['5', '5']);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
  });

  it('illegal combo (different ranks) → pickup pile + all attempted cards', () => {
    const c5 = card('5', 'hearts', 0);
    const c8 = card('8', 'spades', 1);
    const cK = card('K', 'clubs', 2);
    const pileCard = card('3', 'diamonds', 99);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5, c8, cK], hasSeenDarkFlop: true },
      [{ cards: [pileCard], playerId: 'px', playerName: 'PX', timestamp: 0 }],
    );

    const next = applyPlay(state, 'p0', [c5.id, c8.id]);

    // Player picks up pile (1) + attempted cards (2) = 3
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['3', '5', '8']);
    // Remaining dark flop card untouched
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
    expect(next.pile).toHaveLength(0);
  });

  it('illegal combo (value too low) → pickup pile + attempted cards', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c3.id]);

    // Player picks up pile (K) + attempted card (3) = 2
    expect(next.players[0]!.hand).toHaveLength(2);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
    expect(next.pile).toHaveLength(0);
  });

  it('single card selection → works normally', () => {
    const c6 = card('6', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c6, cK], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c6.id]);

    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('6');
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('last dark flop card (legal) → player finishes', () => {
    const c6 = card('6', 'hearts', 0);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c6], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c6.id]);

    expect(next.players[0]!.isFinished).toBe(true);
    expect(next.players[0]!.faceDown).toHaveLength(0);
  });

  it('last dark flop cards (legal combo) → player finishes', () => {
    const c5a = card('5', 'hearts', 0);
    const c5b = card('5', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5a, c5b], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c5a.id, c5b.id]);

    expect(next.players[0]!.isFinished).toBe(true);
    expect(next.players[0]!.faceDown).toHaveLength(0);
  });

  it('combo with mirror (9) → effective rank used, valid play', () => {
    const c6 = card('6', 'hearts', 0);
    const c9 = card('9', 'spades', 1); // mirror
    const cK = card('K', 'clubs', 2);
    const state = {
      ...makeState(
        { hand: [], faceUp: [], faceDown: [c6, c9, cK], hasSeenDarkFlop: true },
        pile('4'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [c6.id, c9.id]);

    // 6 + mirror(9)=effective rank 6 → valid on pile 4
    expect(next.pile.at(-1)!.cards).toHaveLength(2);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
  });

  it('combo with mirror (9) but value too low → pickup', () => {
    const c3 = card('3', 'hearts', 0);
    const c9 = card('9', 'spades', 1); // mirror
    const cK = card('K', 'clubs', 2);
    const state = {
      ...makeState(
        { hand: [], faceUp: [], faceDown: [c3, c9, cK], hasSeenDarkFlop: true },
        pile('K'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [c3.id, c9.id]);

    // 3 + mirror(9)=effective rank 3, can't beat K → pickup
    expect(next.players[0]!.hand).toHaveLength(3); // pile(K) + 3 + 9
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.pile).toHaveLength(0);
  });

  it('mirrors alone → pickup (not throw)', () => {
    const c9a = card('9', 'hearts', 0);
    const c9b = card('9', 'spades', 1);
    const cK = card('K', 'clubs', 2);
    const state = {
      ...makeState(
        { hand: [], faceUp: [], faceDown: [c9a, c9b, cK], hasSeenDarkFlop: true },
        pile('3'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [c9a.id, c9b.id]);

    // Mirrors alone = invalid → pickup pile (1) + attempted (2)
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.pile).toHaveLength(0);
  });

  it('invalid play clears activeUnder and pileResetActive', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = {
      ...makeState(
        { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
        pile('K'),
      ),
      activeUnder: 8,
      pileResetActive: true,
    };

    const next = applyPlay(state, 'p0', [c3.id]);

    expect(next.activeUnder).toBeNull();
    expect(next.pileResetActive).toBe(false);
  });

  it('invalid play advances turn to next player', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c3.id]);

    expect(next.currentPlayerIndex).toBe(1);
  });

  it('invalid play logs darkPlayFail with all card info', () => {
    const c5 = card('5', 'hearts', 0);
    const c8 = card('8', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5, c8], hasSeenDarkFlop: true },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c5.id, c8.id]);

    const failLog = next.log.find((l) => l.type === 'darkPlayFail');
    expect(failLog).toBeDefined();
    expect(failLog!.data.cardIds).toEqual([c5.id, c8.id]);
  });
});
