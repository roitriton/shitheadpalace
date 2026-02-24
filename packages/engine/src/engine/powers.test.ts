import { describe, it, expect } from 'vitest';
import { applyPlay } from './actions/play';
import { applyPickUpPile } from './actions/pickUp';
import type { Card, GameState, GameVariant, PileEntry, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileOf(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'other',
    playerName: 'Other',
    timestamp: 0,
  }));
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id, name: id,
    hand: [], faceUp: [], faceDown: [],
    isFinished: false, isBot: false,
    ...overrides,
  };
}

const allPowers: GameVariant = {
  name: 'all',
  powerAssignments: { burn: '10', reset: '2', under: '8', skip: '7', mirror: '9' },
  playerCount: 4,
  deckCount: 1,
};

function makeState(
  p0: Partial<Player>,
  pile: PileEntry[] = [],
  otherPlayers: Partial<Player>[] = [{}, {}, {}],
  overrides: Partial<GameState> = {},
): GameState {
  const players = [
    makePlayer('p0', p0),
    ...otherPlayers.map((o, i) => makePlayer(`p${i + 1}`, o)),
  ];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: players.slice(1).map((_, i) => i + 1),
    finishOrder: [],
    variant: allPowers,
    pendingAction: null,
    log: [],
    ...overrides,
  };
}

// ─── Burn ─────────────────────────────────────────────────────────────────────

describe('Burn integration (via applyPlay)', () => {
  it('burns the pile when the Burn card (10) is played', () => {
    const state = makeState({ hand: [card('10'), card('K')] }, pileOf('7'));
    const next = applyPlay(state, 'p0', [card('10').id]);
    expect(next.pile).toHaveLength(0);
    // graveyard should contain the 7 and the 10
    expect(next.graveyard.map((c) => c.rank)).toContain('7');
    expect(next.graveyard.map((c) => c.rank)).toContain('10');
  });

  it('player replays after Burn (turn does not advance)', () => {
    const state = makeState({ hand: [card('10'), card('K')] }, pileOf('7'));
    const next = applyPlay(state, 'p0', [card('10').id]);
    expect(next.currentPlayerIndex).toBe(0); // still p0's turn
  });

  it('logs a burn entry', () => {
    const state = makeState({ hand: [card('10'), card('K')] }, pileOf('7'));
    const next = applyPlay(state, 'p0', [card('10').id]);
    expect(next.log.some((e) => e.type === 'burn')).toBe(true);
  });

  it('triggers Burn by 4 identical (no Burn-rank assignment needed)', () => {
    const noRankBurnVariant: GameVariant = {
      name: 'no-burn-rank',
      powerAssignments: {}, // Burn rank not assigned
      playerCount: 4,
      deckCount: 1,
    };
    // 3 sevens already on pile
    const threeOf7: PileEntry[] = [
      { cards: [card('7'), card('7', 'spades')], playerId: 'x', playerName: 'X', timestamp: 0 },
      { cards: [card('7', 'diamonds')], playerId: 'x', playerName: 'X', timestamp: 0 },
    ];
    const state: GameState = {
      ...makeState({ hand: [card('7', 'clubs')] }, threeOf7),
      variant: noRankBurnVariant,
    };
    const next = applyPlay(state, 'p0', [card('7', 'clubs').id]);
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard).toHaveLength(4);
  });

  it('turn does NOT advance after Burn when player still has cards', () => {
    const state = makeState(
      { hand: [card('10'), card('K'), card('A')] },
      pileOf('7'),
    );
    const next = applyPlay(state, 'p0', [card('10').id]);
    expect(next.currentPlayerIndex).toBe(0);
    // p0 still has K and A (auto-draw from empty deck = 0)
    expect(next.players[0]!.hand).toHaveLength(2);
  });

  it('turn DOES advance after Burn when player played their last card', () => {
    const state = makeState({ hand: [card('10')] }, pileOf('7'));
    const next = applyPlay(state, 'p0', [card('10').id]);
    // p0 played last card → finished → turn advances
    expect(next.players[0]!.isFinished).toBe(true);
    expect(next.currentPlayerIndex).not.toBe(0);
  });

  it('Burn is disabled during revolution', () => {
    const state: GameState = {
      ...makeState({ hand: [card('10'), card('K')] }, pileOf('7')),
      phase: 'revolution',
    };
    // During revolution, must play ≤ top value (7). 10 > 7 so the play should be rejected.
    expect(() => applyPlay(state, 'p0', [card('10').id])).toThrow(/too low/);
  });
});

// ─── Reset ────────────────────────────────────────────────────────────────────

describe('Reset integration (via applyPlay)', () => {
  it('sets pileResetActive after playing Reset card (2)', () => {
    const state = makeState({ hand: [card('2'), card('K')] }, pileOf('K'));
    const next = applyPlay(state, 'p0', [card('2').id]);
    expect(next.pileResetActive).toBe(true);
  });

  it('next player can play any card when pileResetActive is true', () => {
    // p0 plays 2 on K (Reset). p1 must now be able to play any card.
    const state = makeState(
      { hand: [card('2'), card('K')] },
      pileOf('K'),
      [{ hand: [card('3')] }, {}, {}],
    );
    const afterReset = applyPlay(state, 'p0', [card('2').id]);
    expect(afterReset.pileResetActive).toBe(true);
    // p1 plays 3 (normally 3 < K, but Reset allows it)
    const afterP1 = applyPlay(afterReset, 'p1', [card('3').id]);
    expect(afterP1.pile.at(-1)!.cards[0]!.rank).toBe('3');
  });

  it('pileResetActive is cleared after the next player acts', () => {
    const state = makeState(
      { hand: [card('2'), card('K')] },
      pileOf('K'),
      [{ hand: [card('3')] }, {}, {}],
    );
    const afterReset = applyPlay(state, 'p0', [card('2').id]);
    const afterP1 = applyPlay(afterReset, 'p1', [card('3').id]);
    expect(afterP1.pileResetActive).toBeFalsy();
  });

  it('pileResetActive is cleared when the constrained player picks up', () => {
    const state = makeState(
      { hand: [card('2'), card('K')] },
      pileOf('K'),
      [{ hand: [card('3')] }, {}, {}],
    );
    const afterReset = applyPlay(state, 'p0', [card('2').id]);
    const afterPickUp = applyPickUpPile(afterReset, 'p1');
    expect(afterPickUp.pileResetActive).toBeFalsy();
  });

  it('logs a reset entry', () => {
    const state = makeState({ hand: [card('2'), card('K')] }, pileOf('K'));
    const next = applyPlay(state, 'p0', [card('2').id]);
    expect(next.log.some((e) => e.type === 'reset')).toBe(true);
  });
});

// ─── Under ────────────────────────────────────────────────────────────────────

describe('Under integration (via applyPlay)', () => {
  it('sets activeUnder after playing Under card (8)', () => {
    const state = makeState({ hand: [card('8'), card('K')] }, pileOf('5'));
    const next = applyPlay(state, 'p0', [card('8').id]);
    expect(next.activeUnder).toBe(8);
  });

  it('next player must play ≤ Under value', () => {
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [card('K')] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    // p1 tries to play K (13 > 8) → should be rejected
    expect(() => applyPlay(afterUnder, 'p1', [card('K').id])).toThrow(/too low/);
  });

  it('next player CAN play ≤ Under value', () => {
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [card('6')] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    // p1 plays 6 (≤ 8) → should succeed
    expect(() => applyPlay(afterUnder, 'p1', [card('6').id])).not.toThrow();
  });

  it('activeUnder is cleared after the constrained player acts', () => {
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [card('5')] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    const afterP1 = applyPlay(afterUnder, 'p1', [card('5').id]);
    expect(afterP1.activeUnder).toBeFalsy();
  });

  it('activeUnder is cleared when constrained player picks up', () => {
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [card('5')] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    const afterPickUp = applyPickUpPile(afterUnder, 'p1');
    expect(afterPickUp.activeUnder).toBeFalsy();
  });

  it('Under is disabled during revolution', () => {
    // During revolution, play ≤ top. 8 is played on 5 (8 > 5 → invalid in revolution)
    const state: GameState = {
      ...makeState({ hand: [card('8'), card('K')] }, pileOf('A')),
      phase: 'revolution',
    };
    // 8 ≤ A (14) is valid in revolution, so this play succeeds...
    // but Under should NOT activate
    const next = applyPlay(state, 'p0', [card('8').id]);
    expect(next.activeUnder).toBeFalsy();
  });

  it('logs an under entry', () => {
    const state = makeState({ hand: [card('8'), card('K')] }, pileOf('5'));
    const next = applyPlay(state, 'p0', [card('8').id]);
    expect(next.log.some((e) => e.type === 'under')).toBe(true);
  });
});

// ─── Skip ─────────────────────────────────────────────────────────────────────

describe('Skip integration (via applyPlay)', () => {
  it('skips 1 player when a single Skip card (7) is played', () => {
    // Players: p0 (current), p1, p2, p3. p0 plays 7 → p1 skips, p2 plays next.
    const state = makeState(
      { hand: [card('7'), card('K')] },
      [],
      [{ hand: [card('A')] }, { hand: [card('K')] }, { hand: [card('Q')] }],
    );
    const next = applyPlay(state, 'p0', [card('7').id]);
    expect(next.currentPlayerIndex).toBe(2); // p1 skipped, p2 is next
  });

  it('skips 2 players when two Skip cards are played', () => {
    const c7a = card('7', 'hearts');
    const c7b = card('7', 'spades');
    const state = makeState(
      { hand: [c7a, c7b, card('K')] },
      [],
      [{ hand: [card('A')] }, { hand: [card('K')] }, { hand: [card('Q')] }],
    );
    const next = applyPlay(state, 'p0', [c7a.id, c7b.id]);
    expect(next.currentPlayerIndex).toBe(3); // p1 and p2 skipped, p3 is next
  });

  it('skipped players return to the queue (not permanently removed)', () => {
    const state = makeState(
      { hand: [card('7'), card('K')] },
      [],
      [{ hand: [card('A')] }, { hand: [card('K')] }, { hand: [card('Q')] }],
    );
    const next = applyPlay(state, 'p0', [card('7').id]);
    // p1 was skipped; they should appear in the turnOrder
    expect(next.turnOrder).toContain(1);
  });

  it('logs a skip entry with the correct skipCount', () => {
    const state = makeState({ hand: [card('7'), card('K')] });
    const next = applyPlay(state, 'p0', [card('7').id]);
    const entry = next.log.find((e) => e.type === 'skip');
    expect(entry).toBeDefined();
    expect(entry!.data.skipCount).toBe(1);
  });

  it('Skip is disabled during revolution', () => {
    // During revolution, 7 ≤ A so play is valid, but Skip should not fire.
    const state: GameState = {
      ...makeState(
        { hand: [card('7'), card('K')] },
        pileOf('A'),
        [{ hand: [card('A')] }, { hand: [card('K')] }, { hand: [card('Q')] }],
      ),
      phase: 'revolution',
    };
    const next = applyPlay(state, 'p0', [card('7').id]);
    // Turn should advance normally (no skip) → p1 plays next
    expect(next.currentPlayerIndex).toBe(1);
  });
});

// ─── Mirror ───────────────────────────────────────────────────────────────────

describe('Mirror integration (via applyPlay)', () => {
  it('sets effectiveRank on the top PileEntry to the non-Mirror card rank', () => {
    const state = makeState({ hand: [card('9'), card('K')] }, pileOf('5'));
    const next = applyPlay(state, 'p0', [card('9').id, card('K').id]);
    expect(next.pile.at(-1)!.effectiveRank).toBe('K');
  });

  it('next player sees effective pile value as K (must play ≥ K)', () => {
    const state = makeState(
      { hand: [card('9'), card('K')] },
      pileOf('5'),
      [{ hand: [card('Q')] }, {}, {}],
    );
    const afterMirror = applyPlay(state, 'p0', [card('9').id, card('K').id]);
    // p1 tries to play Q (12 < K=13) → should be rejected
    expect(() => applyPlay(afterMirror, 'p1', [card('Q').id])).toThrow(/too low/);
  });

  it('next player can play ≥ effective K value', () => {
    const state = makeState(
      { hand: [card('9'), card('K')] },
      pileOf('5'),
      [{ hand: [card('A')] }, {}, {}],
    );
    const afterMirror = applyPlay(state, 'p0', [card('9').id, card('K').id]);
    expect(() => applyPlay(afterMirror, 'p1', [card('A').id])).not.toThrow();
  });

  it('throws when Mirror is played alone', () => {
    const state = makeState({ hand: [card('9'), card('K')] }, pileOf('5'));
    expect(() => applyPlay(state, 'p0', [card('9').id])).toThrow(/Mirror.*alone/i);
  });

  it('logs a mirror entry', () => {
    const state = makeState({ hand: [card('9'), card('K')] }, pileOf('5'));
    const next = applyPlay(state, 'p0', [card('9').id, card('K').id]);
    expect(next.log.some((e) => e.type === 'mirror')).toBe(true);
  });

  it('Mirror + Burn: Mirror sets effectiveRank, then Burn fires', () => {
    // 9 (Mirror) + 10 (Burn). Mirror makes effective rank = 10. Burn triggers.
    const state = makeState({ hand: [card('9'), card('10'), card('K')] }, pileOf('5'));
    const next = applyPlay(state, 'p0', [card('9').id, card('10').id]);
    // Burn should have fired (pile cleared)
    expect(next.pile).toHaveLength(0);
    expect(next.graveyard.length).toBeGreaterThan(0);
  });

  it('Mirror + Skip: Mirror counts as an additional skip (2 total → p3 plays in 4-player)', () => {
    const state = makeState(
      { hand: [card('9'), card('7'), card('K')] },
      pileOf('5'),
      [{ hand: [card('A')] }, { hand: [card('K')] }, { hand: [card('Q')] }],
    );
    const next = applyPlay(state, 'p0', [card('9').id, card('7').id]);
    // Skip (7) + Mirror (9) → skipCount = 2. In 4-player: p1 and p2 skip, p3 plays.
    expect(next.currentPlayerIndex).toBe(3);
  });
});

// ─── canPlayCards — Under / Reset modifiers ───────────────────────────────────

describe('canPlayCards modifiers (validated through applyPlay)', () => {
  it('Reset allows playing any card below the current pile value', () => {
    const state = makeState(
      { hand: [card('2'), card('K')] },
      pileOf('K'),
      [{ hand: [card('3')] }, {}, {}],
    );
    const afterReset = applyPlay(state, 'p0', [card('2').id]);
    // p1 plays 3 (3 < K = normally invalid, but Reset active)
    expect(() => applyPlay(afterReset, 'p1', [card('3').id])).not.toThrow();
  });

  it('Under prevents playing above the Under value', () => {
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [card('Q')] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    // p1 tries to play Q (12 > 8) → rejected
    expect(() => applyPlay(afterUnder, 'p1', [card('Q').id])).toThrow(/too low/);
  });

  it('Under allows playing the exact Under value itself', () => {
    const c8b = card('8', 'spades');
    const state = makeState(
      { hand: [card('8'), card('K')] },
      pileOf('5'),
      [{ hand: [c8b] }, {}, {}],
    );
    const afterUnder = applyPlay(state, 'p0', [card('8').id]);
    // p1 plays 8 (= Under value, cardValue ≤ activeUnder) → allowed
    expect(() => applyPlay(afterUnder, 'p1', [c8b.id])).not.toThrow();
  });
});

// ─── Skip — circular wrap-around (end-to-end via applyPlay) ───────────────────

describe('Skip — circular wrap-around (applyPlay)', () => {
  const skipMirrorVariant: GameVariant = {
    name: 'skip-mirror',
    powerAssignments: { burn: '10', reset: '2', under: '8', skip: '7', mirror: '9' },
    playerCount: 4,
    deckCount: 1,
  };

  // ── 2-player (A=p0, B=p1) ─────────────────────────────────────────────────

  it('2-player, 1 Skip (7 alone): launcher (A) replays', () => {
    const state = makeState(
      { hand: [card('7'), card('K')] },
      [],
      [{ hand: [card('K')] }],
    );
    const next = applyPlay(state, 'p0', [card('7').id]);
    expect(next.currentPlayerIndex).toBe(0); // A replays
  });

  it('2-player, 2 Skips (7 + Mirror): B, A skipped → B plays', () => {
    const state: GameState = {
      ...makeState(
        { hand: [card('7'), card('9'), card('K')] },
        [],
        [{ hand: [card('K')] }],
      ),
      variant: skipMirrorVariant,
    };
    const next = applyPlay(state, 'p0', [card('7').id, card('9').id]);
    expect(next.currentPlayerIndex).toBe(1); // B plays
  });

  it('2-player, 3 Skips (7 + 2 Mirrors): B, A, B skipped → A replays', () => {
    const c9b = card('9', 'spades');
    const state: GameState = {
      ...makeState(
        { hand: [card('7'), card('9'), c9b, card('K')] },
        [],
        [{ hand: [card('K')] }],
      ),
      variant: skipMirrorVariant,
    };
    const next = applyPlay(state, 'p0', [card('7').id, card('9').id, c9b.id]);
    expect(next.currentPlayerIndex).toBe(0); // A replays
  });

  // ── 3-player (A=p0, B=p1, C=p2) ──────────────────────────────────────────

  it('3-player, 1 Skip (7 alone): B skipped → C plays', () => {
    const state = makeState(
      { hand: [card('7'), card('K')] },
      [],
      [{ hand: [card('K')] }, { hand: [card('K')] }],
    );
    const next = applyPlay(state, 'p0', [card('7').id]);
    expect(next.currentPlayerIndex).toBe(2); // C plays
  });

  it('3-player, 2 Skips (7 + Mirror): B and C skipped → launcher (A) replays', () => {
    const state: GameState = {
      ...makeState(
        { hand: [card('7'), card('9'), card('K')] },
        [],
        [{ hand: [card('K')] }, { hand: [card('K')] }],
      ),
      variant: skipMirrorVariant,
    };
    const next = applyPlay(state, 'p0', [card('7').id, card('9').id]);
    expect(next.currentPlayerIndex).toBe(0); // A replays
  });

  it('3-player, 3 Skips (7 + 2 Mirrors): B, C, A skipped → B plays', () => {
    const c9b = card('9', 'spades');
    const state: GameState = {
      ...makeState(
        { hand: [card('7'), card('9'), c9b, card('K')] },
        [],
        [{ hand: [card('K')] }, { hand: [card('K')] }],
      ),
      variant: skipMirrorVariant,
    };
    const next = applyPlay(state, 'p0', [card('7').id, card('9').id, c9b.id]);
    expect(next.currentPlayerIndex).toBe(1); // B plays
  });
});

// ─── Jacks during Revolution / Super Revolution ─────────────────────────────

describe('Jacks during revolution/superRevolution (powers suppressed → stay in pile)', () => {
  it('Jack stays in pile during revolution (no graveyard)', () => {
    const jd = card('J', 'diamonds');
    const state: GameState = {
      ...makeState(
        { hand: [jd, card('K')] },
        pileOf('A'),
        [{}, {}, {}],
      ),
      phase: 'revolution',
      revolution: true,
    };
    // During revolution, must play ≤ top value. J=11 ≤ A=14, so valid.
    const next = applyPlay(state, 'p0', [jd.id]);
    expect(next.graveyard).toHaveLength(0);
    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('J');
  });

  it('Jack stays in pile during superRevolution (no graveyard)', () => {
    const js = card('J', 'spades');
    const state: GameState = {
      ...makeState(
        { hand: [js, card('K')] },
        pileOf('A'),
        [{}, {}, {}],
      ),
      phase: 'superRevolution',
      superRevolution: true,
    };
    const next = applyPlay(state, 'p0', [js.id]);
    expect(next.graveyard).toHaveLength(0);
    expect(next.pile.at(-1)!.cards[0]!.rank).toBe('J');
  });

  it('Jack goes to graveyard during normal play (powers active)', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd, card('K')] },
      pileOf('5'),
      [{}, {}, {}],
    );
    const next = applyPlay(state, 'p0', [jd.id]);
    expect(next.graveyard.map((c) => c.id)).toContain(jd.id);
  });

  it('Jack + Mirror stay in pile during revolution', () => {
    const mirrorVariant: GameVariant = {
      name: 'mirror',
      powerAssignments: { mirror: '9' },
      playerCount: 4,
      deckCount: 1,
    };
    const jd = card('J', 'diamonds');
    const c9 = card('9', 'clubs');
    const state: GameState = {
      ...makeState(
        { hand: [jd, c9, card('K')] },
        pileOf('A'),
        [{}, {}, {}],
      ),
      variant: mirrorVariant,
      phase: 'revolution',
      revolution: true,
    };
    const next = applyPlay(state, 'p0', [jd.id, c9.id]);
    // Both should stay in pile (not moved to graveyard)
    expect(next.graveyard).toHaveLength(0);
    expect(next.pile.at(-1)!.cards).toHaveLength(2);
  });
});
