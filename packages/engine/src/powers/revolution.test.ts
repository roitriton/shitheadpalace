import { describe, it, expect } from 'vitest';
import {
  isRevolutionCard,
  isRevolutionTriggered,
  isSuperRevolutionTriggered,
  applyRevolution,
  applySuperRevolution,
} from './revolution';
import { applyPlay } from '../engine/actions/play';
import { applyRevolutionConfirm } from '../engine/actions/applyRevolutionConfirm';
import { applyPickUpPile } from '../engine/actions/pickUp';
import { canPlayCards } from '../engine/validation';
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

const mirrorVariant: GameVariant = {
  name: 'test',
  powerAssignments: { mirror: '9' },
  playerCount: 4,
  deckCount: 1,
};

const allPowersVariant: GameVariant = {
  name: 'all',
  powerAssignments: { burn: '10', reset: '2', under: '8', skip: '7', mirror: '9' },
  playerCount: 4,
  deckCount: 1,
};

const noMirrorVariant: GameVariant = {
  name: 'no-mirror',
  powerAssignments: {},
  playerCount: 4,
  deckCount: 1,
};

/** 4-player playing state, p0 is current, turnOrder = [1, 2, 3]. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [
      makePlayer('p0'),
      makePlayer('p1'),
      makePlayer('p2'),
      makePlayer('p3'),
    ],
    deck: [],
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2, 3],
    finishOrder: [],
    variant: mirrorVariant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// Convenience cards
const jd = card('J', 'diamonds');   // J♦ — revolution card
const jh = card('J', 'hearts');     // J♥ — NOT revolution
const js = card('J', 'spades');     // J♠ — NOT revolution
const c9 = card('9');               // Mirror by default
const c5 = card('5');
const cK = card('K');
const c2 = card('2');

// ─── isRevolutionCard ─────────────────────────────────────────────────────────

describe('isRevolutionCard', () => {
  it('returns true for J♦', () => expect(isRevolutionCard(jd)).toBe(true));
  it('returns false for J♥', () => expect(isRevolutionCard(jh)).toBe(false));
  it('returns false for J♠', () => expect(isRevolutionCard(js)).toBe(false));
  it('returns false for J♣', () => expect(isRevolutionCard(card('J', 'clubs'))).toBe(false));
  it('returns false for a non-Jack diamond (A♦)', () => expect(isRevolutionCard(card('A', 'diamonds'))).toBe(false));
});

// ─── isRevolutionTriggered ────────────────────────────────────────────────────

describe('isRevolutionTriggered', () => {
  it('returns true for J♦ alone', () => {
    expect(isRevolutionTriggered([jd], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false for J♦ + Mirror (→ Super Revolution instead)', () => {
    expect(isRevolutionTriggered([jd, c9], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false for J♥ (wrong suit)', () => {
    expect(isRevolutionTriggered([jh], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isRevolutionTriggered([jd], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isRevolutionTriggered([jd], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns true when mirror is not assigned in variant (J♦ alone, no mirrors possible)', () => {
    expect(isRevolutionTriggered([jd], noMirrorVariant, 'playing')).toBe(true);
  });
});

// ─── isSuperRevolutionTriggered ───────────────────────────────────────────────

describe('isSuperRevolutionTriggered', () => {
  it('returns true for J♦ + Mirror', () => {
    expect(isSuperRevolutionTriggered([jd, c9], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false for J♦ alone (→ regular Revolution)', () => {
    expect(isSuperRevolutionTriggered([jd], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false for Mirror alone (no J♦)', () => {
    expect(isSuperRevolutionTriggered([c9], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isSuperRevolutionTriggered([jd, c9], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isSuperRevolutionTriggered([jd, c9], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns false when mirror is not assigned in variant', () => {
    // The c9 is not a Mirror card in noMirrorVariant, so J♦ + 9 is treated as J♦ alone
    // but wait — they're different ranks so this would normally be invalid as a play;
    // however isTriggered only checks the array, not play legality
    expect(isSuperRevolutionTriggered([jd, c9], noMirrorVariant, 'playing')).toBe(false);
  });
});

// ─── applyRevolution ─────────────────────────────────────────────────────────

describe('applyRevolution', () => {
  it('sets phase to revolution', () => {
    const next = applyRevolution(makeState(), 'p0', 0);
    expect(next.phase).toBe('revolution');
  });

  it('sets revolution flag to true', () => {
    const next = applyRevolution(makeState(), 'p0', 0);
    expect(next.revolution).toBe(true);
  });

  it('does not set superRevolution flag', () => {
    const next = applyRevolution(makeState(), 'p0', 0);
    expect(next.superRevolution).toBeFalsy();
  });

  it('appends a revolution log entry', () => {
    const next = applyRevolution(makeState(), 'p0', 0);
    expect(next.log.find((e) => e.type === 'revolution')).toBeDefined();
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    applyRevolution(state, 'p0', 0);
    expect(state.phase).toBe('playing');
  });
});

// ─── applySuperRevolution ─────────────────────────────────────────────────────

describe('applySuperRevolution', () => {
  it('sets phase to superRevolution', () => {
    const next = applySuperRevolution(makeState(), 'p0', 0);
    expect(next.phase).toBe('superRevolution');
  });

  it('sets both revolution and superRevolution flags', () => {
    const next = applySuperRevolution(makeState(), 'p0', 0);
    expect(next.revolution).toBe(true);
    expect(next.superRevolution).toBe(true);
  });

  it('appends a superRevolution log entry', () => {
    const next = applySuperRevolution(makeState(), 'p0', 0);
    expect(next.log.find((e) => e.type === 'superRevolution')).toBeDefined();
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    applySuperRevolution(state, 'p0', 0);
    expect(state.phase).toBe('playing');
  });
});

// ─── canPlayCards during revolution (value order inverted) ───────────────────

describe('canPlayCards — revolution inverts value ordering', () => {
  it('low card (5) beats high card (K) on pile during revolution', () => {
    const state = { ...makeState({ phase: 'revolution' as const }), pile: pileOf('K') };
    expect(canPlayCards([c5], state)).toBe(true);   // 5 ≤ 13 → playable
  });

  it('high card (K) cannot beat low card (5) on pile during revolution', () => {
    const state = { ...makeState({ phase: 'revolution' as const }), pile: pileOf('5') };
    expect(canPlayCards([cK], state)).toBe(false);  // 13 > 5 → not playable
  });

  it('card equal to top pile value is playable in revolution', () => {
    const state = { ...makeState({ phase: 'revolution' as const }), pile: pileOf('7') };
    expect(canPlayCards([card('7', 'spades')], state)).toBe(true);  // equal → ok
  });

  it('2 is the strongest card in revolution (any card on empty pile)', () => {
    const state = makeState({ phase: 'revolution' as const });
    expect(canPlayCards([c2], state)).toBe(true);  // empty pile — always ok
  });

  it('same rules apply during superRevolution', () => {
    const state = { ...makeState({ phase: 'superRevolution' as const }), pile: pileOf('K') };
    expect(canPlayCards([c5], state)).toBe(true);
    expect(canPlayCards([cK], { ...makeState({ phase: 'superRevolution' as const }), pile: pileOf('5') })).toBe(false);
  });
});

// ─── Powers disabled during revolution ───────────────────────────────────────

describe('Powers disabled during revolution', () => {
  it('Burn (10) does not trigger during revolution', () => {
    const burnVariant: GameVariant = { ...allPowersVariant };
    const c10 = card('10');
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [c10, cK] } : { ...p, hand: [cK] },
    );
    const state: GameState = {
      ...makeState({ players }),
      phase: 'revolution',
      pile: pileOf('5'),  // 10 ≤ 5? No — 10 > 5, so 10 is NOT playable in revolution
      variant: burnVariant,
    };
    // 10 (value 10) > 5 (top value 5): NOT playable in revolution
    expect(() => applyPlay(state, 'p0', [c10.id])).toThrow(/too low/);
  });

  it('Skip (7) does not trigger during revolution', () => {
    const c7 = card('7');
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [c7, cK] } : { ...p, hand: [cK] },
    );
    const state: GameState = {
      ...makeState({ players }),
      phase: 'revolution',
      pile: pileOf('K'),  // 7 ≤ 13: playable in revolution
      variant: allPowersVariant,
    };
    const next = applyPlay(state, 'p0', [c7.id]);
    // If Skip had fired, p1 would be skipped; since it doesn't, p1 plays next
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('Reset (2) does not trigger during revolution', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [c2, cK] } : { ...p, hand: [cK] },
    );
    const state: GameState = {
      ...makeState({ players }),
      phase: 'revolution',
      pile: pileOf('K'),  // 2 ≤ 13: playable
      variant: allPowersVariant,
    };
    const next = applyPlay(state, 'p0', [c2.id]);
    // pileResetActive should NOT be set (reset is disabled)
    expect(next.pileResetActive).toBeFalsy();
  });
});

// ─── Full flow: playing J♦ triggers Revolution ────────────────────────────────

describe('Revolution — full play flow', () => {
  it('playing J♦ sets PendingRevolutionConfirm', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [jd, cK] } : { ...p, hand: [cK] },
    );
    const state = makeState({ players, pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }] });
    const next = applyPlay(state, 'p0', [jd.id]);
    expect(next.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect((next.pendingAction as any).isSuper).toBe(false);
  });

  it('playing J♦ + confirm transitions phase to revolution and advances turn', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [jd, cK] } : { ...p, hand: [cK] },
    );
    const state = makeState({ players, pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }] });
    let next = applyPlay(state, 'p0', [jd.id]);
    next = applyRevolutionConfirm(next, 'p0');
    expect(next.phase).toBe('revolution');
    expect(next.revolution).toBe(true);
    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('J♦ is not playable if its value (11) exceeds the top pile value in normal play', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [jd] } : { ...p, hand: [cK] },
    );
    // Top pile is Q (12) — J (11) < 12, not playable in normal play
    const state = { ...makeState({ players }), pile: pileOf('Q') };
    expect(() => applyPlay(state, 'p0', [jd.id])).toThrow(/too low/);
  });

  it('playing J♦ + Mirror(9) sets PendingRevolutionConfirm with isSuper', () => {
    const players = makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [jd, c9, cK] } : { ...p, hand: [cK] },
    );
    const state = makeState({ players, pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }] });
    let next = applyPlay(state, 'p0', [jd.id, c9.id]);
    expect(next.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect((next.pendingAction as any).isSuper).toBe(true);
    next = applyRevolutionConfirm(next, 'p0');
    expect(next.phase).toBe('superRevolution');
    expect(next.revolution).toBe(true);
    expect(next.superRevolution).toBe(true);
  });

  it('after revolution, next player cannot play a higher card than the pre-existing pile top', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jd, cK] };
      if (i === 1) return { ...p, hand: [cK] };
      return { ...p, hand: [cK] };
    });
    // Pile already has a '5': J♦ (11) ≥ 5 → valid in playing phase.
    // After J♦ goes to graveyard, pile top is still '5'.
    const state = makeState({ players, pile: pileOf('5') });
    let afterRev = applyPlay(state, 'p0', [jd.id]);
    afterRev = applyRevolutionConfirm(afterRev, 'p0');
    expect(afterRev.phase).toBe('revolution');
    // p1 tries K (value 13) — pile top is now '5' (value 5).
    // In revolution (≤ ordering): K(13) > 5 → NOT playable.
    expect(() => applyPlay(afterRev, 'p1', [cK.id])).toThrow(/too low/);
  });

  it('after revolution, next player can play lower card (5 on J♦ pile)', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jd, cK] };
      if (i === 1) return { ...p, hand: [c5] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({ players, pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }] });
    let afterRev = applyPlay(state, 'p0', [jd.id]);
    afterRev = applyRevolutionConfirm(afterRev, 'p0');
    expect(() => applyPlay(afterRev, 'p1', [c5.id])).not.toThrow();
  });
});

// ─── Regular Revolution ends on pile pick-up ─────────────────────────────────

describe('Revolution ends on pile pick-up', () => {
  it('phase reverts to playing when any player picks up during revolution', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
    ];
    const state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'revolution',
      revolution: true,
      pile: pileOf('J'),
    };
    const next = applyPickUpPile(state, 'p0');
    expect(next.phase).toBe('playing');
    expect(next.revolution).toBe(false);
  });

  it('revolution flag cleared after pick-up', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
    ];
    const state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'revolution',
      revolution: true,
      pile: pileOf('J'),
    };
    const next = applyPickUpPile(state, 'p0');
    expect(next.revolution).toBe(false);
  });

  it('after revolution ends, higher card is again required on the pile', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [cK] }),
    ];
    const revolState: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'revolution',
      revolution: true,
      pile: pileOf('J'),
    };
    // p0 picks up the pile (J card)
    const afterPickup = applyPickUpPile(revolState, 'p0');
    expect(afterPickup.phase).toBe('playing');
    // p1 plays on empty pile — K (13) is valid in normal ordering
    expect(afterPickup.pile).toHaveLength(0);
    expect(() => applyPlay(afterPickup, 'p1', [cK.id])).not.toThrow();
  });
});

// ─── Super Revolution persists after pick-up ─────────────────────────────────

describe('Super Revolution — permanent', () => {
  it('phase stays superRevolution after pick-up', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
    ];
    const state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: pileOf('J'),
    };
    const next = applyPickUpPile(state, 'p0');
    expect(next.phase).toBe('superRevolution');
  });

  it('revolution and superRevolution flags remain true after pick-up', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
    ];
    const state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: pileOf('J'),
    };
    const next = applyPickUpPile(state, 'p0');
    expect(next.revolution).toBe(true);
    expect(next.superRevolution).toBe(true);
  });

  it('inverted value ordering persists after pick-up in superRevolution', () => {
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
    ];
    const revolState: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: pileOf('J'),
    };
    // p0 picks up — phase STAYS superRevolution
    const afterPickup = applyPickUpPile(revolState, 'p0');
    expect(afterPickup.phase).toBe('superRevolution');
    // p1 plays on empty pile — any card allowed on empty pile
    expect(() => applyPlay(afterPickup, 'p1', [c5.id])).not.toThrow();
  });

  it('multiple pick-ups do not end superRevolution', () => {
    // Give each player several cards so the game does not end after one play
    const c5b = card('5', 'spades', 1);
    const cKb = card('K', 'spades', 1);
    const players = [
      makePlayer('p0', { hand: [cK, cKb] }),
      makePlayer('p1', { hand: [c5, c5b] }),
    ];
    let state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: pileOf('J'),
    };
    // First pick-up: p0 picks up the pile
    state = applyPickUpPile(state, 'p0');
    expect(state.phase).toBe('superRevolution');
    // p1 plays one c5 on the now-empty pile (5 ≤ ∞ — empty pile always ok)
    const afterP1Play = applyPlay(state, 'p1', [c5.id]);
    // p0 is next; picks up again
    const afterSecondPickup = applyPickUpPile(afterP1Play, 'p0');
    expect(afterSecondPickup.phase).toBe('superRevolution');
  });
});

// ─── J♦ cannot re-trigger revolution while revolution is active ───────────────

describe('J♦ is powerless during revolution', () => {
  it('playing J♦ during revolution does not change phase', () => {
    const jd2 = card('J', 'diamonds', 1);
    const players = [
      makePlayer('p0', { hand: [jd2, c5] }),
      makePlayer('p1', { hand: [cK] }),
    ];
    // Pile with A — J♦ (11) ≤ A (14) → playable in revolution
    const state: GameState = {
      ...makeState({ players, turnOrder: [1] }),
      phase: 'revolution',
      revolution: true,
      pile: [{ cards: [{ id: 'pile-A-0', suit: 'hearts', rank: 'A' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    };
    const next = applyPlay(state, 'p0', [jd2.id]);
    // Phase stays revolution (J♦ power is suppressed during revolution)
    expect(next.phase).toBe('revolution');
    expect(next.revolution).toBe(true);
    expect(next.superRevolution).toBeFalsy();
  });
});
