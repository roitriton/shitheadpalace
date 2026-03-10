import { describe, it, expect } from 'vitest';
import { isTargetTriggered, applyTarget } from './target';
import { applyPlay } from '../engine/actions/play';
import { applyTargetChoice } from '../engine/actions/applyTargetChoice';
import { applyPickUpPile } from '../engine/actions/pickUp';
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

const targetVariant: GameVariant = {
  name: 'test',
  powerAssignments: { target: 'A', burn: '10', skip: '7' },
  playerCount: 4,
  deckCount: 1,
};

const noTargetVariant: GameVariant = {
  name: 'no-target',
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
    variant: targetVariant,
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
    ...overrides,
  };
}

const cA = card('A');
const c7 = card('7');
const c10 = card('10');
const cK = card('K');
const c5 = card('5');

// ─── isTargetTriggered ────────────────────────────────────────────────────────

describe('isTargetTriggered', () => {
  it('returns true for an Ace when target is assigned', () => {
    expect(isTargetTriggered([cA], targetVariant, 'playing')).toBe(true);
  });

  it('returns false when target power is not assigned', () => {
    expect(isTargetTriggered([cA], noTargetVariant, 'playing')).toBe(false);
  });

  it('returns false for a non-target card', () => {
    expect(isTargetTriggered([cK], targetVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution', () => {
    expect(isTargetTriggered([cA], targetVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution', () => {
    expect(isTargetTriggered([cA], targetVariant, 'superRevolution')).toBe(false);
  });
});

// ─── applyTarget ─────────────────────────────────────────────────────────────

describe('applyTarget', () => {
  it('sets pendingAction to target with correct launcherId', () => {
    const state = makeState();
    const next = applyTarget(state, 'p0', 0);
    expect(next.pendingAction).toEqual({ type: 'target', launcherId: 'p0' });
  });

  it('appends a target log entry', () => {
    const state = makeState();
    const next = applyTarget(state, 'p0', 0);
    const entry = next.log.find((e) => e.type === 'target');
    expect(entry).toBeDefined();
    expect(entry!.playerId).toBe('p0');
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    applyTarget(state, 'p0', 0);
    expect(state.pendingAction).toBeNull();
  });
});

// ─── applyTargetChoice — guards ───────────────────────────────────────────────

describe('applyTargetChoice — guards', () => {
  it('throws when there is no pending target action', () => {
    const state = makeState();
    expect(() => applyTargetChoice(state, 'p0', 'p2')).toThrow(/No pending target/);
  });

  it('throws when the caller is not the launcher', () => {
    const state = makeState({ pendingAction: { type: 'target', launcherId: 'p0' } });
    expect(() => applyTargetChoice(state, 'p1', 'p2')).toThrow(/launcher/);
  });

  it('throws when the target player does not exist', () => {
    const state = makeState({ pendingAction: { type: 'target', launcherId: 'p0' } });
    expect(() => applyTargetChoice(state, 'p0', 'ghost')).toThrow(/not found/);
  });

  it('throws when targeting a finished player', () => {
    const players = makeState().players.map((p, i) =>
      i === 2 ? { ...p, isFinished: true } : p,
    );
    const state = makeState({ players, pendingAction: { type: 'target', launcherId: 'p0' } });
    expect(() => applyTargetChoice(state, 'p0', 'p2')).toThrow(/finished/);
  });

  it('throws when targeting yourself', () => {
    const state = makeState({ pendingAction: { type: 'target', launcherId: 'p0' } });
    expect(() => applyTargetChoice(state, 'p0', 'p0')).toThrow(/yourself/);
  });
});

// ─── applyTargetChoice — nominal ─────────────────────────────────────────────

describe('applyTargetChoice — nominal', () => {
  it('clears pendingAction', () => {
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p2');
    expect(next.pendingAction).toBeNull();
  });

  it('sets currentPlayerIndex to the target player', () => {
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p2');
    expect(next.currentPlayerIndex).toBe(2);
  });

  it('normal rotation resumes after target: p0→p2 target, after p2 plays: p3, p0, p1', () => {
    // p0 current, turnOrder [1,2,3]. p0 targets p2.
    // Expected after targetChoice: current=2, turnOrder=[3,0,1]
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p2');
    expect(next.currentPlayerIndex).toBe(2);
    expect(next.turnOrder).toEqual([3, 0, 1]);
  });

  it('targeting p1 (immediately next) produces normal order', () => {
    // p0 current, turnOrder [1,2,3]. p0 targets p1.
    // upcoming = [1,2,3,0], target at pos 0 → current=1, turnOrder=[2,3,0]
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p1');
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.turnOrder).toEqual([2, 3, 0]);
  });

  it('targeting p3 (last in queue) rotates correctly', () => {
    // upcoming = [1,2,3,0], target at pos 2 → current=3, turnOrder=[0,1,2]
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p3');
    expect(next.currentPlayerIndex).toBe(3);
    expect(next.turnOrder).toEqual([0, 1, 2]);
  });

  it('appends a targetChoice log entry', () => {
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    const next = applyTargetChoice(state, 'p0', 'p2');
    const entry = next.log.find((e) => e.type === 'targetChoice');
    expect(entry).toBeDefined();
    expect(entry!.data.targetPlayerId).toBe('p2');
  });

  it('does not mutate the input state', () => {
    const state = makeState({ pile: pileOf('5'), pendingAction: { type: 'target', launcherId: 'p0' } });
    applyTargetChoice(state, 'p0', 'p2');
    expect(state.pendingAction).not.toBeNull();
    expect(state.currentPlayerIndex).toBe(0);
  });
});

// ─── Full flow: applyPlay + applyTargetChoice ────────────────────────────────

describe('Target — full flow via applyPlay', () => {
  it('playing an Ace sets pendingAction target and does not advance turn', () => {
    const state = makeState({ players: makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [cA, cK] } : { ...p, hand: [cK] },
    )});
    const next = applyPlay(state, 'p0', [cA.id]);
    expect(next.pendingAction).toEqual({ type: 'target', launcherId: 'p0' });
    // Turn must NOT have advanced yet
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('after targetChoice the targeted player becomes current', () => {
    const state = makeState({ players: makeState().players.map((p, i) =>
      i === 0 ? { ...p, hand: [cA, cK] } : { ...p, hand: [cK] },
    )});
    const afterPlay = applyPlay(state, 'p0', [cA.id]);
    const afterChoice = applyTargetChoice(afterPlay, 'p0', 'p3');
    expect(afterChoice.currentPlayerIndex).toBe(3);
    expect(afterChoice.pendingAction).toBeNull();
  });

  it('target disabled during revolution — advances turn normally', () => {
    const state = {
      ...makeState({ players: makeState().players.map((p, i) =>
        i === 0 ? { ...p, hand: [cA, cK] } : { ...p, hand: [cK] },
      )}),
      phase: 'revolution' as const,
      pile: pileOf('A'), // Ace on pile; in revolution ≤ so Ace (14) is NOT playable on Ace (14)...
    };
    // Actually in revolution, Ace (value 14) can only be played on ≤ 14 — so pile must have ≥ 14.
    // Empty pile → always playable
    const emptyPileState = { ...state, pile: [] as PileEntry[] };
    const next = applyPlay(emptyPileState, 'p0', [cA.id]);
    // No pending target in revolution
    expect(next.pendingAction).toBeNull();
    // Turn should have advanced normally
    expect(next.currentPlayerIndex).toBe(1);
  });
});

// ─── Target + Skip interaction ────────────────────────────────────────────────

describe('Target + Skip interaction', () => {
  it('Target overrides skip-modified queue: chosen target plays next regardless', () => {
    // Imagine p1 was about to be skipped but p0 now targets p3.
    // The queue is already set up with p1 "skipped" to back: turnOrder = [2, 3, 1]
    const skippedState = makeState({
      turnOrder: [2, 3, 1], // p1 was skip-moved to back
      pendingAction: { type: 'target', launcherId: 'p0' },
    });
    const players = skippedState.players.map((p, i) =>
      i === 0 ? { ...p, hand: [cK] } : { ...p, hand: [cK] },
    );
    const state = { ...skippedState, players };
    const next = applyTargetChoice(state, 'p0', 'p3');
    // p3 should be next
    expect(next.currentPlayerIndex).toBe(3);
    // upcoming was [2,3,1,0]; rotated from p3 → [3,1,0,2]
    // so after p3: p1, p0, p2
    expect(next.turnOrder).toEqual([1, 0, 2]);
  });
});

// ─── Target + Burn interaction ────────────────────────────────────────────────

describe('Target + Burn interaction', () => {
  it('Burn takes priority over Target when both could apply on same turn', () => {
    // This scenario is not directly possible since Burn and Target have different ranks,
    // but we verify that once a target is pending and the targeted player burns,
    // the player replays normally (burn on targeted player's turn).
    const burnVariant: GameVariant = {
      name: 'burn-target',
      powerAssignments: { target: 'A', burn: '10' },
      playerCount: 4,
      deckCount: 1,
    };
    const c10a = card('10', 'hearts', 0);
    const c10b = card('10', 'spades', 1);
    const c10c = card('10', 'diamonds', 2);

    const players = [
      makePlayer('p0', { hand: [cA, cK] }),
      makePlayer('p1', { hand: [c10a, c10b, c10c, cK] }),
      makePlayer('p2', { hand: [cK] }),
      makePlayer('p3', { hand: [cK] }),
    ];
    const state: GameState = {
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
      variant: burnVariant,
      pendingAction: null,
      log: [],
    lastPowerTriggered: null,
    };

    // p0 plays Ace → pendingAction: target
    const afterAce = applyPlay(state, 'p0', [cA.id]);
    expect(afterAce.pendingAction?.type).toBe('target');

    // p0 picks p1 as target
    const afterChoice = applyTargetChoice(afterAce, 'p0', 'p1');
    expect(afterChoice.currentPlayerIndex).toBe(1);

    // p1 plays 3× 10 → Burn (3 10s played on top of 0 pile cards → not 4 identical)
    // Actually burn by 4 same cards requires 4. Let's just check normal play:
    // p1 plays one 10 — this is a burn card but on empty pile after target
    const afterBurnCard = applyPlay(afterChoice, 'p1', [c10a.id]);
    // 10 is a Burn card — triggers burn → player replays
    expect(afterBurnCard.currentPlayerIndex).toBe(1); // p1 replays
    expect(afterBurnCard.pendingCemeteryTransit).toBe(true); // burn sets transit flag
  });
});

// ─── Target on finished player ────────────────────────────────────────────────

describe('Target — finished player validation', () => {
  it('rejects targeting a player who finished before the choice was made', () => {
    const players = makeState().players.map((p, i) =>
      i === 2 ? { ...p, isFinished: true } : p,
    );
    const state = makeState({
      players,
      pendingAction: { type: 'target', launcherId: 'p0' },
    });
    expect(() => applyTargetChoice(state, 'p0', 'p2')).toThrow(/finished/);
  });

  it('can target a player who still has cards', () => {
    const players = makeState().players.map((p, i) =>
      i !== 0 ? { ...p, hand: [cK] } : { ...p, hand: [cK] },
    );
    const state = makeState({
      players,
      pendingAction: { type: 'target', launcherId: 'p0' },
    });
    expect(() => applyTargetChoice(state, 'p0', 'p3')).not.toThrow();
  });
});

// ─── Target → pickup → auto-skip with logging ────────────────────────────────

describe('Target → pickup → turn after ramassage', () => {
  const jSpade: Card = { id: 'J-s-0', suit: 'spades', rank: 'J' };

  it('after target + pickup, turn goes to next player after the one who picked up', () => {
    // 3 players: p0 (human), p1 (bot1), p2 (bot2)
    // p2 plays Ace → targets p1 → p1 picks up → turn should go to p2
    const threePlayerVariant: GameVariant = {
      name: 'test3',
      powerAssignments: { target: 'A', burn: '10' },
      playerCount: 3,
      deckCount: 1,
    };
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
      makePlayer('p2', { hand: [card('A', 'spades'), cK] }),
    ];
    const state: GameState = {
      id: 'g1',
      phase: 'playing',
      players,
      deck: [],
      pile: [],
      graveyard: [],
      currentPlayerIndex: 2,
      direction: 1,
      turnOrder: [0, 1],
      finishOrder: [],
      variant: threePlayerVariant,
      pendingAction: null,
      log: [],
      lastPowerTriggered: null,
    };

    // p2 plays Ace → Target triggered
    const afterAce = applyPlay(state, 'p2', [card('A', 'spades').id]);
    expect(afterAce.pendingAction?.type).toBe('target');

    // p2 targets p1
    const afterChoice = applyTargetChoice(afterAce, 'p2', 'p1');
    expect(afterChoice.currentPlayerIndex).toBe(1); // p1's turn

    // p1 picks up the pile (the Ace)
    const afterPickUp = applyPickUpPile(afterChoice, 'p1');
    // After pickup, next should be p2 (next after p1 in turn order)
    expect(afterPickUp.currentPlayerIndex).toBe(2);
  });

  it('after target + pickup + auto-skip, skipped player has log entries', () => {
    // 3 players: p0, p1, p2
    // p2 plays Ace → targets p1 → p1 picks up → p2 only has Jacks → p2 skipped → p0 plays
    // The skip should be logged
    const threePlayerVariant: GameVariant = {
      name: 'test3',
      powerAssignments: { target: 'A', burn: '10' },
      playerCount: 3,
      deckCount: 1,
    };
    const players = [
      makePlayer('p0', { hand: [cK] }),
      makePlayer('p1', { hand: [c5] }),
      makePlayer('p2', { hand: [card('A', 'spades'), jSpade] }),
    ];
    const state: GameState = {
      id: 'g1',
      phase: 'playing',
      players,
      deck: [],
      pile: [],
      graveyard: [],
      currentPlayerIndex: 2,
      direction: 1,
      turnOrder: [0, 1],
      finishOrder: [],
      variant: threePlayerVariant,
      pendingAction: null,
      log: [],
      lastPowerTriggered: null,
    };

    // p2 plays Ace → Target triggered
    const afterAce = applyPlay(state, 'p2', [card('A', 'spades').id]);

    // p2 targets p1
    const afterChoice = applyTargetChoice(afterAce, 'p2', 'p1');

    // p1 picks up the pile
    const afterPickUp = applyPickUpPile(afterChoice, 'p1');

    // p2 only has Jack (can't play on empty pile) → auto-skipped → p0 plays
    expect(afterPickUp.currentPlayerIndex).toBe(0);

    // Verify skip was logged
    const skipEntries = afterPickUp.log.filter((e) => e.type === 'skipTurn');
    expect(skipEntries.length).toBeGreaterThanOrEqual(1);
    expect(skipEntries.some((e) => e.playerId === 'p2')).toBe(true);

    const skipEffects = afterPickUp.log.filter((e) => e.type === 'skipTurnEffect');
    expect(skipEffects.length).toBeGreaterThanOrEqual(1);
    const p2Effect = skipEffects.find((e) => e.playerId === 'p2');
    expect(p2Effect).toBeDefined();
    expect(p2Effect!.data.message).toBe('p2 passe son tour');
  });
});
