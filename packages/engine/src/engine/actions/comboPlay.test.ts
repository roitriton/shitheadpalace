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
  const players = [makePlayer('p0', p0), makePlayer('p1', p1)];
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
const mirrorVariant = { name: 'S', powerAssignments: { mirror: '9' as const, burn: '10' as const }, playerCount: 2, deckCount: 1 };

// ═══════════════════════════════════════════════════════════════════════════════
// Combo hand + flop (Rule A)
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyPlay — combo hand + flop', () => {
  it('plays last hand cards (6+9 mirror) + flop (6) as a valid combo', () => {
    const h6 = card('6', 'hearts', 0);
    const h9 = card('9', 'spades', 0);
    const f6 = card('6', 'diamonds', 0);
    const fQ = card('Q', 'clubs', 0);
    const state = {
      ...makeState(
        { hand: [h6, h9], faceUp: [f6, fQ, card('3')] },
        pile('4'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [h6.id, h9.id, f6.id]);

    // Hand should be empty
    expect(next.players[0]!.hand).toHaveLength(0);
    // Flop should have lost the 6 but keep Q and 3
    expect(next.players[0]!.faceUp).toHaveLength(2);
    expect(next.players[0]!.faceUp.map((c) => c.rank)).toEqual(['Q', '3']);
    // Pile should have the combo entry
    const topEntry = next.pile[next.pile.length - 1]!;
    expect(topEntry.cards).toHaveLength(3);
  });

  it('plays last hand cards + flop cards all same value', () => {
    const h5a = card('5', 'hearts', 0);
    const h5b = card('5', 'spades', 1);
    const f5 = card('5', 'diamonds', 0);
    const fK = card('K', 'clubs', 0);
    const state = makeState(
      { hand: [h5a, h5b], faceUp: [f5, fK] },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [h5a.id, h5b.id, f5.id]);

    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('K');
  });

  it('rejects combo when player still has hand cards remaining', () => {
    const h5 = card('5', 'hearts', 0);
    const h6 = card('6', 'spades', 0);
    const f5 = card('5', 'diamonds', 0);
    const state = makeState(
      { hand: [h5, h6], faceUp: [f5] },
      pile('3'),
    );

    // Only playing h5 + f5, but h6 remains in hand → combo not allowed
    expect(() => applyPlay(state, 'p0', [h5.id, f5.id])).toThrow(/Combo hand\+flop requires playing ALL/);
  });

  it('throws for combo hand + flop with different non-mirror values', () => {
    const h6 = card('6', 'hearts', 0);
    const f8 = card('8', 'diamonds', 0);
    const state = makeState(
      { hand: [h6], faceUp: [f8, card('3')] },
      pile('4'),
    );

    expect(() => applyPlay(state, 'p0', [h6.id, f8.id])).toThrow(/same rank/);
  });

  it('triggers quad burn when combo forms 4+ identical cards', () => {
    const h10a = card('10', 'hearts', 0);
    const h10b = card('10', 'spades', 1);
    const f10a = card('10', 'diamonds', 0);
    const f10b = card('10', 'clubs', 1);
    const state = {
      ...makeState(
        { hand: [h10a, h10b], faceUp: [f10a, f10b, card('3')] },
        pile('K'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [h10a.id, h10b.id, f10a.id, f10b.id]);

    // Burn should have triggered — pendingCemeteryTransit set, cards still in pile
    expect(next.pendingCemeteryTransit).toBe(true);
    expect(next.lastPowerTriggered?.type).toBe('burn');
  });

  it('plays single hand card + single matching flop card as valid combo', () => {
    const h7 = card('7', 'hearts', 0);
    const f7 = card('7', 'diamonds', 0);
    const fA = card('A', 'spades', 0);
    const state = makeState(
      { hand: [h7], faceUp: [f7, fA] },
      pile('5'),
    );

    const next = applyPlay(state, 'p0', [h7.id, f7.id]);

    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('A');
  });

  it('combo hand + flop with mirror in hand valid if effective rank matches', () => {
    const h9 = card('9', 'hearts', 0);
    const fK = card('K', 'diamonds', 0);
    const fQ = card('Q', 'clubs', 0);
    const state = {
      ...makeState(
        { hand: [h9], faceUp: [fK, fQ] },
        pile('5'),
      ),
      variant: mirrorVariant,
    };

    // 9 (mirror) from hand + K from flop → effective rank K
    const next = applyPlay(state, 'p0', [h9.id, fK.id]);

    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.faceUp).toHaveLength(1);
    expect(next.players[0]!.faceUp[0]!.rank).toBe('Q');
  });

  it('after valid combo hand+flop, player transitions to faceUp zone', () => {
    const h6 = card('6', 'hearts', 0);
    const f6 = card('6', 'diamonds', 0);
    const fQ = card('Q', 'clubs', 0);
    const state = makeState(
      { hand: [h6], faceUp: [f6, fQ] },
      pile('4'),
    );

    const next = applyPlay(state, 'p0', [h6.id, f6.id]);

    // Hand is empty, faceUp has 1 card remaining
    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.faceUp).toHaveLength(1);
    // Active zone should now be faceUp (no cards in hand)
    expect(next.players[0]!.faceUp[0]!.rank).toBe('Q');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Combo flop + dark flop (Rule B)
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyPlay — combo flop + dark flop', () => {
  it('valid combo: hasSeenDarkFlop=true, last flop + dark flop same value', () => {
    const f2a = card('2', 'hearts', 0);
    const f2b = card('2', 'spades', 1);
    const d2 = card('2', 'diamonds', 0);
    const d6 = card('6', 'clubs', 0);
    const state = {
      ...makeState(
        { faceUp: [f2a, f2b], faceDown: [d2, d6], hasSeenDarkFlop: true },
        pile('A'),
      ),
      variant: { name: 'S', powerAssignments: { reset: '2' as const }, playerCount: 2, deckCount: 1 },
    };

    const next = applyPlay(state, 'p0', [f2a.id, f2b.id, d2.id]);

    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.rank).toBe('6');
    const topEntry = next.pile[next.pile.length - 1]!;
    expect(topEntry.cards).toHaveLength(3);
  });

  it('invalid combo: hasSeenDarkFlop=true, mixed values → pickup pile + all attempted', () => {
    const f2 = card('2', 'hearts', 0);
    const f9 = card('9', 'spades', 0);
    const d6 = card('6', 'diamonds', 0);
    const dQ = card('Q', 'clubs', 0);
    const state = {
      ...makeState(
        { faceUp: [f2, f9], faceDown: [d6, dQ], hasSeenDarkFlop: true },
        pile('3'),
      ),
      variant: mirrorVariant,
    };

    // 2 (flop) + 9 (flop, mirror=2) + 6 (dark) = mixed (2, 2, 6) → invalid
    const next = applyPlay(state, 'p0', [f2.id, f9.id, d6.id]);

    // Player picks up pile (1 card: 3) + all 3 attempted cards → hand has 4
    expect(next.players[0]!.hand).toHaveLength(4);
    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(1); // dQ remains
    expect(next.pile).toHaveLength(0);
  });

  it('rejects dark flop cards when hasSeenDarkFlop=false', () => {
    const f5 = card('5', 'hearts', 0);
    const d5 = card('5', 'diamonds', 0);
    const state = makeState(
      { faceUp: [f5], faceDown: [d5] },
      pile('3'),
    );

    expect(() => applyPlay(state, 'p0', [f5.id, d5.id])).toThrow(/not found in player's faceUp/);
  });

  it('valid combo flop + dark flop with mirrors', () => {
    const f6 = card('6', 'hearts', 0);
    const f9 = card('9', 'spades', 0);
    const d6 = card('6', 'diamonds', 0);
    const state = {
      ...makeState(
        { faceUp: [f6, f9], faceDown: [d6, card('K', 'clubs', 0)], hasSeenDarkFlop: true },
        pile('4'),
      ),
      variant: mirrorVariant,
    };

    // 6 (flop) + 9 (flop, mirror=6) + 6 (dark) → all effective rank 6
    const next = applyPlay(state, 'p0', [f6.id, f9.id, d6.id]);

    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    const topEntry = next.pile[next.pile.length - 1]!;
    expect(topEntry.cards).toHaveLength(3);
  });

  it('triggers quad burn when combo flop + dark flop forms 4+ identical', () => {
    const f10a = card('10', 'hearts', 0);
    const f10b = card('10', 'spades', 1);
    const d10a = card('10', 'diamonds', 0);
    const d10b = card('10', 'clubs', 1);
    const state = {
      ...makeState(
        { faceUp: [f10a, f10b], faceDown: [d10a, d10b], hasSeenDarkFlop: true },
        pile('K'),
      ),
      variant: mirrorVariant,
    };

    const next = applyPlay(state, 'p0', [f10a.id, f10b.id, d10a.id, d10b.id]);

    // Burn → pendingCemeteryTransit set, cards still in pile
    expect(next.pendingCemeteryTransit).toBe(true);
    expect(next.lastPowerTriggered?.type).toBe('burn');
  });

  it('valid combo: single flop card + single matching dark flop card', () => {
    const f3 = card('3', 'hearts', 0);
    const d3 = card('3', 'diamonds', 0);
    const state = makeState(
      { faceUp: [f3], faceDown: [d3, card('K', 'clubs', 0)], hasSeenDarkFlop: true },
      pile('2'), // 3 is playable on 2
    );

    const next = applyPlay(state, 'p0', [f3.id, d3.id]);

    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(1);
  });

  it('rejects combo when not all flop cards are played', () => {
    const f5a = card('5', 'hearts', 0);
    const f5b = card('5', 'spades', 1);
    const d5 = card('5', 'diamonds', 0);
    const state = makeState(
      { faceUp: [f5a, f5b], faceDown: [d5], hasSeenDarkFlop: true },
      pile('3'),
    );

    // Only playing f5a + d5, but f5b remains → combo condition fails
    expect(() => applyPlay(state, 'p0', [f5a.id, d5.id])).toThrow(/Combo flop\+dark requires playing ALL/);
  });

  it('invalid flop+dark combo: player picks up pile AND all attempted cards', () => {
    const f4 = card('4', 'hearts', 0);
    const d8 = card('8', 'diamonds', 0);
    const pileCard = card('3', 'clubs', 99);
    const state = makeState(
      { faceUp: [f4], faceDown: [d8], hasSeenDarkFlop: true },
      [{ cards: [pileCard], playerId: 'px', playerName: 'PX', timestamp: 0 }],
    );

    const next = applyPlay(state, 'p0', [f4.id, d8.id]);

    // 4 and 8 are different ranks → invalid combo
    // Player picks up: pile (1 card) + attempted (2 cards) = 3 cards in hand
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(0);
    expect(next.pile).toHaveLength(0);
  });

  it('after valid combo flop+dark, player transitions to faceDown zone or finishes', () => {
    const f5 = card('5', 'hearts', 0);
    const d5 = card('5', 'diamonds', 0);
    const dRemaining = card('K', 'clubs', 0);
    const state = makeState(
      { faceUp: [f5], faceDown: [d5, dRemaining], hasSeenDarkFlop: true },
      pile('3'),
    );

    const next = applyPlay(state, 'p0', [f5.id, d5.id]);

    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(1);
    expect(next.players[0]!.faceDown[0]!.rank).toBe('K');
  });

  it('combo flop+dark where all zones empty → player finishes', () => {
    const f5 = card('5', 'hearts', 0);
    const d5 = card('5', 'diamonds', 0);
    const state = makeState(
      { faceUp: [f5], faceDown: [d5], hasSeenDarkFlop: true },
      pile('3'),
      [],
      { hand: [card('4', 'clubs', 0)] }, // p1 needs cards to not end the game immediately
    );

    const next = applyPlay(state, 'p0', [f5.id, d5.id]);

    expect(next.players[0]!.isFinished).toBe(true);
    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.faceUp).toHaveLength(0);
    expect(next.players[0]!.faceDown).toHaveLength(0);
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
});
