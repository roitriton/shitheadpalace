import { describe, it, expect } from 'vitest';
import { isManoucheCard, isManoucheTriggered, isSuperManoucheTriggered } from './manouche';
import { applyPlay } from '../engine/actions/play';
import { applyManouchePick, applySuperManouchePick } from '../engine/actions/applyManoucheChoice';
import { filterGameStateForPlayer } from '../engine/filter';
import type { Card, GameState, GameVariant, Player } from '../types';

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

const manoucheVariant: GameVariant = {
  name: 'test',
  powerAssignments: { mirror: '9', burn: '10', skip: '7' },
  playerCount: 4,
  deckCount: 1,
};

const noMirrorVariant: GameVariant = {
  name: 'no-mirror',
  powerAssignments: {},
  playerCount: 4,
  deckCount: 1,
};

/** 4-player state: p0 current, turnOrder [1,2,3]. */
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
    pile: [],
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1, 2, 3],
    finishOrder: [],
    variant: manoucheVariant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

// Card fixtures
const jSpade  = card('J', 'spades');
const jSpadeB = card('J', 'spades', 1);
const jDiamond = card('J', 'diamonds');
const jHeart  = card('J', 'hearts');
const jClub   = card('J', 'clubs');
const c9      = card('9');          // Mirror card
const cK      = card('K');
const cKb     = card('K', 'hearts', 1);
const c5a     = card('5', 'hearts', 0);
const c5b     = card('5', 'spades', 1);
const c5c     = card('5', 'diamonds', 2);
const cQ      = card('Q');
const cQb     = card('Q', 'spades', 1);

// ─── isManoucheCard ────────────────────────────────────────────────────────────

describe('isManoucheCard', () => {
  it('returns true for J♠', () => {
    expect(isManoucheCard(jSpade)).toBe(true);
  });

  it('returns false for J♦', () => {
    expect(isManoucheCard(jDiamond)).toBe(false);
  });

  it('returns false for J♥', () => {
    expect(isManoucheCard(jHeart)).toBe(false);
  });

  it('returns false for J♣', () => {
    expect(isManoucheCard(jClub)).toBe(false);
  });

  it('returns false for a non-Jack spade', () => {
    expect(isManoucheCard(card('K', 'spades'))).toBe(false);
  });
});

// ─── isManoucheTriggered ──────────────────────────────────────────────────────

describe('isManoucheTriggered', () => {
  it('returns true for J♠ alone in playing phase', () => {
    expect(isManoucheTriggered([jSpade], manoucheVariant, 'playing')).toBe(true);
  });

  it('returns false when J♠ is accompanied by a Mirror card (Super Manouche instead)', () => {
    expect(isManoucheTriggered([jSpade, c9], manoucheVariant, 'playing')).toBe(false);
  });

  it('returns false for J♦ alone (not a Manouche card)', () => {
    expect(isManoucheTriggered([jDiamond], manoucheVariant, 'playing')).toBe(false);
  });

  it('returns false for non-Jack cards', () => {
    expect(isManoucheTriggered([cK], manoucheVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isManoucheTriggered([jSpade], manoucheVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isManoucheTriggered([jSpade], manoucheVariant, 'superRevolution')).toBe(false);
  });

  it('returns true for J♠ when no mirror is configured in variant', () => {
    // Mirror column empty → J♠ + "nothing mirror" → regular Manouche
    expect(isManoucheTriggered([jSpade], noMirrorVariant, 'playing')).toBe(true);
  });
});

// ─── isSuperManoucheTriggered ─────────────────────────────────────────────────

describe('isSuperManoucheTriggered', () => {
  it('returns true for J♠ + Mirror card', () => {
    expect(isSuperManoucheTriggered([jSpade, c9], manoucheVariant, 'playing')).toBe(true);
  });

  it('returns false for J♠ alone (regular Manouche, not Super)', () => {
    expect(isSuperManoucheTriggered([jSpade], manoucheVariant, 'playing')).toBe(false);
  });

  it('returns false for J♦ + Mirror (Super Revolution, not Super Manouche)', () => {
    expect(isSuperManoucheTriggered([jDiamond, c9], manoucheVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isSuperManoucheTriggered([jSpade, c9], manoucheVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isSuperManoucheTriggered([jSpade, c9], manoucheVariant, 'superRevolution')).toBe(false);
  });

  it('returns false when mirror is not configured in variant', () => {
    // 9 is not a mirror card in this variant → no super manouche
    expect(isSuperManoucheTriggered([jSpade, c9], noMirrorVariant, 'playing')).toBe(false);
  });
});

// ─── applyManouchePick — guards ───────────────────────────────────────────────

describe('applyManouchePick — guards', () => {
  it('throws when there is no pending manouche action', () => {
    const state = makeState();
    expect(() => applyManouchePick(state, 'p0', c5b.id, [c5a.id])).toThrow(/No pending manouche/);
  });

  it('throws when pendingAction type is wrong (target, not manouche)', () => {
    const state = makeState({ pendingAction: { type: 'target', launcherId: 'p0' } });
    expect(() => applyManouchePick(state, 'p0', c5b.id, [c5a.id])).toThrow(/No pending manouche/);
  });

  it('throws when caller is not the launcher', () => {
    const state = makeState({
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyManouchePick(state, 'p1', c5b.id, [c5a.id])).toThrow(/launcher/);
  });

  it('throws when giveCardIds is empty', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [c5a] };
      if (i === 1) return { ...p, hand: [c5b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyManouchePick(state, 'p0', c5b.id, [])).toThrow(/at least one card/);
  });

  it('throws when takeCardId is not in target hand', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [c5a] };
      if (i === 1) return { ...p, hand: [c5b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    // cK is not in p1's hand
    expect(() => applyManouchePick(state, 'p0', cK.id, [c5a.id])).toThrow(/not found in target/);
  });

  it('throws when a giveCardId is not in launcher hand', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [c5a] };
      if (i === 1) return { ...p, hand: [c5b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    // cK is not in p0's hand
    expect(() => applyManouchePick(state, 'p0', c5b.id, [cK.id])).toThrow(/not found in launcher/);
  });

  it('throws when given cards have different ranks between themselves', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK, c5a] };   // K + 5 = different ranks
      if (i === 1) return { ...p, hand: [cQ] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyManouchePick(state, 'p0', cQ.id, [cK.id, c5a.id])).toThrow(/same rank/);
  });
});

// ─── applyManouchePick — nominal ──────────────────────────────────────────────

describe('applyManouchePick — nominal', () => {
  function setupManouche() {
    // p0 (launcher): hand = [c5a, cK]  → gives c5a (rank 5), keeps cK, takes c5b
    // p1 (target):  hand = [c5b, cQ]  → gives c5b (taken), receives c5a
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [c5a, cK] };
      if (i === 1) return { ...p, hand: [c5b, cQ] };
      return { ...p, hand: [cK] };
    });
    return makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
  }

  it('launcher hand gains takeCard and loses giveCards', () => {
    const state = setupManouche();
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    const launcherHand = next.players[0]!.hand;
    // Should have cK and c5b
    expect(launcherHand.map((c) => c.id)).toContain(cK.id);
    expect(launcherHand.map((c) => c.id)).toContain(c5b.id);
    expect(launcherHand.map((c) => c.id)).not.toContain(c5a.id);
  });

  it('target hand loses takeCard and gains giveCards', () => {
    const state = setupManouche();
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    const targetHand = next.players[1]!.hand;
    // Should have cQ and c5a
    expect(targetHand.map((c) => c.id)).toContain(cQ.id);
    expect(targetHand.map((c) => c.id)).toContain(c5a.id);
    expect(targetHand.map((c) => c.id)).not.toContain(c5b.id);
  });

  it('pendingAction is cleared after the exchange', () => {
    const state = setupManouche();
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    expect(next.pendingAction).toBeNull();
  });

  it('turn advances to next player after the exchange', () => {
    const state = setupManouche();
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('appends a manouchePick log entry', () => {
    const state = setupManouche();
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    const entry = next.log.find((e) => e.type === 'manouchePick');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p0');
    expect(entry!.data.takeCardId).toBe(c5b.id);
    expect(entry!.data.targetId).toBe('p1');
  });

  it('does not mutate the input state', () => {
    const state = setupManouche();
    applyManouchePick(state, 'p0', c5b.id, [c5a.id]);
    expect(state.pendingAction).not.toBeNull();
    expect(state.players[0]!.hand.map((c) => c.id)).toContain(c5a.id);
    expect(state.players[1]!.hand.map((c) => c.id)).toContain(c5b.id);
  });

  it('launcher can give cards of a different rank than the taken card', () => {
    // p0 (launcher): hand = [cK, c5a] → gives cK (rank K), takes cQ (rank Q)
    // Different ranks between take and give — allowed since the new rule only
    // requires all given cards to share the same rank between themselves.
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK, c5a] };
      if (i === 1) return { ...p, hand: [cQ] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    const next = applyManouchePick(state, 'p0', cQ.id, [cK.id]);
    // p0 gave K, received Q → hand: [c5a, cQ]
    expect(next.players[0]!.hand.map((c) => c.id)).toContain(c5a.id);
    expect(next.players[0]!.hand.map((c) => c.id)).toContain(cQ.id);
    expect(next.players[0]!.hand.map((c) => c.id)).not.toContain(cK.id);
    // p1 gave Q, received K → hand: [cK]
    expect(next.players[1]!.hand.map((c) => c.id)).toContain(cK.id);
    expect(next.players[1]!.hand.map((c) => c.id)).not.toContain(cQ.id);
  });

  it('launcher can give multiple cards of the same rank', () => {
    // p0 hand: [c5a, c5c, cK] — gives both 5s, takes c5b
    const c5cLocal = card('5', 'clubs', 3);
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [c5a, c5cLocal, cK] };
      if (i === 1) return { ...p, hand: [c5b] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    const next = applyManouchePick(state, 'p0', c5b.id, [c5a.id, c5cLocal.id]);
    // p0 gave two 5s, received one 5 → net -1
    expect(next.players[0]!.hand).toHaveLength(2); // cK + c5b
    // p1 gave one 5 (c5b), received two 5s (c5a + c5cLocal) → net +1: 1 → 2
    expect(next.players[1]!.hand).toHaveLength(2); // c5b gone, c5a + c5cLocal added
  });
});

// ─── applySuperManouchePick — guards ──────────────────────────────────────────

describe('applySuperManouchePick — guards', () => {
  it('throws when there is no pending superManouche action', () => {
    const state = makeState();
    expect(() => applySuperManouchePick(state, 'p0', [cK.id], [cQ.id])).toThrow(/No pending superManouche/);
  });

  it('throws when pendingAction type is manouche (not superManouche)', () => {
    const state = makeState({
      pendingAction: { type: 'manouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applySuperManouchePick(state, 'p0', [cK.id], [cQ.id])).toThrow(/No pending superManouche/);
  });

  it('throws when caller is not the launcher', () => {
    const state = makeState({
      pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applySuperManouchePick(state, 'p1', [cK.id], [cQ.id])).toThrow(/launcher/);
  });

  it('throws when giveCardIds is empty', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK] };
      if (i === 1) return { ...p, hand: [cQ] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applySuperManouchePick(state, 'p0', [], [])).toThrow(/at least one card/);
  });

  it('throws when give and take counts differ', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK, cKb] };
      if (i === 1) return { ...p, hand: [cQ] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
    });
    // giving 2, taking 1 → invalid
    expect(() => applySuperManouchePick(state, 'p0', [cK.id, cKb.id], [cQ.id])).toThrow(/equal card counts/);
  });

  it('throws when a takeCardId is not in target hand', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK] };
      if (i === 1) return { ...p, hand: [cQ] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
    });
    // c5a is not in p1's hand
    expect(() => applySuperManouchePick(state, 'p0', [cK.id], [c5a.id])).toThrow(/not found in target/);
  });

  it('throws when a giveCardId is not in launcher hand', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK] };
      if (i === 1) return { ...p, hand: [cQ] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
    });
    // c5a is not in p0's hand
    expect(() => applySuperManouchePick(state, 'p0', [c5a.id], [cQ.id])).toThrow(/not found in launcher/);
  });
});

// ─── applySuperManouchePick — nominal ─────────────────────────────────────────

describe('applySuperManouchePick — nominal', () => {
  function setupSuperManouche() {
    // p0 (launcher): hand = [cK, cQ]  → gives cK, takes cQb
    // p1 (target):   hand = [cQb, c5a] → gives cQb, receives cK
    const cQbLocal = card('Q', 'spades', 10);
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [cK, cQ] };
      if (i === 1) return { ...p, hand: [cQbLocal, c5a] };
      return { ...p, hand: [cK] };
    });
    return {
      state: makeState({
        players,
        pendingAction: { type: 'superManouche', launcherId: 'p0', targetId: 'p1' },
      }),
      cQbLocal,
    };
  }

  it('launcher gains takeCards and loses giveCards', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    const launcherHand = next.players[0]!.hand.map((c) => c.id);
    expect(launcherHand).toContain(cQ.id);
    expect(launcherHand).toContain(cQbLocal.id);
    expect(launcherHand).not.toContain(cK.id);
  });

  it('target gains giveCards and loses takeCards', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    const targetHand = next.players[1]!.hand.map((c) => c.id);
    expect(targetHand).toContain(c5a.id);
    expect(targetHand).toContain(cK.id);
    expect(targetHand).not.toContain(cQbLocal.id);
  });

  it('total hand size is preserved for both players', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    // p0: 2 → 2 (gave 1, took 1)
    expect(next.players[0]!.hand).toHaveLength(state.players[0]!.hand.length);
    // p1: 2 → 2
    expect(next.players[1]!.hand).toHaveLength(state.players[1]!.hand.length);
  });

  it('pendingAction is cleared after the exchange', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    expect(next.pendingAction).toBeNull();
  });

  it('turn advances to next player after the exchange', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('appends a superManouchePick log entry', () => {
    const { state, cQbLocal } = setupSuperManouche();
    const next = applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    const entry = next.log.find((e) => e.type === 'superManouchePick');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p0');
    expect(entry!.data.targetId).toBe('p1');
  });

  it('does not mutate the input state', () => {
    const { state, cQbLocal } = setupSuperManouche();
    applySuperManouchePick(state, 'p0', [cK.id], [cQbLocal.id]);
    expect(state.pendingAction).not.toBeNull();
    expect(state.players[0]!.hand.map((c) => c.id)).toContain(cK.id);
  });
});

// ─── Full flow: applyPlay → pendingAction ─────────────────────────────────────

describe('Manouche — full flow via applyPlay', () => {
  it('playing J♠ with targetPlayerId sets pendingAction manouche and does not advance turn', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jSpade.id], 0, 'p1');

    expect(next.pendingAction).toEqual({ type: 'manouche', launcherId: 'p0', targetId: 'p1' });
    // Turn must NOT have advanced yet
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('playing J♠ + Mirror with targetPlayerId sets pendingAction superManouche', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, c9, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jSpade.id, c9.id], 0, 'p1');

    expect(next.pendingAction).toEqual({ type: 'superManouche', launcherId: 'p0', targetId: 'p1' });
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('playing J♠ without targetPlayerId creates 2-step pending action', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jSpade.id]);
    // Without targetPlayerId, sets a 2-step pending action (target chosen later via manoucheTarget)
    expect(next.pendingAction).toMatchObject({ type: 'manouche', launcherId: 'p0' });
    expect((next.pendingAction as { targetId?: string }).targetId).toBeUndefined();
    expect(next.pendingActionDelayed).toBe(true);
  });

  it('playing J♠ targeting a finished player throws', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      if (i === 1) return { ...p, isFinished: true };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    expect(() => applyPlay(state, 'p0', [jSpade.id], 0, 'p1')).toThrow(/already finished/);
  });

  it('playing J♠ targeting self throws', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    expect(() => applyPlay(state, 'p0', [jSpade.id], 0, 'p0')).toThrow(/yourself/);
  });

  it('playing J♠ targeting non-existent player throws', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    expect(() => applyPlay(state, 'p0', [jSpade.id], 0, 'ghost')).toThrow(/not found/);
  });

  it('after manouchePick turn advances to correct player', () => {
    // p0 plays J♠, targets p1, then does manouche exchange
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, c5a] };
      if (i === 1) return { ...p, hand: [c5b, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });

    const afterPlay = applyPlay(state, 'p0', [jSpade.id], 0, 'p1');
    expect(afterPlay.pendingAction?.type).toBe('manouche');

    const afterPick = applyManouchePick(afterPlay, 'p0', c5b.id, [c5a.id]);
    // Turn advances: p0 was current, next in turnOrder is p1
    expect(afterPick.currentPlayerIndex).toBe(1);
    expect(afterPick.pendingAction).toBeNull();
  });

  it('J♠ does not trigger Manouche when player finishes by playing it', () => {
    // p0 has only J♠ — plays it and has no cards left → finishes → Manouche NOT triggered
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    // When player finishes, game may end or turn advances without pendingAction
    const next = applyPlay(state, 'p0', [jSpade.id], 0, 'p1');
    expect(next.pendingAction).toBeNull();
    // Player p0 finished
    expect(next.players[0]!.isFinished).toBe(true);
  });
});

// ─── Manouche disabled during revolution ──────────────────────────────────────

describe('Manouche — disabled during revolution', () => {
  it('playing J♠ during revolution phase does not set manouche pendingAction', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, cK] };
      return { ...p, hand: [cK] };
    });
    // In revolution, ≤ ordering: J (11) must play on pile with value ≥ 11
    const state = makeState({
      players,
      phase: 'revolution',
      revolution: true,
      pile: [{ cards: [{ id: 'pile-A-0', suit: 'hearts', rank: 'A' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jSpade.id], 0, 'p1');
    // No manouche triggered
    expect(next.pendingAction).toBeNull();
    // Turn advanced normally
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('playing J♠ + Mirror during superRevolution does not trigger super manouche', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jSpade, c9, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: [{ cards: [{ id: 'pile-A-0', suit: 'hearts', rank: 'A' }], playerId: 'p1', playerName: 'p1', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jSpade.id, c9.id], 0, 'p1');
    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerIndex).toBe(1);
  });
});

// ─── filterGameStateForPlayer with Manouche pending ───────────────────────────

describe('filterGameStateForPlayer — Manouche pending', () => {
  function setupManoucheFilter() {
    const players = [
      makePlayer('p0', { hand: [jSpade, cK] }),
      makePlayer('p1', { hand: [c5a, c5b] }),
      makePlayer('p2', { hand: [cQ] }),
    ];
    return {
      id: 'g1',
      phase: 'playing' as const,
      players,
      deck: [],
      pile: [],
      graveyard: [],
      currentPlayerIndex: 0,
      direction: 1 as const,
      turnOrder: [1, 2],
      finishOrder: [],
      variant: manoucheVariant,
      pendingAction: { type: 'manouche' as const, launcherId: 'p0', targetId: 'p1' },
      log: [],
    lastPowerTriggered: null,
    };
  }

  it("launcher (p0) sees target (p1) hand unmasked", () => {
    const state = setupManoucheFilter();
    const filtered = filterGameStateForPlayer(state, 'p0');
    const targetHand = filtered.players[1]!.hand;
    // Cards should NOT be hidden
    expect(targetHand.some((c) => c.hidden)).toBe(false);
    expect(targetHand).toHaveLength(2);
  });

  it("third player (p2) still sees target hand as hidden", () => {
    const state = setupManoucheFilter();
    const filtered = filterGameStateForPlayer(state, 'p2');
    const targetHand = filtered.players[1]!.hand;
    expect(targetHand.every((c) => c.hidden === true)).toBe(true);
  });

  it("target (p1) sees their own hand unmasked", () => {
    const state = setupManoucheFilter();
    const filtered = filterGameStateForPlayer(state, 'p1');
    expect(filtered.players[1]!.hand).toEqual(state.players[1]!.hand);
  });

  it("launcher's own hand is unmasked", () => {
    const state = setupManoucheFilter();
    const filtered = filterGameStateForPlayer(state, 'p0');
    expect(filtered.players[0]!.hand).toEqual(state.players[0]!.hand);
  });

  it("target faceDown remains hidden even to launcher", () => {
    const state = setupManoucheFilter();
    // Give p1 a faceDown card
    const stateWithFaceDown = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, faceDown: [cQ] } : p,
      ),
    };
    const filtered = filterGameStateForPlayer(stateWithFaceDown, 'p0');
    expect(filtered.players[1]!.faceDown.every((c) => c.hidden === true)).toBe(true);
  });

  it("superManouche pending: launcher also sees target hand", () => {
    const state = {
      ...setupManoucheFilter(),
      pendingAction: { type: 'superManouche' as const, launcherId: 'p0', targetId: 'p1' },
    };
    const filtered = filterGameStateForPlayer(state, 'p0');
    const targetHand = filtered.players[1]!.hand;
    expect(targetHand.some((c) => c.hidden)).toBe(false);
  });

  it("without pending manouche, target hand is hidden from all opponents", () => {
    const state = {
      ...setupManoucheFilter(),
      pendingAction: null,
    };
    const filtered = filterGameStateForPlayer(state, 'p0');
    const targetHand = filtered.players[1]!.hand;
    expect(targetHand.every((c) => c.hidden === true)).toBe(true);
  });
});
