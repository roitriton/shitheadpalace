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
  };
}

// Convenience cards
const c2 = card('2');
const c5 = card('5');
const c7 = card('7');
const c9 = card('9');
const cK = card('K');
const cA = card('A');

// ─── guard: phase ─────────────────────────────────────────────────────────────

describe('applyPlay — phase guard', () => {
  it('throws when phase is swapping', () => {
    const state = { ...makeState({ hand: [c7] }), phase: 'swapping' as const };
    expect(() => applyPlay(state, 'p0', [c7.id])).toThrow(/phase/);
  });

  it('throws when phase is finished', () => {
    const state = { ...makeState({ hand: [c7] }), phase: 'finished' as const };
    expect(() => applyPlay(state, 'p0', [c7.id])).toThrow(/phase/);
  });

  it('allows play during revolution phase', () => {
    const state = {
      ...makeState({ hand: [c5] }, pile('7')),
      phase: 'revolution' as const, // must play ≤ 7
    };
    expect(() => applyPlay(state, 'p0', [c5.id])).not.toThrow();
  });
});

// ─── guard: turn ──────────────────────────────────────────────────────────────

describe('applyPlay — turn guard', () => {
  it('throws when it is not the player\'s turn', () => {
    const state = makeState({ hand: [c7] });
    expect(() => applyPlay(state, 'p1', [c7.id])).toThrow(/turn/);
  });

  it('throws for an unknown player id', () => {
    const state = makeState({ hand: [c7] });
    expect(() => applyPlay(state, 'ghost', [c7.id])).toThrow(/not found/);
  });

  it('throws when cardIds is empty', () => {
    const state = makeState({ hand: [c7] });
    expect(() => applyPlay(state, 'p0', [])).toThrow(/at least one/);
  });
});

// ─── play from hand — empty pile ─────────────────────────────────────────────

describe('applyPlay — from hand, empty pile', () => {
  it('plays a single card onto an empty pile', () => {
    const state = makeState({ hand: [c7, c9, cK] });
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.pile).toHaveLength(1);
    expect(next.pile[0]!.cards[0]!.rank).toBe('7');
    expect(next.players[0]!.hand).not.toContainEqual(c7);
  });

  it('plays multiple cards of the same rank', () => {
    const c7b = card('7', 'spades');
    const state = makeState({ hand: [c7, c7b, c9] });
    const next = applyPlay(state, 'p0', [c7.id, c7b.id]);
    expect(next.pile[0]!.cards).toHaveLength(2);
    expect(next.players[0]!.hand).toEqual([c9]);
  });

  it('throws when trying to play cards of different ranks', () => {
    const state = makeState({ hand: [c7, c9] });
    expect(() => applyPlay(state, 'p0', [c7.id, c9.id])).toThrow(/same rank/);
  });
});

// ─── play from hand — non-empty pile ─────────────────────────────────────────

describe('applyPlay — from hand, non-empty pile', () => {
  it('plays a higher-value card', () => {
    const state = makeState({ hand: [cK] }, pile('7'));
    expect(() => applyPlay(state, 'p0', [cK.id])).not.toThrow();
  });

  it('plays a card of equal value', () => {
    const c7b = card('7', 'spades');
    const state = makeState({ hand: [c7b] }, pile('7'));
    expect(() => applyPlay(state, 'p0', [c7b.id])).not.toThrow();
  });

  it('rejects a lower-value card', () => {
    const state = makeState({ hand: [c5] }, pile('7'));
    expect(() => applyPlay(state, 'p0', [c5.id])).toThrow(/too low/);
  });

  it('rejects a card not found in the player\'s zone', () => {
    const state = makeState({ hand: [c7] });
    expect(() => applyPlay(state, 'p0', ['ghost-id'])).toThrow(/not found/);
  });
});

// ─── auto-draw Phase 1 ────────────────────────────────────────────────────────

describe('applyPlay — auto-draw (Phase 1)', () => {
  it('draws up to 3 cards from deck after playing from hand', () => {
    const deckCards = [card('2', 'spades'), card('3', 'spades'), card('4', 'spades')];
    const state = makeState({ hand: [c7] }, [], deckCards);
    const next = applyPlay(state, 'p0', [c7.id]);
    // hand was 1, played 1 → 0; drew 3 → hand = 3
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.deck).toHaveLength(0);
  });

  it('draws only what is available when deck has fewer than needed', () => {
    const deckCards = [card('2', 'spades')];
    const state = makeState({ hand: [c7, c9] }, [], deckCards); // hand=2, played 1 → 1 card; draw 1 more → 2 total
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.players[0]!.hand).toHaveLength(2); // 1 remaining + 1 drawn
    expect(next.deck).toHaveLength(0);
  });

  it('does not draw when deck is empty', () => {
    const state = makeState({ hand: [c7, c9] }, [], []);
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.players[0]!.hand).toHaveLength(1); // only c9 remains
  });

  it('does not draw when playing from faceUp', () => {
    // Simulate Phase 2: hand empty, deck empty, playing from faceUp
    const state = makeState({ hand: [], faceUp: [c7] }, [], []);
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.players[0]!.hand).toHaveLength(0);
  });
});

// ─── play from faceUp ─────────────────────────────────────────────────────────

describe('applyPlay — from faceUp (Phase 2)', () => {
  it('plays from faceUp when hand is empty', () => {
    const state = makeState({ hand: [], faceUp: [c7, c9] }, [], []);
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.pile[0]!.cards[0]!.rank).toBe('7');
    expect(next.players[0]!.faceUp).toEqual([c9]);
  });

  it('plays multiple faceUp cards of the same rank', () => {
    const c7b = card('7', 'spades');
    const state = makeState({ hand: [], faceUp: [c7, c7b] }, [], []);
    const next = applyPlay(state, 'p0', [c7.id, c7b.id]);
    expect(next.pile[0]!.cards).toHaveLength(2);
    expect(next.players[0]!.faceUp).toHaveLength(0);
  });

  it('rejects a faceUp card that is too low', () => {
    const state = makeState({ hand: [], faceUp: [c5] }, pile('7'), []);
    expect(() => applyPlay(state, 'p0', [c5.id])).toThrow(/too low/);
  });

  it('throws when requesting a hand card while hand is empty', () => {
    const state = makeState({ hand: [], faceUp: [c7] }, [], []);
    // c5 is not in faceUp
    expect(() => applyPlay(state, 'p0', [c5.id])).toThrow(/not found/);
  });
});

// ─── play from faceDown (dark flop) ──────────────────────────────────────────

describe('applyPlay — from faceDown (dark flop)', () => {
  it('valid blind play: card placed on pile, turn advances', () => {
    // p0 has a second faceDown card so they don't finish; p1 has cards so game doesn't end
    const cKb = card('K', 'spades');
    const state = makeState({ hand: [], faceUp: [], faceDown: [cK, cKb] }, pile('7'), [], { hand: [c9] });
    const next = applyPlay(state, 'p0', [cK.id]);
    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('K');
    expect(next.players[0]!.faceDown).toHaveLength(1); // cKb remains
    expect(next.currentPlayerIndex).toBe(1); // turn advanced
  });

  it('invalid blind play: player picks up pile + revealed card', () => {
    // Pile has K (13); p0 blind-plays 5 (too low)
    const state = makeState({ hand: [], faceUp: [], faceDown: [c5] }, pile('K'));
    const next = applyPlay(state, 'p0', [c5.id]);
    // pile cleared
    expect(next.pile).toHaveLength(0);
    // p0's hand now contains the old pile card (K) + the revealed card (5)
    expect(next.players[0]!.hand).toHaveLength(2);
    expect(next.players[0]!.hand.map((c) => c.rank)).toContain('5');
    expect(next.players[0]!.hand.map((c) => c.rank)).toContain('K');
    // card removed from faceDown
    expect(next.players[0]!.faceDown).toHaveLength(0);
  });

  it('throws when trying to play two dark-flop cards at once', () => {
    const c5b = card('5', 'spades');
    const state = makeState({ hand: [], faceUp: [], faceDown: [c5, c5b] });
    expect(() => applyPlay(state, 'p0', [c5.id, c5b.id])).toThrow(/one dark-flop/);
  });

  it('valid dark-flop card on empty pile always succeeds', () => {
    const state = makeState({ hand: [], faceUp: [], faceDown: [c2] }, []);
    expect(() => applyPlay(state, 'p0', [c2.id])).not.toThrow();
  });
});

// ─── turn advancement ─────────────────────────────────────────────────────────

describe('applyPlay — turn advancement', () => {
  it('advances turn to the next player after a valid play', () => {
    const state = makeState({ hand: [c7, c9] }, [], [], { hand: [cK] });
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('appends current player back to queue after non-finishing play', () => {
    const state = makeState({ hand: [c7, c9] });
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.turnOrder).toContain(0);
  });
});

// ─── finish detection ─────────────────────────────────────────────────────────

describe('applyPlay — finish and game-over', () => {
  it('marks player as finished when all zones empty', () => {
    // p0 plays last card, p1 has cards → p0 finishes, game not over yet
    const state = makeState(
      { hand: [c7] },
      [],
      [],
      { hand: [c9] }, // p1 still has cards
    );
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.players[0]!.isFinished).toBe(true);
    expect(next.finishOrder).toContain('p0');
  });

  it('transitions to finished phase when second-to-last player finishes', () => {
    // 2 players; p0 plays last card → only p1 left → game over
    const state = makeState({ hand: [c7] }, [], [], { hand: [c9] });
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.phase).toBe('finished');
    expect(next.finishOrder).toContain('p0');
    expect(next.finishOrder).toContain('p1'); // shit head appended
  });

  it('finishOrder records players in order (first finisher first, shit head last)', () => {
    const state = makeState({ hand: [c7] }, [], [], { hand: [c9] });
    const next = applyPlay(state, 'p0', [c7.id]);
    expect(next.finishOrder[0]).toBe('p0');
    expect(next.finishOrder[1]).toBe('p1'); // p1 is the shit head
  });

  it('does not mutate the input state', () => {
    const state = makeState({ hand: [c7] });
    const originalHand = [...state.players[0]!.hand];
    applyPlay(state, 'p0', [c7.id]);
    expect(state.players[0]!.hand).toEqual(originalHand);
    expect(state.pile).toHaveLength(0);
  });
});

// ─── Jack cards go to graveyard ───────────────────────────────────────────────

describe('applyPlay — Jack cards go to graveyard', () => {
  function card2(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
    return { id: `${rank}-${suit}-${idx}`, suit, rank };
  }

  const mirrorVariant = {
    name: 'M',
    powerAssignments: { mirror: '9' as const },
    playerCount: 2,
    deckCount: 1,
  };

  it('J♦ goes to graveyard after play, pile entry removed', () => {
    const jDiamond = card2('J', 'diamonds');
    const state = makeState({ hand: [jDiamond, c9] }, pile('3'), [], { hand: [c5] });
    const next = applyPlay(state, 'p0', [jDiamond.id]);
    expect(next.graveyard.map((c) => c.id)).toContain(jDiamond.id);
    // Pre-existing pile entry stays, Jack entry removed
    expect(next.pile).toHaveLength(1);
    expect(next.pile[0]!.cards[0]!.rank).toBe('3');
  });

  it('J♠ (Manouche) goes to graveyard after play', () => {
    const jSpade = card2('J', 'spades');
    const state = makeState({ hand: [jSpade, cK] }, pile('3'), [], { hand: [c5] });
    // targetPlayerId required because Manouche triggers (player does not finish)
    const next = applyPlay(state, 'p0', [jSpade.id], 0, 'p1');
    expect(next.graveyard.map((c) => c.id)).toContain(jSpade.id);
    expect(next.pile).toHaveLength(1);
  });

  it('J♥ goes to graveyard after play, pile entry removed', () => {
    const jHeart = card2('J', 'hearts');
    const state = makeState({ hand: [jHeart, cK] }, pile('3'), [], { hand: [c5] });
    const next = applyPlay(state, 'p0', [jHeart.id]);
    expect(next.graveyard.map((c) => c.id)).toContain(jHeart.id);
    expect(next.pile).toHaveLength(1);
  });

  it('J♣ goes to graveyard after play, pile entry removed', () => {
    const jClub = card2('J', 'clubs');
    const state = makeState({ hand: [jClub, cK] }, pile('3'), [], { hand: [c5] });
    const next = applyPlay(state, 'p0', [jClub.id]);
    expect(next.graveyard.map((c) => c.id)).toContain(jClub.id);
    expect(next.pile).toHaveLength(1);
  });

  it('J♦ + Mirror: both Jack and Mirror go to graveyard', () => {
    const jd = card2('J', 'diamonds', 1);
    const mirror9 = card2('9', 'clubs', 1);
    const state = {
      ...makeState({ hand: [jd, mirror9, cK] }, pile('3'), [], { hand: [c5] }),
      variant: mirrorVariant,
    };
    const next = applyPlay(state, 'p0', [jd.id, mirror9.id]);
    const graveyardIds = next.graveyard.map((c) => c.id);
    expect(graveyardIds).toContain(jd.id);
    expect(graveyardIds).toContain(mirror9.id);
    expect(next.pile).toHaveLength(1);
  });

  it('J♠ + Mirror: both go to graveyard (Super Manouche)', () => {
    const js = card2('J', 'spades', 1);
    const mirror9 = card2('9', 'clubs', 1);
    const state = {
      ...makeState({ hand: [js, mirror9, cK] }, pile('3'), [], { hand: [c5] }),
      variant: mirrorVariant,
    };
    // targetPlayerId required because Super Manouche triggers
    const next = applyPlay(state, 'p0', [js.id, mirror9.id], 0, 'p1');
    const graveyardIds = next.graveyard.map((c) => c.id);
    expect(graveyardIds).toContain(js.id);
    expect(graveyardIds).toContain(mirror9.id);
    expect(next.pile).toHaveLength(1);
  });

  it('previous pile entry is preserved as top after Jack is played on it', () => {
    const jd2 = card2('J', 'diamonds', 2);
    // Pre-existing pile entry with a '5'
    const preEntry = pile('5');
    const state = makeState({ hand: [jd2, cK] }, preEntry, [], { hand: [c5] });
    const next = applyPlay(state, 'p0', [jd2.id]);
    // J♦ goes to graveyard
    expect(next.graveyard.map((c) => c.id)).toContain(jd2.id);
    // Original '5' entry is still the top of the pile
    expect(next.pile).toHaveLength(1);
    expect(next.pile[0]!.cards[0]!.rank).toBe('5');
  });

  it('Jack during revolution (powers suppressed) stays in pile', () => {
    const jdRev = card2('J', 'diamonds', 3);
    const state = {
      ...makeState({ hand: [jdRev, cK] }, pile('A'), [], { hand: [c5] }),
      phase: 'revolution' as const,
      revolution: true,
    };
    const next = applyPlay(state, 'p0', [jdRev.id]);
    // During revolution, Jacks lose their power and stay in the pile
    expect(next.graveyard).toHaveLength(0);
    expect(next.pile).toHaveLength(2);
    expect(next.pile[1]!.cards[0]!.rank).toBe('J');
    // Phase stays revolution (J♦ power is suppressed)
    expect(next.phase).toBe('revolution');
  });

  it('non-Jack card stays in pile, not graveyard', () => {
    const state = makeState({ hand: [cK] }, [], [], { hand: [c5] });
    const next = applyPlay(state, 'p0', [cK.id]);
    expect(next.pile).toHaveLength(1);
    expect(next.graveyard).toHaveLength(0);
  });
});
