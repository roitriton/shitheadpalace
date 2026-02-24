import { describe, it, expect } from 'vitest';
import {
  getTopPileValue,
  getActiveZone,
  getZoneCards,
  setZoneCards,
  allSameRank,
  canPlayCards,
  canPlayerPlayAnything,
} from './validation';
import type { Card, GameState, PileEntry, Player } from '../types';

// ─── test helpers ─────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pileEntry(cards: Card[]): PileEntry {
  return { cards, playerId: 'p1', playerName: 'P1', timestamp: 0 };
}

function emptyPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'P1',
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    isBot: false,
    ...overrides,
  };
}

function playingState(pile: PileEntry[] = [], phase: GameState['phase'] = 'playing'): GameState {
  return {
    id: 'g1',
    phase,
    players: [emptyPlayer(), emptyPlayer({ id: 'p2', name: 'P2' })],
    deck: [],
    pile,
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

// ─── getTopPileValue ──────────────────────────────────────────────────────────

describe('getTopPileValue', () => {
  it('returns null for an empty pile', () => {
    expect(getTopPileValue(playingState([]))).toBeNull();
  });

  it('returns the rank value of the last pile entry', () => {
    const state = playingState([pileEntry([card('7')])]);
    expect(getTopPileValue(state)).toBe(7);
  });

  it('uses the most recent entry (not the first)', () => {
    const state = playingState([pileEntry([card('3')]), pileEntry([card('K')])]);
    expect(getTopPileValue(state)).toBe(13);
  });

  it('handles face cards correctly (J=11, Q=12, K=13, A=14)', () => {
    expect(getTopPileValue(playingState([pileEntry([card('J')])]))).toBe(11);
    expect(getTopPileValue(playingState([pileEntry([card('Q')])]))).toBe(12);
    expect(getTopPileValue(playingState([pileEntry([card('K')])]))).toBe(13);
    expect(getTopPileValue(playingState([pileEntry([card('A')])]))).toBe(14);
  });
});

// ─── getActiveZone ────────────────────────────────────────────────────────────

describe('getActiveZone', () => {
  it('returns hand when the player has cards in hand', () => {
    expect(getActiveZone(emptyPlayer({ hand: [card('5')] }))).toBe('hand');
  });

  it('returns faceUp when hand is empty but faceUp has cards', () => {
    expect(getActiveZone(emptyPlayer({ faceUp: [card('7')] }))).toBe('faceUp');
  });

  it('returns faceDown when hand and faceUp are both empty', () => {
    expect(getActiveZone(emptyPlayer({ faceDown: [card('9')] }))).toBe('faceDown');
  });

  it('returns null when all zones are empty', () => {
    expect(getActiveZone(emptyPlayer())).toBeNull();
  });

  it('prefers hand over faceUp and faceDown', () => {
    const player = emptyPlayer({
      hand: [card('5')],
      faceUp: [card('7')],
      faceDown: [card('9')],
    });
    expect(getActiveZone(player)).toBe('hand');
  });
});

// ─── getZoneCards / setZoneCards ──────────────────────────────────────────────

describe('getZoneCards', () => {
  const p = emptyPlayer({
    hand: [card('2')],
    faceUp: [card('5')],
    faceDown: [card('8')],
  });

  it('returns hand cards', () => expect(getZoneCards(p, 'hand')).toBe(p.hand));
  it('returns faceUp cards', () => expect(getZoneCards(p, 'faceUp')).toBe(p.faceUp));
  it('returns faceDown cards', () => expect(getZoneCards(p, 'faceDown')).toBe(p.faceDown));
});

describe('setZoneCards', () => {
  const p = emptyPlayer({ hand: [card('A')] });
  const newCards = [card('2')];

  it('replaces hand', () => expect(setZoneCards(p, 'hand', newCards).hand).toEqual(newCards));
  it('replaces faceUp', () => expect(setZoneCards(p, 'faceUp', newCards).faceUp).toEqual(newCards));
  it('replaces faceDown', () =>
    expect(setZoneCards(p, 'faceDown', newCards).faceDown).toEqual(newCards));

  it('does not mutate the original player', () => {
    setZoneCards(p, 'hand', newCards);
    expect(p.hand).toEqual([card('A')]);
  });
});

// ─── allSameRank ──────────────────────────────────────────────────────────────

describe('allSameRank', () => {
  it('returns false for an empty array', () => expect(allSameRank([])).toBe(false));
  it('returns true for a single card', () => expect(allSameRank([card('7')])).toBe(true));
  it('returns true when all cards share a rank', () => {
    expect(allSameRank([card('7', 'hearts'), card('7', 'spades'), card('7', 'clubs')])).toBe(true);
  });
  it('returns false when ranks differ', () => {
    expect(allSameRank([card('7'), card('8')])).toBe(false);
  });
});

// ─── canPlayCards ─────────────────────────────────────────────────────────────

describe('canPlayCards', () => {
  it('returns false for an empty array', () => {
    expect(canPlayCards([], playingState())).toBe(false);
  });

  it('allows anything on an empty pile', () => {
    expect(canPlayCards([card('3')], playingState())).toBe(true);
    expect(canPlayCards([card('2')], playingState())).toBe(true);
    expect(canPlayCards([card('A')], playingState())).toBe(true);
  });

  it('allows a card of equal value', () => {
    const state = playingState([pileEntry([card('7')])]);
    expect(canPlayCards([card('7', 'spades')], state)).toBe(true);
  });

  it('allows a card of higher value', () => {
    const state = playingState([pileEntry([card('7')])]);
    expect(canPlayCards([card('K')], state)).toBe(true);
  });

  it('rejects a card of lower value', () => {
    const state = playingState([pileEntry([card('K')])]);
    expect(canPlayCards([card('7')], state)).toBe(false);
  });

  it('rejects cards of different ranks', () => {
    const state = playingState();
    expect(canPlayCards([card('5'), card('7')], state)).toBe(false);
  });

  it('inverts the rule during revolution phase (must play ≤)', () => {
    const state = playingState([pileEntry([card('7')])], 'revolution');
    expect(canPlayCards([card('5')], state)).toBe(true);  // 5 ≤ 7 ✓
    expect(canPlayCards([card('K')], state)).toBe(false); // 13 > 7 ✗
  });

  it('inverts the rule during superRevolution phase', () => {
    const state = playingState([pileEntry([card('7')])], 'superRevolution');
    expect(canPlayCards([card('3')], state)).toBe(true);
    expect(canPlayCards([card('A')], state)).toBe(false);
  });

  it('allows any card when pileResetActive is true', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('K')])]),
      pileResetActive: true,
    };
    expect(canPlayCards([card('2')], state)).toBe(true); // normally rejected (2 < K)
    expect(canPlayCards([card('7')], state)).toBe(true);
  });

  it('pileResetActive is ignored during revolution (revolution takes priority)', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('7')])], 'revolution'),
      pileResetActive: true,
    };
    // In revolution: play ≤ 7. K (13) > 7 → still rejected even with Reset active.
    expect(canPlayCards([card('K')], state)).toBe(false);
  });

  it('enforces ≤ Under value when activeUnder is set', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('5')])]),
      activeUnder: 8,
    };
    expect(canPlayCards([card('6')], state)).toBe(true);  // 6 ≤ 8 ✓
    expect(canPlayCards([card('8')], state)).toBe(true);  // 8 ≤ 8 ✓
    expect(canPlayCards([card('9')], state)).toBe(false); // 9 > 8 ✗
    expect(canPlayCards([card('K')], state)).toBe(false); // 13 > 8 ✗
  });

  it('activeUnder is ignored during revolution (revolution takes priority)', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('K')])], 'revolution'),
      activeUnder: 8,
    };
    // In revolution: play ≤ K (13). 5 ≤ 13 → allowed (Under doesn't add extra constraint).
    expect(canPlayCards([card('5')], state)).toBe(true);
  });
});

// ─── canPlayCards — special power ranks ──────────────────────────────────────

describe('canPlayCards — special power ranks (Reset / Skip / Burn)', () => {
  it('Reset-rank is always playable on a higher pile value', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('K')])]),
      variant: { name: 'S', powerAssignments: { reset: '2' }, playerCount: 2, deckCount: 1 },
    };
    expect(canPlayCards([card('2')], state)).toBe(true); // 2 < K, but Reset bypasses
  });

  it('Reset-rank bypasses Under even when Reset value > Under value', () => {
    // Non-standard variant: K is the reset card, so K(13) must be allowed even with Under(7)
    const state: GameState = {
      ...playingState([pileEntry([card('5')])]),
      variant: { name: 'S', powerAssignments: { reset: 'K' }, playerCount: 2, deckCount: 1 },
      activeUnder: 7,
    };
    expect(canPlayCards([card('K')], state)).toBe(true); // K(13) > Under(7), but Reset bypasses
  });

  it('Skip-rank is always playable on a higher pile value', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('K')])]),
      variant: { name: 'S', powerAssignments: { skip: '7' }, playerCount: 2, deckCount: 1 },
    };
    expect(canPlayCards([card('7')], state)).toBe(true); // 7 < K, but Skip bypasses
  });

  it('Skip-rank is playable even when Under is active', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('5')])]),
      variant: { name: 'S', powerAssignments: { skip: '7' }, playerCount: 2, deckCount: 1 },
      activeUnder: 5,
    };
    expect(canPlayCards([card('7')], state)).toBe(true); // 7 > Under(5), but Skip bypasses
  });

  it('Burn-rank is playable on a higher pile value in normal play', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('K')])]),
      variant: { name: 'S', powerAssignments: { burn: '10' }, playerCount: 2, deckCount: 1 },
    };
    expect(canPlayCards([card('10')], state)).toBe(true); // 10 < K, but Burn bypasses
  });

  it('Burn-rank is blocked by Under when Burn value > Under value', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('5')])]),
      variant: { name: 'S', powerAssignments: { burn: '10' }, playerCount: 2, deckCount: 1 },
      activeUnder: 7,
    };
    expect(canPlayCards([card('10')], state)).toBe(false); // 10 > Under(7)
  });

  it('Burn-rank is playable when Under value >= Burn value', () => {
    const state: GameState = {
      ...playingState([pileEntry([card('5')])]),
      variant: { name: 'S', powerAssignments: { burn: '10' }, playerCount: 2, deckCount: 1 },
      activeUnder: 11, // J = 11
    };
    expect(canPlayCards([card('10')], state)).toBe(true); // 10 ≤ Under(11)
  });
});

// ─── getTopPileValue — effectiveRank ──────────────────────────────────────────

describe('getTopPileValue — effectiveRank (Mirror)', () => {
  it('uses effectiveRank when set on the top PileEntry', () => {
    const entry: PileEntry = {
      cards: [card('9'), card('7')], // physical cards
      playerId: 'p1',
      playerName: 'P1',
      timestamp: 0,
      effectiveRank: 'K', // Mirror overrides to K
    };
    const state = playingState([entry]);
    expect(getTopPileValue(state)).toBe(13); // K = 13
  });

  it('falls back to first card rank when effectiveRank is absent', () => {
    const state = playingState([pileEntry([card('7')])]);
    expect(getTopPileValue(state)).toBe(7);
  });
});

// ─── canPlayCards — Jacks on empty pile ────────────────────────────────────────

describe('canPlayCards — Jacks on empty pile', () => {
  it('rejects a single Jack on empty pile', () => {
    const state = playingState([]);
    expect(canPlayCards([card('J', 'diamonds')], state)).toBe(false);
  });

  it('rejects Jacks of all suits on empty pile', () => {
    const state = playingState([]);
    for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as const) {
      expect(canPlayCards([card('J', suit)], state)).toBe(false);
    }
  });

  it('allows Jack on non-empty pile', () => {
    const state = playingState([pileEntry([card('5')])]);
    expect(canPlayCards([card('J', 'hearts')], state)).toBe(true);
  });

  it('allows non-Jack cards on empty pile', () => {
    const state = playingState([]);
    expect(canPlayCards([card('5')], state)).toBe(true);
    expect(canPlayCards([card('K')], state)).toBe(true);
    expect(canPlayCards([card('A')], state)).toBe(true);
  });

  it('rejects Jack on empty pile even during revolution', () => {
    const state = playingState([], 'revolution');
    expect(canPlayCards([card('J', 'diamonds')], state)).toBe(false);
  });
});

// ─── canPlayerPlayAnything ───────────────────────────────────────────────────

describe('canPlayerPlayAnything', () => {
  function stateWith(
    hand: Card[] = [],
    faceUp: Card[] = [],
    faceDown: Card[] = [],
    pile: PileEntry[] = [],
  ): GameState {
    return {
      ...playingState(pile),
      players: [
        emptyPlayer({ hand, faceUp, faceDown }),
        emptyPlayer({ id: 'p2', name: 'P2' }),
      ],
    };
  }

  it('returns false when player has no cards at all', () => {
    const state = stateWith();
    expect(canPlayerPlayAnything(state, 0)).toBe(false);
  });

  it('returns true when player has a playable hand card', () => {
    const state = stateWith([card('5')]);
    expect(canPlayerPlayAnything(state, 0)).toBe(true);
  });

  it('returns false when player only has Jacks and pile is empty', () => {
    const state = stateWith([card('J', 'hearts'), card('J', 'diamonds')]);
    expect(canPlayerPlayAnything(state, 0)).toBe(false);
  });

  it('returns false when player only has Mirror cards', () => {
    const state: GameState = {
      ...stateWith([card('9')]),
      variant: { name: 'S', powerAssignments: { mirror: '9' }, playerCount: 2, deckCount: 1 },
    };
    expect(canPlayerPlayAnything(state, 0)).toBe(false);
  });

  it('returns true when player has a playable faceUp card (hand empty)', () => {
    const state = stateWith([], [card('5')]);
    expect(canPlayerPlayAnything(state, 0)).toBe(true);
  });

  it('returns true when player has playable faceDown card (hand+faceUp empty)', () => {
    const state = stateWith([], [], [card('5')]);
    expect(canPlayerPlayAnything(state, 0)).toBe(true);
  });

  it('returns false when only faceDown card is a Jack and pile is empty', () => {
    const state = stateWith([], [], [card('J', 'hearts')]);
    expect(canPlayerPlayAnything(state, 0)).toBe(false);
  });
});
