import { describe, it, expect } from 'vitest';
import type { Card, GameState, GameVariant, MultiJackSequenceEntry, Player } from '../../types';
import { applyPlay } from './play';
import { applyMultiJackOrder, continueMultiJackSequence } from './applyMultiJackOrder';
import { applyRevolutionConfirm } from './applyRevolutionConfirm';
import { applyShifumiTarget, applyShifumiChoice, resolveShifumiResult } from './applyShifumiChoice';
import { applyManoucheTarget, applyManouchePick, applySuperManouchePick } from './applyManoucheChoice';
import { applyFlopReverseTarget, applyFlopRemake, applyFlopRemakeTarget } from './applyFlopReverseChoice';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'], idx = 0): Card {
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

const variant: GameVariant = {
  name: 'test',
  powerAssignments: { mirror: '9', burn: '10', skip: '7', reset: '2', under: '8', target: 'A' },
  playerCount: 4,
  deckCount: 1,
};

/** A base pile entry so that jacks can be played (jacks can't be played on empty pile). */
const basePile = [{ cards: [card('3', 'diamonds', 99)], playerId: 'p3', playerName: 'p3', timestamp: 0 }];

function makeState(overrides: Partial<GameState> = {}): GameState {
  const players = [
    makePlayer('p0'),
    makePlayer('p1'),
    makePlayer('p2'),
    makePlayer('p3'),
  ];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck: [],
    pile: basePile,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2, 3],
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// Jack cards
const jDiamonds = card('J', 'diamonds');    // Revolution
const jSpades = card('J', 'spades');        // Manouche
const jHearts = card('J', 'hearts');        // Flop Reverse
const jClubs = card('J', 'clubs');          // Shifumi
const jDiamonds2 = card('J', 'diamonds', 1);
const jSpades2 = card('J', 'spades', 1);
const jHearts2 = card('J', 'hearts', 1);
const jClubs2 = card('J', 'clubs', 1);
const mirror9 = card('9', 'hearts');
const mirror9b = card('9', 'spades', 1);

// ─── Detection ───────────────────────────────────────────────────────────────

describe('Multi-Jack Detection', () => {
  it('1 jack alone → NOT multi-jack (normal power)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    let result = applyPlay(state, 'p0', [jDiamonds.id]);
    // Revolution triggered via PendingRevolutionConfirm, not PendingMultiJackOrder
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.phase).toBe('revolution');
  });

  it('1 jack + 1 mirror → NOT multi-jack (super power)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, mirror9] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    let result = applyPlay(state, 'p0', [jDiamonds.id, mirror9.id]);
    // Super Revolution triggered via PendingRevolutionConfirm, not PendingMultiJackOrder
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.phase).toBe('superRevolution');
  });

  it('J+J → PendingMultiJackOrder', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');
    if (result.pendingAction?.type === 'PendingMultiJackOrder') {
      expect(result.pendingAction.jacks).toHaveLength(2);
      expect(result.pendingAction.mirrors).toHaveLength(0);
      expect(result.pendingAction.playerId).toBe('p0');
    }
    // No new cards added to pile (only base pile entry remains)
    expect(result.pile).toHaveLength(1);
  });

  it('J+J+9 → PendingMultiJackOrder', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, mirror9] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id, mirror9.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');
    if (result.pendingAction?.type === 'PendingMultiJackOrder') {
      expect(result.pendingAction.jacks).toHaveLength(2);
      expect(result.pendingAction.mirrors).toHaveLength(1);
    }
    expect(result.pile).toHaveLength(1); // base pile only
  });

  it('J+J+J → PendingMultiJackOrder', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, jHearts] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id, jHearts.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');
    if (result.pendingAction?.type === 'PendingMultiJackOrder') {
      expect(result.pendingAction.jacks).toHaveLength(3);
      expect(result.pendingAction.mirrors).toHaveLength(0);
    }
  });

  it('J♠+J♣ → PendingMultiJackOrder, not PendingManouche', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jSpades, jClubs, card('5', 'hearts')] }),
        makePlayer('p1', { hand: [card('3', 'clubs'), card('4', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jSpades.id, jClubs.id], undefined, 'p1');
    // Must be PendingMultiJackOrder — NOT PendingManouche
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');
    expect(result.pendingAction?.type).not.toBe('manouche');
    if (result.pendingAction?.type === 'PendingMultiJackOrder') {
      expect(result.pendingAction.jacks).toHaveLength(2);
      expect(result.pendingAction.playerId).toBe('p0');
    }
  });

  it('J+J+9+9 → quad burn (4 total)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, mirror9, mirror9b] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id, mirror9.id, mirror9b.id]);
    // Should trigger burn, not multi-jack
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('burn');
  });

  it('J+J+J+9 → quad burn (4 total)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, jHearts, mirror9] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });
    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id, jHearts.id, mirror9.id]);
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('burn');
  });
});

// ─── Validation of MultiJackOrderChoice ──────────────────────────────────────

describe('Multi-Jack Order Validation', () => {
  function getPendingState(jacks: Card[], mirrors: Card[]): GameState {
    return makeState({
      players: [
        makePlayer('p0', { hand: [card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
      pendingAction: {
        type: 'PendingMultiJackOrder',
        playerId: 'p0',
        jacks,
        mirrors,
      },
    });
  }

  it('valid J+J choice with all jacks present → OK', () => {
    const state = getPendingState([jDiamonds, jClubs], []);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jClubs },
    ];
    const result = applyMultiJackOrder(state, 'p0', seq);
    expect(result.pendingAction?.type).not.toBe('PendingMultiJackOrder');
  });

  it('choice with missing jack → error', () => {
    const state = getPendingState([jDiamonds, jClubs], []);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      // jClubs missing
    ];
    expect(() => applyMultiJackOrder(state, 'p0', seq)).toThrow(/exactly 2 jacks/);
  });

  it('wrong player → error', () => {
    const state = getPendingState([jDiamonds, jClubs], []);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jClubs },
    ];
    expect(() => applyMultiJackOrder(state, 'p1', seq)).toThrow(/Only the multi-jack launcher/);
  });

  it('J+J+9: mirror assigned to one jack → OK', () => {
    const state = getPendingState([jDiamonds, jClubs], [mirror9]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jClubs },
    ];
    const result = applyMultiJackOrder(state, 'p0', seq);
    expect(result.pendingAction?.type).not.toBe('PendingMultiJackOrder');
  });

  it('J+J+9: mirror not assigned to any jack → error', () => {
    const state = getPendingState([jDiamonds, jClubs], [mirror9]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jClubs },
    ];
    expect(() => applyMultiJackOrder(state, 'p0', seq)).toThrow(/Must assign exactly 1 mirror/);
  });

  it('J+J+9: mirror assigned to both jacks → error', () => {
    const state = getPendingState([jDiamonds, jClubs], [mirror9]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jClubs, mirrorCard: mirror9 },
    ];
    expect(() => applyMultiJackOrder(state, 'p0', seq)).toThrow(/Must assign exactly 1 mirror/);
  });

  it('J+J: choice with mirrorCard → error (no mirror available)', () => {
    const state = getPendingState([jDiamonds, jClubs], []);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jClubs },
    ];
    expect(() => applyMultiJackOrder(state, 'p0', seq)).toThrow(/No mirror available/);
  });
});

// ─── Resolution J+J ──────────────────────────────────────────────────────────

describe('Multi-Jack Resolution J+J', () => {
  it('J♦ then J♥: revolution first, then flop reverse pending', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    // Play both jacks
    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Choose order: revolution first, then flop reverse
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jHearts },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.phase).toBe('revolution');
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    // Revolution jack still on pile (not yet moved to graveyard)
    expect(result.pile.some((e) => e.cards.some((c) => c.id === jDiamonds.id))).toBe(true);

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);

    // Now J♦ in graveyard, flop reverse pending
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.pendingAction?.type).toBe('flopReverse');
    // Flop reverse jack on pile
    expect(result.pile.some((e) => e.cards.some((c) => c.id === jHearts.id))).toBe(true);
  });

  it('J♥ then J♦: flop reverse first (pending), order B then A', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Choose order: flop reverse first, then revolution
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jHearts },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Flop reverse is pending (needs target)
    expect(result.pendingAction?.type).toBe('flopReverse');
    // Revolution not applied yet
    expect(result.revolution).toBeFalsy();
  });

  it('both jacks finish in graveyard after full resolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jHearts },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Resolve flop reverse → choose target
    result = applyFlopReverseTarget(result, 'p0', 'p1');

    // After flopReverse, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('flopReverse');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // jHearts moved to graveyard, PendingRevolutionConfirm set for J♦
    expect(result.graveyard.some((c) => c.id === jHearts.id)).toBe(true);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Server calls continueMultiJackSequence to finalize revolution jack
    result = continueMultiJackSequence(result, 2);

    // After full resolution: both jacks in graveyard
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jHearts.id)).toBe(true);
    // multiJackSequence cleaned up
    expect(result.multiJackSequence).toBeUndefined();
    // Turn advanced to next player
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('turn advances to next player after launcher after full resolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    // Both are revolution (J♦) — first revolution applied (step-by-step)
    result = applyMultiJackOrder(result, 'p0', seq);

    // First revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    expect(result.multiJackSequence).toBeDefined();

    // Continue: move first jack to graveyard, second revolution (PendingRevolutionConfirm)
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move second jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);

    // Both resolved, turn advanced
    expect(result.pendingAction).toBeNull();
    expect(result.multiJackSequence).toBeUndefined();
    expect(result.currentPlayerIndex).toBe(1);
    // Both jacks in graveyard
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jDiamonds2.id)).toBe(true);
  });
});

// ─── Resolution J+J+9 ───────────────────────────────────────────────────────

describe('Multi-Jack Resolution J+J+9 (mirror assignment)', () => {
  it('mirror on first jack → super version of first, normal version of second', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, mirror9, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id, mirror9.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Mirror on J♦ → super revolution, then J♥ → normal flop reverse
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jHearts },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Super revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.superRevolution).toBe(true);
    expect(result.phase).toBe('superRevolution');
    expect(result.lastPowerTriggered?.type).toBe('superRevolution');

    // Continue: move J♦+mirror to graveyard, flop reverse pending
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('flopReverse');
    // Mirror and J♦ now in graveyard
    expect(result.graveyard.some((c) => c.id === mirror9.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
  });

  it('mirror on second jack → normal version of first, super version of second', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, mirror9, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id, mirror9.id]);

    // Mirror on J♥ → normal revolution first, then super flop remake
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jHearts, mirrorCard: mirror9 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Normal revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.superRevolution).toBeFalsy();
    expect(result.phase).toBe('revolution');
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move J♦ to graveyard, flop REMAKE (super) pending
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('flopRemake');
  });

  it('mirror goes to graveyard with assigned jack after resolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, mirror9, card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id, mirror9.id]);

    // Mirror on first J♦ → super revolution, second J♦ → normal revolution
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // First: super revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.superRevolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('superRevolution');

    // Continue: move J♦+mirror to graveyard, second revolution (PendingRevolutionConfirm)
    result = continueMultiJackSequence(result, 1);
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === mirror9.id)).toBe(true);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');

    // Continue: move second J♦ to graveyard, finalize
    result = continueMultiJackSequence(result, 2);

    // All in graveyard
    expect(result.graveyard.some((c) => c.id === jDiamonds2.id)).toBe(true);
  });
});

// ─── Resolution J+J+J ───────────────────────────────────────────────────────

describe('Multi-Jack Resolution J+J+J', () => {
  it('3 jacks in given order → all 3 powers apply sequentially', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, jClubs] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id, jClubs.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Order: revolution, flop reverse, shifumi
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jHearts },
      { jackCard: jClubs },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move J♦ to graveyard, then flop reverse pending
    result = continueMultiJackSequence(result, 1);
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.pendingAction?.type).toBe('flopReverse');
    // J♥ on pile (pending resolution)
    expect(result.pile.some((e) => e.cards.some((c) => c.id === jHearts.id))).toBe(true);
  });

  it('all 3 jacks end in graveyard after full resolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, jClubs] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id, jClubs.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jHearts },
      { jackCard: jClubs },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    result = continueMultiJackSequence(result, 1);

    // Resolve flop reverse
    expect(result.pendingAction?.type).toBe('flopReverse');
    result = applyFlopReverseTarget(result, 'p0', 'p1');

    // After flopReverse, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('flopReverse');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('shifumi');

    // Resolve shifumi: choose targets
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    // Both submit choices
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors'); // p1 wins
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay → finalize
    result = continueMultiJackSequence(result, 2);

    // All 3 jacks in graveyard
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jHearts.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jClubs.id)).toBe(true);
    // Sequence complete
    expect(result.multiJackSequence).toBeUndefined();
    expect(result.pendingAction).toBeNull();
  });
});

// ─── Revolution + Shifumi interaction ────────────────────────────────────────

describe('Revolution + Shifumi interaction (critical)', () => {
  it('J♦ (revolution) then J♣ (shifumi lost) → revolution cancelled', () => {
    const state = makeState({
      pile: [{ cards: [card('5', 'hearts')], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jClubs },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move J♦ to graveyard, shifumi pending
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('shifumi');
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);

    // Resolve shifumi: p0 (launcher) participates and loses
    result = applyShifumiTarget(result, 'p0', 'p0', 'p1');
    result = applyShifumiChoice(result, 'p0', 'scissors');
    result = applyShifumiChoice(result, 'p1', 'rock'); // p0 loses
    result = resolveShifumiResult(result);

    // Intermediate state: jack visible on pile, pickup deferred
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');
    // Jack still on pile (visible for animation)
    expect(result.pile.length).toBeGreaterThan(0);
    // Revolution not cancelled yet (pile not emptied yet)
    expect(result.revolution).toBe(true);

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 2);

    // Revolution cancelled (pile was emptied)
    expect(result.revolution).toBe(false);
    expect(result.phase).toBe('playing');
    // p0 picked up the previous pile cards (but NOT the jacks)
    expect(result.pile).toHaveLength(0);
    // Jacks should be in graveyard, not in p0's hand
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jClubs.id)).toBe(true);
    expect(result.players[0]!.hand.every((c) => c.rank !== 'J')).toBe(true);
  });

  it('J♦ (revolution) then J♣ (shifumi lost by anyone) → revolution cancelled', () => {
    const state = makeState({
      pile: [{ cards: [card('5', 'hearts')], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jClubs },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);

    // Continue: move J♦ to graveyard, shifumi pending
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('shifumi');

    // Resolve shifumi: p1 and p2 play, p2 loses
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors'); // p2 loses
    result = resolveShifumiResult(result);

    // Intermediate state: jack visible on pile, pickup deferred
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');
    expect(result.revolution).toBe(true); // Not cancelled yet

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 2);

    // Revolution cancelled — pile was emptied by the shifumi loss,
    // regardless of who lost. Revolution is tied to the pile.
    expect(result.revolution).toBe(false);
    expect(result.phase).toBe('playing');
  });

  it('J♣ (shifumi lost) then J♦ (revolution) → revolution active on empty pile', () => {
    const state = makeState({
      pile: [{ cards: [card('5', 'hearts')], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Shifumi pending first
    expect(result.pendingAction?.type).toBe('shifumi');

    // p0 loses shifumi → pile emptied
    result = applyShifumiTarget(result, 'p0', 'p0', 'p1');
    result = applyShifumiChoice(result, 'p0', 'scissors');
    result = applyShifumiChoice(result, 'p1', 'rock'); // p0 loses
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.phase).toBe('revolution');
    expect(result.graveyard.some((c) => c.id === jClubs.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
  });

  it('J♣ (shifumi won) then J♦ (revolution) → revolution active', () => {
    const state = makeState({
      pile: [{ cards: [card('5', 'hearts')], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // p2 loses shifumi (not the launcher)
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors'); // p2 loses
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.phase).toBe('revolution');
  });
});

// ─── Manouche after shifumi (pile picked up) ────────────────────────────────

describe('Manouche after shifumi in sequence', () => {
  it('J♣ (shifumi lost) then J♠ (manouche) → launcher uses picked-up cards', () => {
    const giveCard = card('5', 'diamonds');
    const state = makeState({
      pile: [{ cards: [giveCard], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClubs, jSpades, card('K', 'hearts')] }),
        makePlayer('p1', { hand: [card('Q', 'hearts'), card('3', 'spades')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jSpades.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jSpades },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Shifumi first: p0 participates and loses
    result = applyShifumiTarget(result, 'p0', 'p0', 'p1');
    result = applyShifumiChoice(result, 'p0', 'scissors');
    result = applyShifumiChoice(result, 'p1', 'rock'); // p0 loses, picks up pile
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);

    // Manouche pending — need to select target
    expect(result.pendingAction?.type).toBe('manouche');

    // Select target for manouche
    result = applyManoucheTarget(result, 'p0', 'p1');

    // p0 should have the pile cards in hand now (picked up from shifumi loss)
    const p0 = result.players.find((p) => p.id === 'p0')!;
    expect(p0.hand.some((c) => c.id === giveCard.id)).toBe(true);

    // p0 gives the picked-up card to p1, takes a card from p1
    result = applyManouchePick(result, 'p0', card('Q', 'hearts').id, [giveCard.id]);

    // After manouche, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('manouche');

    // Exchange happened
    const p0After = result.players.find((p) => p.id === 'p0')!;
    const p1After = result.players.find((p) => p.id === 'p1')!;
    expect(p0After.hand.some((c) => c.id === card('Q', 'hearts').id)).toBe(true);
    expect(p1After.hand.some((c) => c.id === giveCard.id)).toBe(true);

    // Server calls continueMultiJackSequence after animation delay → finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
  });
});

// ─── Flop reverse in sequence (hasSeenDarkFlop) ─────────────────────────────

describe('Flop reverse in multi-jack sequence', () => {
  it('J♥ sets hasSeenDarkFlop on target', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jHearts, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('Q', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jHearts.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jHearts },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Flop reverse pending
    expect(result.pendingAction?.type).toBe('flopReverse');

    // Choose target
    result = applyFlopReverseTarget(result, 'p0', 'p1');

    // hasSeenDarkFlop set on target
    const p1 = result.players.find((p) => p.id === 'p1')!;
    expect(p1.hasSeenDarkFlop).toBe(true);
    expect(p1.faceDownRevealed).toBe(true);
    // After flopReverse, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('flopReverse');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
  });
});

// ─── Pending intermediaries ──────────────────────────────────────────────────

describe('Pending intermediaries', () => {
  it('J♣ + J♦: shifumi pending, after resolution → continues to revolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Shifumi pending
    expect(result.pendingAction?.type).toBe('shifumi');
    expect(result.multiJackSequence).toBeTruthy();

    // Resolve shifumi
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors');
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    expect(result.multiJackSequence).toBeDefined();

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
    expect(result.pendingAction).toBeNull();
  });

  it('J♠ in multi-jack → PendingManouche WITHOUT targetId (two-step flow)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jSpades, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1', { hand: [card('Q', 'hearts')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jSpades.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jSpades },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Manouche pending — targetId must be undefined (requires manoucheTarget action)
    expect(result.pendingAction?.type).toBe('manouche');
    if (result.pendingAction?.type === 'manouche') {
      expect(result.pendingAction.targetId).toBeUndefined();
      expect(result.pendingAction.launcherId).toBe('p0');
    }

    // After manoucheTarget, targetId is set
    result = applyManoucheTarget(result, 'p0', 'p1');
    expect(result.pendingAction?.type).toBe('manouche');
    if (result.pendingAction?.type === 'manouche') {
      expect(result.pendingAction.targetId).toBe('p1');
    }
  });

  it('J♠ + J♦: manouche pending (with target selection), after resolution → continues', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jSpades, jDiamonds, card('K', 'hearts'), card('5', 'hearts', 2)] }),
        makePlayer('p1', { hand: [card('Q', 'hearts'), card('3', 'spades')] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jSpades.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jSpades },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Manouche pending — no target yet
    expect(result.pendingAction?.type).toBe('manouche');

    // Select target
    result = applyManoucheTarget(result, 'p0', 'p1');

    // Do the exchange
    result = applyManouchePick(result, 'p0', card('Q', 'hearts').id, [card('5', 'hearts', 2).id]);

    // After manouche, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('manouche');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
  });

  it('multiJackSequence is cleaned up after last jack', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // First revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.multiJackSequence).toBeDefined();

    // Continue: first jack → graveyard + second revolution (PendingRevolutionConfirm)
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    // Continue: second jack → graveyard + finalize
    result = continueMultiJackSequence(result, 2);

    expect(result.multiJackSequence).toBeUndefined();
    expect(result.pendingAction).toBeNull();
  });
});

// ─── End of sequence ─────────────────────────────────────────────────────────

describe('End of sequence', () => {
  it('after all jacks resolved → turn to next player after launcher', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Step-by-step: confirm + continue for each revolution
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 2);

    expect(result.currentPlayerIndex).toBe(1);
    expect(result.multiJackSequence).toBeUndefined();
  });

  it('all jacks and mirrors end in graveyard', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, mirror9, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id, mirror9.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds, mirrorCard: mirror9 },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Step-by-step: confirm + continue for each revolution
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 2);

    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jDiamonds2.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === mirror9.id)).toBe(true);
  });

  it('cards removed from hand on play', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id]);
    const p0 = result.players.find((p) => p.id === 'p0')!;
    // Jacks removed from hand
    expect(p0.hand.some((c) => c.id === jDiamonds.id)).toBe(false);
    expect(p0.hand.some((c) => c.id === jClubs.id)).toBe(false);
    // Other card remains
    expect(p0.hand.some((c) => c.rank === 'K')).toBe(true);
  });
});

// ─── Flop remake in sequence ─────────────────────────────────────────────────

describe('Flop remake in multi-jack sequence (J+J+9)', () => {
  it('J♥ with mirror → flop remake pending, target chooses distribution', () => {
    const flopCard = card('K', 'hearts');
    const darkCard = card('3', 'clubs');
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jHearts, jDiamonds, mirror9, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [flopCard], faceDown: [darkCard] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jHearts.id, jDiamonds.id, mirror9.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jHearts, mirrorCard: mirror9 },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Flop remake pending
    expect(result.pendingAction?.type).toBe('flopRemake');

    // Choose target
    result = applyFlopRemakeTarget(result, 'p0', 'p1');

    // Target redistributes cards
    result = applyFlopRemake(result, 'p1', [darkCard.id], [flopCard.id]);

    // After flop remake, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('flopRemake');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
    const p1 = result.players.find((p) => p.id === 'p1')!;
    expect(p1.hasSeenDarkFlop).toBe(true);
  });
});

// ─── Super manouche in sequence ──────────────────────────────────────────────

describe('Super manouche in multi-jack sequence', () => {
  it('J♠ with mirror → super manouche, free exchange', () => {
    const card5 = card('5', 'hearts', 2);
    const card6 = card('6', 'hearts', 3);
    const cardQ = card('Q', 'hearts');
    const card3 = card('3', 'spades');
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jSpades, jDiamonds, mirror9, card5, card6] }),
        makePlayer('p1', { hand: [cardQ, card3] }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jSpades.id, jDiamonds.id, mirror9.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jSpades, mirrorCard: mirror9 },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Super manouche pending
    expect(result.pendingAction?.type).toBe('superManouche');

    // Select target
    result = applyManoucheTarget(result, 'p0', 'p1');

    // Free exchange: give 1 card, take 1 card
    result = applySuperManouchePick(result, 'p0', [card5.id], [cardQ.id]);

    // After super manouche, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('superManouche');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
  });
});

// ─── Super shifumi in multi-jack sequence ────────────────────────────────────

describe('Super shifumi in multi-jack sequence', () => {
  it('J♣ with mirror → super shifumi, loser = shit head, game ends', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, mirror9] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id, mirror9.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs, mirrorCard: mirror9 },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Super shifumi pending
    expect(result.pendingAction?.type).toBe('superShifumi');

    // Resolve super shifumi: p2 is shit head
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors');
    result = resolveShifumiResult(result);

    // Game ends immediately
    expect(result.phase).toBe('finished');
    expect(result.players.find((p) => p.id === 'p2')!.isShitHead).toBe(true);
    // Multi-jack sequence cleaned up
    expect(result.multiJackSequence).toBeUndefined();
  });
});

// ─── Shifumi tie during multi-jack ──────────────────────────────────────────

describe('Shifumi tie during multi-jack', () => {
  it('tie resets choices, same matchup replays, sequence continues after resolution', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Shifumi pending
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');

    // Tie → PendingShifumiResult with result=tie
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'rock');
    result = resolveShifumiResult(result);

    // Still pending shifumi (tie reset)
    expect(result.pendingAction?.type).toBe('shifumi');
    const pending = result.pendingAction as { player1Choice?: string; player2Choice?: string };
    expect(pending.player1Choice).toBeUndefined();
    expect(pending.player2Choice).toBeUndefined();

    // Replay and resolve
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors');
    result = resolveShifumiResult(result);

    // After shifumi, intermediate state: lastPowerTriggered set, pendingAction null
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);
    // PendingRevolutionConfirm set for J♦
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');

    // Continue: move revolution jack to graveyard, finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.multiJackSequence).toBeUndefined();
  });
});

// ─── Auto-draw during multi-jack ─────────────────────────────────────────────

describe('Auto-draw during multi-jack', () => {
  it('player auto-draws before PendingMultiJackOrder when deck is non-empty', () => {
    const deckCard = card('4', 'spades');
    const state = makeState({
      deck: [deckCard],
      players: [
        makePlayer('p0', { hand: [jDiamonds, jClubs] }), // Only 2 cards, plays both
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    const result = applyPlay(state, 'p0', [jDiamonds.id, jClubs.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');
    // Player should have drawn from deck
    const p0 = result.players.find((p) => p.id === 'p0')!;
    expect(p0.hand.some((c) => c.id === deckCard.id)).toBe(true);
    expect(result.deck).toHaveLength(0);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('not pending state → applyMultiJackOrder throws', () => {
    const state = makeState();
    expect(() => applyMultiJackOrder(state, 'p0', [])).toThrow(/No pending multi-jack/);
  });

  it('two revolution jacks → revolution applied twice (still just revolution)', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // First revolution deferred — PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.phase).toBe('revolution');
    // Step-by-step: first jack still on pile
    expect(result.graveyard).toHaveLength(0);

    // Continue: move first jack to graveyard + second revolution (PendingRevolutionConfirm)
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    result = applyRevolutionConfirm(result, 'p0');
    // Continue: move second jack to graveyard + finalize
    result = continueMultiJackSequence(result, 2);
    expect(result.graveyard).toHaveLength(2);
  });

  it('two shifumi jacks → both resolved sequentially', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jClubs, jClubs2, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jClubs2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jClubs2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // First shifumi pending
    expect(result.pendingAction?.type).toBe('shifumi');
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors');
    result = resolveShifumiResult(result);

    // After first shifumi, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 1);

    // Second shifumi pending
    expect(result.pendingAction?.type).toBe('shifumi');
    result = applyShifumiTarget(result, 'p0', 'p1', 'p3');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p3', 'scissors');
    result = resolveShifumiResult(result);

    // After second shifumi, intermediate state
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');

    // Server calls continueMultiJackSequence after animation delay → finalize
    result = continueMultiJackSequence(result, 2);

    // Both resolved
    expect(result.multiJackSequence).toBeUndefined();
    expect(result.pendingAction).toBeNull();
    expect(result.graveyard.some((c) => c.id === jClubs.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jClubs2.id)).toBe(true);
  });

  it('J+J with pile already non-empty → cards placed on existing pile during resolution', () => {
    const existingPileCard = card('5', 'hearts', 5);
    const state = makeState({
      pile: [{ cards: [existingPileCard], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Step-by-step: confirm + continue for each revolution
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 1);
    result = applyRevolutionConfirm(result, 'p0');
    result = continueMultiJackSequence(result, 2);

    // Both jacks resolved (revolution), both in graveyard
    expect(result.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(result.graveyard.some((c) => c.id === jDiamonds2.id)).toBe(true);
    // Original pile card should still be there
    expect(result.pile.some((e) => e.cards.some((c) => c.id === existingPileCard.id))).toBe(true);
  });

  it('shifumi loss during multi-jack → loser picks up pile but NOT the jack', () => {
    const pileCard = card('5', 'hearts', 5);
    const state = makeState({
      pile: [{ cards: [pileCard], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClubs, jDiamonds, card('K', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    let result = applyPlay(state, 'p0', [jClubs.id, jDiamonds.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jClubs },
      { jackCard: jDiamonds },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // Shifumi: p2 loses
    result = applyShifumiTarget(result, 'p0', 'p1', 'p2');
    result = applyShifumiChoice(result, 'p1', 'rock');
    result = applyShifumiChoice(result, 'p2', 'scissors');
    result = resolveShifumiResult(result);

    // Intermediate state: jack visible on pile, pickup deferred
    expect(result.pendingAction).toBeNull();
    expect(result.lastPowerTriggered?.type).toBe('shifumi');
    // Jack still on pile (visible for animation)
    expect(result.pile.some((e) => e.cards.some((c) => c.id === jClubs.id))).toBe(true);

    // Server calls continueMultiJackSequence after animation delay
    result = continueMultiJackSequence(result, 2);

    // p2 picked up the pile (including the existing card) but NOT the jack
    const p2 = result.players.find((p) => p.id === 'p2')!;
    expect(p2.hand.some((c) => c.id === pileCard.id)).toBe(true);
    expect(p2.hand.every((c) => c.rank !== 'J')).toBe(true);
    // Jack is in graveyard
    expect(result.graveyard.some((c) => c.id === jClubs.id)).toBe(true);
  });
});
