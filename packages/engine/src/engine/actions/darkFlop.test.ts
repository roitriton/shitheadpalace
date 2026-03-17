import { describe, it, expect } from 'vitest';
import { applyPlay } from './play';
import { resolveIllegalDarkFlop } from './resolveIllegalDarkFlop';
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
    expect(next.pendingAction).toBeNull();
  });

  it('illegal card → card goes to pile with pendingAction illegalDarkFlop', () => {
    const c3 = card('3', 'hearts', 0);
    const c5 = card('5', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, c5] },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c3.id]);

    // Card is now on the pile (revealed)
    expect(next.pile).toHaveLength(2); // original K + revealed 3
    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('3');
    // pendingAction set for cross overlay
    expect(next.pendingAction).toEqual({
      type: 'illegalDarkFlop',
      playerId: 'p0',
      cardIds: [c3.id],
    });
    // Card removed from dark flop
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(c5.id);
    // Hand still empty (no pickup yet)
    expect(next.players[0]!.hand).toHaveLength(0);
  });

  it('illegal card → resolveIllegalDarkFlop picks up pile + card', () => {
    const c3 = card('3', 'hearts', 0);
    const c5 = card('5', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, c5] },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    const next = resolveIllegalDarkFlop(intermediate);

    // pile cleared
    expect(next.pile).toHaveLength(0);
    // player picked up pile (K) + revealed card (3)
    expect(next.players[0]!.hand).toHaveLength(2);
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['3', 'K']);
    // other dark flop card remains
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(c5.id);
    // pendingAction cleared
    expect(next.pendingAction).toBeNull();
    // turn advanced
    expect(next.currentPlayerIndex).toBe(1);
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
    expect(next.pendingAction).toBeNull();
  });

  it('illegal blind play → resolve clears activeUnder and pileResetActive', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK] },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    expect(intermediate.pendingAction?.type).toBe('illegalDarkFlop');

    // Manually add activeUnder/pileResetActive to intermediate state
    const withFlags = { ...intermediate, activeUnder: 8, pileResetActive: true };
    const next = resolveIllegalDarkFlop(withFlags);
    expect(next.activeUnder).toBeNull();
    expect(next.pileResetActive).toBe(false);
  });

  it('blind dark flop Mirror alone → illegal → pendingAction illegalDarkFlop', () => {
    const c9 = card('9', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = {
      ...makeState({ hand: [], faceUp: [], faceDown: [c9, cK] }, pile('3')),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [c9.id]);

    // Mirror alone is invalid even on blind dark flop
    expect(next.pendingAction).toEqual({
      type: 'illegalDarkFlop',
      playerId: 'p0',
      cardIds: [c9.id],
    });
    // Card is on pile
    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('9');
  });

  it('illegal blind play logs darkPlay first, then darkPlayFail on resolve', () => {
    const c3 = card('3', 'hearts', 0);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, card('5', 'spades', 1)] },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    // darkPlay log entry is present (card revealed)
    expect(intermediate.log.some((l) => l.type === 'darkPlay')).toBe(true);

    const next = resolveIllegalDarkFlop(intermediate);
    // darkPlayFail log entry added on resolve
    expect(next.log.some((l) => l.type === 'darkPlayFail')).toBe(true);
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
    expect(next.pendingAction).toBeNull();
  });

  it('illegal combo (different ranks) → cards go to pile with pendingAction', () => {
    const c5 = card('5', 'hearts', 0);
    const c8 = card('8', 'spades', 1);
    const cK = card('K', 'clubs', 2);
    const pileCard = card('3', 'diamonds', 99);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5, c8, cK], hasSeenDarkFlop: true },
      [{ cards: [pileCard], playerId: 'px', playerName: 'PX', timestamp: 0 }],
    );

    const next = applyPlay(state, 'p0', [c5.id, c8.id]);

    // Cards are on the pile
    expect(next.pile).toHaveLength(2); // original + invalid entry
    expect(next.pile.at(-1)!.cards).toHaveLength(2);
    // pendingAction set
    expect(next.pendingAction).toEqual({
      type: 'illegalDarkFlop',
      playerId: 'p0',
      cardIds: [c5.id, c8.id],
    });
    // Cards removed from dark flop
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
  });

  it('illegal combo (different ranks) → resolve picks up pile + all attempted cards', () => {
    const c5 = card('5', 'hearts', 0);
    const c8 = card('8', 'spades', 1);
    const cK = card('K', 'clubs', 2);
    const pileCard = card('3', 'diamonds', 99);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5, c8, cK], hasSeenDarkFlop: true },
      [{ cards: [pileCard], playerId: 'px', playerName: 'PX', timestamp: 0 }],
    );

    const intermediate = applyPlay(state, 'p0', [c5.id, c8.id]);
    const next = resolveIllegalDarkFlop(intermediate);

    // Player picks up pile (1) + attempted cards (2) = 3
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['3', '5', '8']);
    // Remaining dark flop card untouched
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.id).toBe(cK.id);
    expect(next.pile).toHaveLength(0);
    expect(next.pendingAction).toBeNull();
  });

  it('illegal combo (value too low) → cards go to pile with pendingAction', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const next = applyPlay(state, 'p0', [c3.id]);

    expect(next.pendingAction).toEqual({
      type: 'illegalDarkFlop',
      playerId: 'p0',
      cardIds: [c3.id],
    });
    // Card is on pile
    expect(next.pile).toHaveLength(2);
  });

  it('illegal combo (value too low) → resolve picks up pile + attempted cards', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    const next = resolveIllegalDarkFlop(intermediate);

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
    expect(next.pendingAction).toBeNull();
  });

  it('combo with mirror (9) but value too low → pendingAction illegalDarkFlop', () => {
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

    // 3 + mirror(9)=effective rank 3, can't beat K → intermediate state
    expect(next.pendingAction?.type).toBe('illegalDarkFlop');
    expect(next.pile.at(-1)!.cards).toHaveLength(2);
  });

  it('combo with mirror (9) but value too low → resolve picks up', () => {
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

    const intermediate = applyPlay(state, 'p0', [c3.id, c9.id]);
    const next = resolveIllegalDarkFlop(intermediate);

    expect(next.players[0]!.hand).toHaveLength(3); // pile(K) + 3 + 9
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.pile).toHaveLength(0);
  });

  it('mirrors alone → pendingAction illegalDarkFlop (not throw)', () => {
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

    // Mirrors alone = invalid → intermediate state (not throw)
    expect(next.pendingAction?.type).toBe('illegalDarkFlop');
    expect(next.pile.at(-1)!.cards).toHaveLength(2);
  });

  it('mirrors alone → resolve picks up pile + attempted cards', () => {
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

    const intermediate = applyPlay(state, 'p0', [c9a.id, c9b.id]);
    const next = resolveIllegalDarkFlop(intermediate);

    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.pile).toHaveLength(0);
  });

  it('invalid play → resolve clears activeUnder and pileResetActive', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    expect(intermediate.pendingAction?.type).toBe('illegalDarkFlop');

    // Manually add activeUnder/pileResetActive to intermediate state
    const withFlags = { ...intermediate, activeUnder: 8, pileResetActive: true };
    const next = resolveIllegalDarkFlop(withFlags);

    expect(next.activeUnder).toBeNull();
    expect(next.pileResetActive).toBe(false);
  });

  it('invalid play → resolve advances turn to next player', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    const next = resolveIllegalDarkFlop(intermediate);

    expect(next.currentPlayerIndex).toBe(1);
  });

  it('invalid play logs darkPlay first, then darkPlayFail on resolve', () => {
    const c5 = card('5', 'hearts', 0);
    const c8 = card('8', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c5, c8], hasSeenDarkFlop: true },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c5.id, c8.id]);
    // darkPlay logged (cards revealed on pile)
    expect(intermediate.log.some((l) => l.type === 'darkPlay')).toBe(true);
    expect(intermediate.pendingAction).toEqual({
      type: 'illegalDarkFlop',
      playerId: 'p0',
      cardIds: [c5.id, c8.id],
    });

    const next = resolveIllegalDarkFlop(intermediate);
    const failLog = next.log.find((l) => l.type === 'darkPlayFail');
    expect(failLog).toBeDefined();
    expect(failLog!.data.cardIds).toEqual([c5.id, c8.id]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveIllegalDarkFlop — standalone tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveIllegalDarkFlop', () => {
  it('throws when no pending illegalDarkFlop action', () => {
    const state = makeState({ hand: [], faceUp: [], faceDown: [card('5')] });
    expect(() => resolveIllegalDarkFlop(state)).toThrow(/No pending illegalDarkFlop/);
  });

  it('picks up entire pile including the illegal card(s)', () => {
    const c3 = card('3', 'hearts', 0);
    const pileK = card('K', 'spades', 99);
    const state: GameState = {
      ...makeState({ hand: [], faceUp: [], faceDown: [card('5', 'clubs', 1)] }),
      pile: [
        { cards: [pileK], playerId: 'px', playerName: 'PX', timestamp: 0 },
        { cards: [c3], playerId: 'p0', playerName: 'p0', timestamp: 0 },
      ],
      pendingAction: { type: 'illegalDarkFlop', playerId: 'p0', cardIds: [c3.id] },
    };

    const next = resolveIllegalDarkFlop(state);

    expect(next.pile).toHaveLength(0);
    expect(next.players[0]!.hand).toHaveLength(2); // K + 3
    expect(next.players[0]!.hand.map((c) => c.rank).sort()).toEqual(['3', 'K']);
    expect(next.pendingAction).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasSeenDarkFlop flag tracking
// ═══════════════════════════════════════════════════════════════════════════════

describe('hasSeenDarkFlop flag', () => {
  it('is undefined by default on a new player', () => {
    const p = makePlayer('p0');
    expect(p.hasSeenDarkFlop).toBeUndefined();
  });

  it('persists after a valid dark flop play', () => {
    const c6 = card('6', 'hearts', 0);
    const cK = card('K', 'spades', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c6, cK], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [c6.id]);

    expect(next.players[0]!.hasSeenDarkFlop).toBe(true);
  });

  it('persists after an invalid dark flop play + resolve', () => {
    const c3 = card('3', 'hearts', 0);
    const cK = card('K', 'clubs', 1);
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [c3, cK], hasSeenDarkFlop: true },
      pile('K'),
    );

    const intermediate = applyPlay(state, 'p0', [c3.id]);
    expect(intermediate.players[0]!.hasSeenDarkFlop).toBe(true);

    const next = resolveIllegalDarkFlop(intermediate);
    expect(next.players[0]!.hasSeenDarkFlop).toBe(true);
  });
});
