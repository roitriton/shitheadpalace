import { describe, it, expect } from 'vitest';
import { isFlopReverseCard, isFlopReverseTriggered, isFlopRemakeTriggered } from './flopReverse';
import { applyFlopReverseTarget, applyFlopRemakeTarget, applyFlopRemake } from '../engine/actions/applyFlopReverseChoice';
import { applyPlay } from '../engine/actions/play';
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

const mirrorVariant: GameVariant = {
  name: 'test',
  powerAssignments: { mirror: '9' },
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
    variant: mirrorVariant,
    pendingAction: null,
    log: [],
    ...overrides,
  };
}

// Card fixtures
const jHeart  = card('J', 'hearts');
const jSpade  = card('J', 'spades');
const jDiamond = card('J', 'diamonds');
const jClub   = card('J', 'clubs');
const c9      = card('9');           // Mirror card (in mirrorVariant)
const cK      = card('K');
const cQ      = card('Q');
const c5a     = card('5', 'hearts', 0);
const c5b     = card('5', 'spades', 1);
const c5c     = card('5', 'diamonds', 2);
const c6a     = card('6', 'hearts', 0);
const c6b     = card('6', 'spades', 1);
const c6c     = card('6', 'diamonds', 2);
const c7a     = card('7', 'hearts', 0);

// ─── isFlopReverseCard ────────────────────────────────────────────────────────

describe('isFlopReverseCard', () => {
  it('returns true for J♥', () => {
    expect(isFlopReverseCard(jHeart)).toBe(true);
  });

  it('returns false for J♠', () => {
    expect(isFlopReverseCard(jSpade)).toBe(false);
  });

  it('returns false for J♦', () => {
    expect(isFlopReverseCard(jDiamond)).toBe(false);
  });

  it('returns false for J♣', () => {
    expect(isFlopReverseCard(jClub)).toBe(false);
  });

  it('returns false for a non-Jack heart', () => {
    expect(isFlopReverseCard(card('K', 'hearts'))).toBe(false);
  });
});

// ─── isFlopReverseTriggered ────────────────────────────────────────────────────

describe('isFlopReverseTriggered', () => {
  it('returns true for J♥ alone in playing phase', () => {
    expect(isFlopReverseTriggered([jHeart], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false when J♥ is accompanied by a Mirror card (Flop Remake instead)', () => {
    expect(isFlopReverseTriggered([jHeart, c9], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false for J♠ alone (not a Flop Reverse card)', () => {
    expect(isFlopReverseTriggered([jSpade], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false for non-Jack cards', () => {
    expect(isFlopReverseTriggered([cK], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isFlopReverseTriggered([jHeart], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isFlopReverseTriggered([jHeart], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns true for J♥ when no mirror is configured in variant', () => {
    expect(isFlopReverseTriggered([jHeart], noMirrorVariant, 'playing')).toBe(true);
  });
});

// ─── isFlopRemakeTriggered ────────────────────────────────────────────────────

describe('isFlopRemakeTriggered', () => {
  it('returns true for J♥ + Mirror card', () => {
    expect(isFlopRemakeTriggered([jHeart, c9], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false for J♥ alone (regular Flop Reverse, not Remake)', () => {
    expect(isFlopRemakeTriggered([jHeart], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false for J♠ + Mirror (Super Manouche, not Flop Remake)', () => {
    expect(isFlopRemakeTriggered([jSpade, c9], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isFlopRemakeTriggered([jHeart, c9], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isFlopRemakeTriggered([jHeart, c9], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns false when mirror is not configured in variant', () => {
    expect(isFlopRemakeTriggered([jHeart, c9], noMirrorVariant, 'playing')).toBe(false);
  });
});

// ─── applyFlopReverseTarget — guards ─────────────────────────────────────────

describe('applyFlopReverseTarget — guards', () => {
  it('throws when there is no pending flopReverse action', () => {
    const state = makeState();
    expect(() => applyFlopReverseTarget(state, 'p0', 'p1')).toThrow(/No pending flopReverse/);
  });

  it('throws when pendingAction type is flopRemake (not flopReverse)', () => {
    const state = makeState({
      pendingAction: { type: 'flopRemake', launcherId: 'p0' },
    });
    expect(() => applyFlopReverseTarget(state, 'p0', 'p1')).toThrow(/No pending flopReverse/);
  });

  it('throws when caller is not the launcher', () => {
    const state = makeState({
      pendingAction: { type: 'flopReverse', launcherId: 'p0' },
    });
    expect(() => applyFlopReverseTarget(state, 'p1', 'p2')).toThrow(/launcher/);
  });

  it('throws when targetPlayerId is not found', () => {
    const state = makeState({
      pendingAction: { type: 'flopReverse', launcherId: 'p0' },
    });
    expect(() => applyFlopReverseTarget(state, 'p0', 'ghost')).toThrow(/not found/);
  });

  it('throws when targetPlayerId is already finished', () => {
    const players = makeState().players.map((p, i) =>
      i === 1 ? { ...p, isFinished: true } : p,
    );
    const state = makeState({
      players,
      pendingAction: { type: 'flopReverse', launcherId: 'p0' },
    });
    expect(() => applyFlopReverseTarget(state, 'p0', 'p1')).toThrow(/finished/);
  });
});

// ─── applyFlopReverseTarget — nominal ────────────────────────────────────────

describe('applyFlopReverseTarget — nominal', () => {
  function setupFlopReverse() {
    // p1 has faceUp = [c5a, c6a] and faceDown = [c5b, c6b]
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [c5a, c6a], faceDown: [c5b, c6b] };
      return p;
    });
    return makeState({
      players,
      pendingAction: { type: 'flopReverse' as const, launcherId: 'p0' },
    });
  }

  it("target's faceUp becomes the old faceDown", () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.players[1]!.faceUp.map((c) => c.id)).toEqual([c5b.id, c6b.id]);
  });

  it("target's faceDown becomes the old faceUp", () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.players[1]!.faceDown.map((c) => c.id)).toEqual([c5a.id, c6a.id]);
  });

  it("target's faceDownRevealed is set to true", () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.players[1]!.faceDownRevealed).toBe(true);
  });

  it('pendingAction is cleared after the choice', () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.pendingAction).toBeNull();
  });

  it('turn advances to next player after the choice', () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('appends a flopReverseTarget log entry', () => {
    const state = setupFlopReverse();
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    const entry = next.log.find((e) => e.type === 'flopReverseTarget');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p0');
    expect(entry!.data.targetPlayerId).toBe('p1');
  });

  it('does not mutate the input state', () => {
    const state = setupFlopReverse();
    applyFlopReverseTarget(state, 'p0', 'p1');
    expect(state.pendingAction).not.toBeNull();
    expect(state.players[1]!.faceUp.map((c) => c.id)).toEqual([c5a.id, c6a.id]);
    expect(state.players[1]!.faceDownRevealed).toBeUndefined();
  });
});

// ─── applyFlopReverseTarget — self-target ─────────────────────────────────────

describe('applyFlopReverseTarget — self-target', () => {
  it('self-targeting is allowed', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, faceUp: [c5a], faceDown: [c5b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'flopReverse' as const, launcherId: 'p0' },
    });
    const next = applyFlopReverseTarget(state, 'p0', 'p0');
    expect(next.players[0]!.faceUp.map((c) => c.id)).toEqual([c5b.id]);
    expect(next.players[0]!.faceDown.map((c) => c.id)).toEqual([c5a.id]);
    expect(next.players[0]!.faceDownRevealed).toBe(true);
  });
});

// ─── applyFlopReverseTarget — edge cases ──────────────────────────────────────

describe('applyFlopReverseTarget — edge cases', () => {
  it('works when target has no faceDown cards (empty → empty swap)', () => {
    // p1 has faceUp but no faceDown
    const players = makeState().players.map((p, i) =>
      i === 1 ? { ...p, faceUp: [c5a], faceDown: [] } : p,
    );
    const state = makeState({
      players,
      pendingAction: { type: 'flopReverse' as const, launcherId: 'p0' },
    });
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.players[1]!.faceUp).toHaveLength(0);
    expect(next.players[1]!.faceDown.map((c) => c.id)).toEqual([c5a.id]);
    expect(next.players[1]!.faceDownRevealed).toBe(true);
  });

  it('works when target has no flop cards at all (both empty)', () => {
    // p1 has neither faceUp nor faceDown
    const state = makeState({
      pendingAction: { type: 'flopReverse' as const, launcherId: 'p0' },
    });
    const next = applyFlopReverseTarget(state, 'p0', 'p1');
    expect(next.players[1]!.faceUp).toHaveLength(0);
    expect(next.players[1]!.faceDown).toHaveLength(0);
    expect(next.players[1]!.faceDownRevealed).toBe(true);
  });
});

// ─── applyFlopRemakeTarget — guards ───────────────────────────────────────────

describe('applyFlopRemakeTarget — guards', () => {
  it('throws when there is no pending flopRemake action', () => {
    const state = makeState();
    expect(() => applyFlopRemakeTarget(state, 'p0', 'p1')).toThrow(/No pending flopRemake/);
  });

  it('throws when pendingAction type is flopReverse (not flopRemake)', () => {
    const state = makeState({
      pendingAction: { type: 'flopReverse', launcherId: 'p0' },
    });
    expect(() => applyFlopRemakeTarget(state, 'p0', 'p1')).toThrow(/No pending flopRemake/);
  });

  it('throws when targetId is already set (target already chosen)', () => {
    const state = makeState({
      pendingAction: { type: 'flopRemake', launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyFlopRemakeTarget(state, 'p0', 'p2')).toThrow(/already been selected/);
  });

  it('throws when caller is not the launcher', () => {
    const state = makeState({
      pendingAction: { type: 'flopRemake', launcherId: 'p0' },
    });
    expect(() => applyFlopRemakeTarget(state, 'p1', 'p2')).toThrow(/launcher/);
  });

  it('throws when targetPlayerId is not found', () => {
    const state = makeState({
      pendingAction: { type: 'flopRemake', launcherId: 'p0' },
    });
    expect(() => applyFlopRemakeTarget(state, 'p0', 'ghost')).toThrow(/not found/);
  });

  it('throws when targetPlayerId is already finished', () => {
    const players = makeState().players.map((p, i) =>
      i === 1 ? { ...p, isFinished: true } : p,
    );
    const state = makeState({
      players,
      pendingAction: { type: 'flopRemake', launcherId: 'p0' },
    });
    expect(() => applyFlopRemakeTarget(state, 'p0', 'p1')).toThrow(/finished/);
  });
});

// ─── applyFlopRemakeTarget — nominal ──────────────────────────────────────────

describe('applyFlopRemakeTarget — nominal', () => {
  function setupFlopRemakeTarget() {
    return makeState({
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0' },
    });
  }

  it('sets targetId on pendingAction', () => {
    const state = setupFlopRemakeTarget();
    const next = applyFlopRemakeTarget(state, 'p0', 'p1');
    expect(next.pendingAction).toEqual({ type: 'flopRemake', launcherId: 'p0', targetId: 'p1' });
  });

  it('does NOT advance the turn', () => {
    const state = setupFlopRemakeTarget();
    const next = applyFlopRemakeTarget(state, 'p0', 'p1');
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.turnOrder).toEqual([1, 2, 3]);
  });

  it('appends a flopRemakeTarget log entry', () => {
    const state = setupFlopRemakeTarget();
    const next = applyFlopRemakeTarget(state, 'p0', 'p1');
    const entry = next.log.find((e) => e.type === 'flopRemakeTarget');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p0');
    expect(entry!.data.targetPlayerId).toBe('p1');
  });

  it('does not mutate the input state', () => {
    const state = setupFlopRemakeTarget();
    applyFlopRemakeTarget(state, 'p0', 'p1');
    expect(state.pendingAction).toEqual({ type: 'flopRemake', launcherId: 'p0' });
  });
});

// ─── applyFlopRemake — guards ─────────────────────────────────────────────────

describe('applyFlopRemake — guards', () => {
  function setupFlopRemake() {
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [c5a, c6a], faceDown: [c5b, c6b] };
      return p;
    });
    return makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p1' },
    });
  }

  it('throws when there is no pending flopRemake action', () => {
    const state = makeState();
    expect(() => applyFlopRemake(state, 'p1', [c5a.id], [c5b.id])).toThrow(/No pending flopRemake/);
  });

  it('throws when targetId has not been selected yet', () => {
    const state = makeState({
      pendingAction: { type: 'flopRemake', launcherId: 'p0' },
    });
    expect(() => applyFlopRemake(state, 'p0', [], [])).toThrow(/not been selected/);
  });

  it('throws when caller is not the target', () => {
    const state = setupFlopRemake();
    expect(() => applyFlopRemake(state, 'p2', [c5a.id, c6a.id], [c5b.id, c6b.id])).toThrow(/target/);
  });

  it('throws when faceUpIds has more than 3 cards', () => {
    const fa = card('5', 'clubs', 10);
    const fb = card('6', 'clubs', 11);
    const fc = card('7', 'clubs', 12);
    const fd = card('8', 'clubs', 13);
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [fa, fb, fc, fd], faceDown: [] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyFlopRemake(state, 'p1', [fa.id, fb.id, fc.id, fd.id], [])).toThrow(/at most 3/);
  });

  it('throws when faceDownIds has more than 3 cards', () => {
    const fa = card('5', 'clubs', 10);
    const fb = card('6', 'clubs', 11);
    const fc = card('7', 'clubs', 12);
    const fd = card('8', 'clubs', 13);
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [], faceDown: [fa, fb, fc, fd] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p1' },
    });
    expect(() => applyFlopRemake(state, 'p1', [], [fa.id, fb.id, fc.id, fd.id])).toThrow(/at most 3/);
  });

  it('throws when a card ID is not in the target flop/dark flop', () => {
    const state = setupFlopRemake();
    // cK is not in p1's faceUp or faceDown
    expect(() =>
      applyFlopRemake(state, 'p1', [c5a.id, c6a.id, cK.id], [c5b.id, c6b.id]),
    ).toThrow(/not in the target/);
  });

  it('throws when a card from target flop is not redistributed', () => {
    const state = setupFlopRemake();
    // Omit c6b — must include all 4 original cards
    expect(() =>
      applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5b.id]),
    ).toThrow(/not redistributed/);
  });

  it('throws when a card ID appears in both faceUp and faceDown (duplicate)', () => {
    const state = setupFlopRemake();
    expect(() =>
      applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5a.id, c6b.id]),
    ).toThrow(/duplicate/);
  });
});

// ─── applyFlopRemake — nominal ────────────────────────────────────────────────

describe('applyFlopRemake — nominal', () => {
  function setupFlopRemake() {
    // p1 has faceUp = [c5a, c6a] and faceDown = [c5b, c6b]
    // After remake: they can redistribute freely
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [c5a, c6a], faceDown: [c5b, c6b] };
      return p;
    });
    return makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p1' },
    });
  }

  it('faceUp cards match the submitted faceUpIds', () => {
    const state = setupFlopRemake();
    // Redistribute: put c5b and c6b face-up, c5a and c6a face-down
    const next = applyFlopRemake(state, 'p1', [c5b.id, c6b.id], [c5a.id, c6a.id]);
    expect(next.players[1]!.faceUp.map((c) => c.id)).toEqual([c5b.id, c6b.id]);
  });

  it('faceDown cards match the submitted faceDownIds', () => {
    const state = setupFlopRemake();
    const next = applyFlopRemake(state, 'p1', [c5b.id, c6b.id], [c5a.id, c6a.id]);
    expect(next.players[1]!.faceDown.map((c) => c.id)).toEqual([c5a.id, c6a.id]);
  });

  it('pendingAction is cleared after the distribution', () => {
    const state = setupFlopRemake();
    const next = applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5b.id, c6b.id]);
    expect(next.pendingAction).toBeNull();
  });

  it('turn advances after the distribution', () => {
    const state = setupFlopRemake();
    const next = applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5b.id, c6b.id]);
    // currentPlayerIndex was 0 (launcher p0), should advance to 1 (p1)
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('appends a flopRemakeDone log entry', () => {
    const state = setupFlopRemake();
    const next = applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5b.id, c6b.id]);
    const entry = next.log.find((e) => e.type === 'flopRemakeDone');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p1');
    expect(entry!.data.faceUpIds).toEqual([c5a.id, c6a.id]);
  });

  it('does not mutate the input state', () => {
    const state = setupFlopRemake();
    applyFlopRemake(state, 'p1', [c5a.id, c6a.id], [c5b.id, c6b.id]);
    expect(state.pendingAction).not.toBeNull();
    expect(state.players[1]!.faceUp.map((c) => c.id)).toEqual([c5a.id, c6a.id]);
  });

  it('throws when trying to put all 4 cards into faceDown (exceeds limit of 3)', () => {
    const state = setupFlopRemake();
    // 4 cards in faceDown → exceeds the max of 3
    expect(() =>
      applyFlopRemake(state, 'p1', [], [c5a.id, c6a.id, c5b.id, c6b.id]),
    ).toThrow(/at most 3/);
  });

  it('allows redistribution with fewer cards in faceDown (partial use)', () => {
    // p1 has faceUp = [c5a] and faceDown = [c5b]
    const players = makeState().players.map((p, i) => {
      if (i === 1) return { ...p, faceUp: [c5a], faceDown: [c5b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p1' },
    });
    const next = applyFlopRemake(state, 'p1', [c5b.id], [c5a.id]);
    expect(next.players[1]!.faceUp).toHaveLength(1);
    expect(next.players[1]!.faceDown).toHaveLength(1);
    expect(next.players[1]!.faceUp[0]!.id).toBe(c5b.id);
    expect(next.players[1]!.faceDown[0]!.id).toBe(c5a.id);
  });
});

// ─── applyFlopRemake — self-target ────────────────────────────────────────────

describe('applyFlopRemake — self-target', () => {
  it('launcher can target themselves and redistribute', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, faceUp: [c5a, c6a], faceDown: [c5b, c6b] };
      return p;
    });
    const state = makeState({
      players,
      pendingAction: { type: 'flopRemake' as const, launcherId: 'p0', targetId: 'p0' },
    });
    const next = applyFlopRemake(state, 'p0', [c5a.id, c5b.id], [c6a.id, c6b.id]);
    expect(next.players[0]!.faceUp.map((c) => c.id)).toEqual([c5a.id, c5b.id]);
    expect(next.players[0]!.faceDown.map((c) => c.id)).toEqual([c6a.id, c6b.id]);
    expect(next.pendingAction).toBeNull();
  });
});

// ─── Full flow: applyPlay → pendingAction ─────────────────────────────────────

describe('Flop Reverse — full flow via applyPlay', () => {
  it('playing J♥ alone sets pendingAction flopReverse and does not advance turn', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jHeart.id]);

    expect(next.pendingAction?.type).toBe('flopReverse');
    expect((next.pendingAction as { launcherId: string }).launcherId).toBe('p0');
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('playing J♥ + Mirror sets pendingAction flopRemake and does not advance turn', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, c9, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jHeart.id, c9.id]);

    expect(next.pendingAction?.type).toBe('flopRemake');
    expect((next.pendingAction as { launcherId: string }).launcherId).toBe('p0');
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('playing J♥ during revolution phase does NOT set flopReverse pending', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      phase: 'revolution',
      revolution: true,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: 'A' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jHeart.id]);

    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('playing J♥ + Mirror during superRevolution does NOT set flopRemake pending', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, c9, cK] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      phase: 'superRevolution',
      revolution: true,
      superRevolution: true,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: 'A' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jHeart.id, c9.id]);

    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('J♥ does not trigger Flop Reverse when player finishes by playing it', () => {
    // p0 has only J♥ — plays it and has no cards left → finishes → power NOT triggered
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });
    const next = applyPlay(state, 'p0', [jHeart.id]);
    expect(next.pendingAction).toBeNull();
    expect(next.players[0]!.isFinished).toBe(true);
  });

  it('full flow: J♥ → flopReverseTarget → turn advances', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, cK] };
      if (i === 1) return { ...p, faceUp: [c5a], faceDown: [c5b] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });

    const afterPlay = applyPlay(state, 'p0', [jHeart.id]);
    expect(afterPlay.pendingAction?.type).toBe('flopReverse');

    const afterTarget = applyFlopReverseTarget(afterPlay, 'p0', 'p1');
    expect(afterTarget.pendingAction).toBeNull();
    expect(afterTarget.players[1]!.faceUp[0]!.id).toBe(c5b.id);
    expect(afterTarget.players[1]!.faceDown[0]!.id).toBe(c5a.id);
    expect(afterTarget.players[1]!.faceDownRevealed).toBe(true);
    expect(afterTarget.currentPlayerIndex).toBe(1);
  });

  it('full flow: J♥ + Mirror → flopRemakeTarget → flopRemake → turn advances', () => {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, hand: [jHeart, c9, cK] };
      if (i === 1) return { ...p, faceUp: [c5a, c6a], faceDown: [c5b, c6b] };
      return { ...p, hand: [cK] };
    });
    const state = makeState({
      players,
      pile: [{ cards: [{ id: 'x-x-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
    });

    const afterPlay = applyPlay(state, 'p0', [jHeart.id, c9.id]);
    expect(afterPlay.pendingAction?.type).toBe('flopRemake');

    const afterTarget = applyFlopRemakeTarget(afterPlay, 'p0', 'p1');
    expect(afterTarget.pendingAction).toEqual({
      type: 'flopRemake',
      launcherId: 'p0',
      targetId: 'p1',
    });

    const afterRemake = applyFlopRemake(afterTarget, 'p1', [c5b.id, c6b.id], [c5a.id, c6a.id]);
    expect(afterRemake.pendingAction).toBeNull();
    expect(afterRemake.players[1]!.faceUp.map((c) => c.id)).toEqual([c5b.id, c6b.id]);
    expect(afterRemake.players[1]!.faceDown.map((c) => c.id)).toEqual([c5a.id, c6a.id]);
    expect(afterRemake.currentPlayerIndex).toBe(1);
  });
});

// ─── After Flop Reverse: revealed dark flop play ──────────────────────────────

describe('After Flop Reverse: revealed dark flop', () => {
  /** State where p0 has faceDownRevealed = true with two 5s in dark flop */
  function makeRevealedState(faceDownCards: Card[] = [c5a, c5b]): GameState {
    const players = makeState().players.map((p, i) => {
      if (i === 0) return { ...p, faceDown: faceDownCards, faceDownRevealed: true };
      return { ...p, hand: [cK] };
    });
    return makeState({ players });
  }

  it('allows playing a single known dark-flop card', () => {
    const state = makeRevealedState();
    const next = applyPlay(state, 'p0', [c5a.id]);
    expect(next.players[0]!.faceDown.map((c) => c.id)).not.toContain(c5a.id);
    expect(next.pendingAction).toBeNull();
  });

  it('allows playing multiple dark-flop cards of the same rank', () => {
    const state = makeRevealedState([c5a, c5b]);
    const next = applyPlay(state, 'p0', [c5a.id, c5b.id]);
    expect(next.players[0]!.faceDown).toHaveLength(0);
  });

  it('throws when playing cards of different ranks from revealed dark flop', () => {
    const state = makeRevealedState([c5a, c6a]);
    expect(() => applyPlay(state, 'p0', [c5a.id, c6a.id])).toThrow(/same rank/);
  });

  it('throws when played cards cannot beat the pile from revealed dark flop', () => {
    // Pile top = K; playing 5 (value < K) → invalid
    const pile = [{ cards: [cK], playerId: 'p1', playerName: 'p1', timestamp: 0 }];
    const state = makeRevealedState([c5a, c5b]);
    const withPile = { ...state, pile };
    expect(() => applyPlay(withPile, 'p0', [c5a.id])).toThrow(/value too low/);
  });

  it('advances turn normally after a revealed dark-flop play', () => {
    const state = makeRevealedState();
    const next = applyPlay(state, 'p0', [c5a.id]);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('player finishing on last revealed dark-flop card marks them finished', () => {
    // p0 has only one dark-flop card; after playing it they have no cards left
    const state = makeRevealedState([c5a]);
    const next = applyPlay(state, 'p0', [c5a.id]);
    expect(next.players[0]!.isFinished).toBe(true);
  });
});
