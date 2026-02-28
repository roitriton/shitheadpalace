import { describe, it, expect } from 'vitest';
import { canBotActOnPendingAction, tryResolveBotPendingAction, botActOnce } from './bot';
import type {
  Card,
  GameState,
  GameVariant,
  Player,
  PendingMultiJackOrder,
  MultiJackSequenceEntry,
} from '@shit-head-palace/engine';
import { applyMultiJackOrder, continueMultiJackSequence, applyRevolutionConfirm } from '@shit-head-palace/engine';
import { applyPlay } from '@shit-head-palace/engine';

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
  playerCount: 3,
  deckCount: 1,
};

const basePile = [
  { cards: [card('3', 'diamonds', 99)], playerId: 'p2', playerName: 'p2', timestamp: 0 },
];

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    phase: 'playing',
    players: [makePlayer('p0'), makePlayer('p1'), makePlayer('p2')],
    deck: [],
    pile: basePile,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2],
    finishOrder: [],
    variant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// Jack cards
const jDiamonds = card('J', 'diamonds'); // Revolution
const jSpades = card('J', 'spades'); // Manouche
const jHearts = card('J', 'hearts'); // Flop Reverse
const jClubs = card('J', 'clubs'); // Shifumi
const mirror9 = card('9', 'hearts');

// ─── canBotActOnPendingAction ────────────────────────────────────────────────

describe('canBotActOnPendingAction — PendingMultiJackOrder', () => {
  it('returns true when bot is the multi-jack launcher', () => {
    const pending: PendingMultiJackOrder = {
      type: 'PendingMultiJackOrder',
      playerId: 'bot1',
      jacks: [jDiamonds, jHearts],
      mirrors: [],
    };
    const state = makeState({ pendingAction: pending });
    expect(canBotActOnPendingAction(state, ['bot1', 'bot2'])).toBe(true);
  });

  it('returns false when human is the multi-jack launcher', () => {
    const pending: PendingMultiJackOrder = {
      type: 'PendingMultiJackOrder',
      playerId: 'human1',
      jacks: [jDiamonds, jHearts],
      mirrors: [],
    };
    const state = makeState({ pendingAction: pending });
    expect(canBotActOnPendingAction(state, ['bot1', 'bot2'])).toBe(false);
  });
});

// ─── tryResolveBotPendingAction ──────────────────────────────────────────────

describe('tryResolveBotPendingAction — PendingMultiJackOrder', () => {
  it('resolves J+J: state has no more PendingMultiJackOrder', () => {
    const state = makeState({
      players: [
        makePlayer('bot1', { hand: [jDiamonds, jHearts, card('5', 'hearts')], isBot: true }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
      ],
    });

    // Play both jacks to get PendingMultiJackOrder
    let s = applyPlay(state, 'bot1', [jDiamonds.id, jHearts.id]);
    expect(s.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Bot resolves it
    s = tryResolveBotPendingAction(s, ['bot1']);
    expect(s.pendingAction?.type).not.toBe('PendingMultiJackOrder');
  });

  it('assigns mirror to first jack in J+J+9 case', () => {
    const state = makeState({
      players: [
        makePlayer('bot1', {
          hand: [jDiamonds, jHearts, mirror9, card('5', 'hearts')],
          isBot: true,
        }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
      ],
    });

    let s = applyPlay(state, 'bot1', [jDiamonds.id, jHearts.id, mirror9.id]);
    expect(s.pendingAction?.type).toBe('PendingMultiJackOrder');

    s = tryResolveBotPendingAction(s, ['bot1']);
    // Mirror was assigned to first jack (J♦ = super revolution → PendingRevolutionConfirm)
    expect(s.pendingAction?.type).toBe('PendingRevolutionConfirm');
    s = applyRevolutionConfirm(s, 'bot1');
    expect(s.superRevolution).toBe(true);
  });

  it('no mirror assigned for J+J (no mirrors available)', () => {
    const state = makeState({
      players: [
        makePlayer('bot1', { hand: [jDiamonds, jDiamonds, card('5', 'hearts')], isBot: true }),
        makePlayer('p1'),
        makePlayer('p2'),
      ],
    });
    const jDiamonds2 = card('J', 'diamonds', 1);
    const stateWithCards = {
      ...state,
      players: [
        makePlayer('bot1', { hand: [jDiamonds, jDiamonds2, card('5', 'hearts')], isBot: true }),
        makePlayer('p1'),
        makePlayer('p2'),
      ],
    };

    let s = applyPlay(stateWithCards, 'bot1', [jDiamonds.id, jDiamonds2.id]);
    expect(s.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Bot resolves without mirror → PendingRevolutionConfirm for first revolution
    s = tryResolveBotPendingAction(s, ['bot1']);
    expect(s.pendingAction?.type).toBe('PendingRevolutionConfirm');
    s = applyRevolutionConfirm(s, 'bot1');
    expect(s.revolution).toBe(true);
  });

  it('returns same state when human is the launcher', () => {
    const pending: PendingMultiJackOrder = {
      type: 'PendingMultiJackOrder',
      playerId: 'human1',
      jacks: [jDiamonds, jHearts],
      mirrors: [],
    };
    const state = makeState({ pendingAction: pending });
    const result = tryResolveBotPendingAction(state, ['bot1']);
    expect(result).toBe(state); // Same reference, no change
  });
});

// ─── Invalid sequence validation ─────────────────────────────────────────────

describe('applyMultiJackOrder validation', () => {
  it('throws when sequence is missing a jack', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
      ],
    });

    const s = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id]);
    expect(s.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Only provide one jack
    const seq: MultiJackSequenceEntry[] = [{ jackCard: jDiamonds }];
    expect(() => applyMultiJackOrder(s, 'p0', seq)).toThrow(/exactly 2 jacks/);
  });
});

// ─── continueMultiJackSequence ──────────────────────────────────────────────

describe('continueMultiJackSequence', () => {
  it('moves revolution jack to graveyard and continues to next', () => {
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jHearts, card('5', 'hearts')] }),
        makePlayer('p1', { faceUp: [card('K', 'hearts')], faceDown: [card('3', 'clubs')] }),
        makePlayer('p2'),
      ],
    });

    // Play both jacks → PendingMultiJackOrder
    let s = applyPlay(state, 'p0', [jDiamonds.id, jHearts.id]);

    // Apply order: revolution first, then flop reverse
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jHearts },
    ];
    s = applyMultiJackOrder(s, 'p0', seq);

    // Revolution deferred — PendingRevolutionConfirm set
    expect(s.pendingAction?.type).toBe('PendingRevolutionConfirm');
    s = applyRevolutionConfirm(s, 'p0');
    expect(s.revolution).toBe(true);
    expect(s.lastPowerTriggered?.type).toBe('revolution');
    expect(s.graveyard.some((c) => c.id === jDiamonds.id)).toBe(false);

    // Continue: move jack to graveyard, flop reverse pending
    s = continueMultiJackSequence(s, Date.now());
    expect(s.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(s.pendingAction?.type).toBe('flopReverse');
  });

  it('two revolutions: continue twice to finalize', () => {
    const jDiamonds2 = card('J', 'diamonds', 1);
    const state = makeState({
      players: [
        makePlayer('p0', { hand: [jDiamonds, jDiamonds2, card('5', 'hearts')] }),
        makePlayer('p1'),
        makePlayer('p2'),
      ],
    });

    let s = applyPlay(state, 'p0', [jDiamonds.id, jDiamonds2.id]);
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jDiamonds },
      { jackCard: jDiamonds2 },
    ];
    s = applyMultiJackOrder(s, 'p0', seq);

    // First revolution: confirm + continue
    s = applyRevolutionConfirm(s, 'p0');
    s = continueMultiJackSequence(s, Date.now());
    // Second revolution: confirm + continue
    s = applyRevolutionConfirm(s, 'p0');
    s = continueMultiJackSequence(s, Date.now());

    expect(s.multiJackSequence).toBeUndefined();
    expect(s.graveyard.some((c) => c.id === jDiamonds.id)).toBe(true);
    expect(s.graveyard.some((c) => c.id === jDiamonds2.id)).toBe(true);
  });
});

// ─── botActOnce integration ──────────────────────────────────────────────────

describe('botActOnce integration with PendingMultiJackOrder', () => {
  it('bot resolves PendingMultiJackOrder via botActOnce', () => {
    const state = makeState({
      players: [
        makePlayer('bot1', { hand: [jDiamonds, jClubs, card('5', 'hearts')], isBot: true }),
        makePlayer('human1'),
        makePlayer('p2'),
      ],
    });

    // Play multi-jack to create pending
    let s = applyPlay(state, 'bot1', [jDiamonds.id, jClubs.id]);
    expect(s.pendingAction?.type).toBe('PendingMultiJackOrder');

    // botActOnce should resolve it
    s = botActOnce(s, ['bot1'], ['human1']);
    expect(s.pendingAction?.type).not.toBe('PendingMultiJackOrder');
  });
});
