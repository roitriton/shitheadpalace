import { describe, it, expect } from 'vitest';
import { isShifumiCard, isShifumiTriggered, isSuperShifumiTriggered } from './shifumi';
import { applyShifumiTarget, applyShifumiChoice } from '../engine/actions/applyShifumiChoice';
import { applyPlay } from '../engine/actions/play';
import type { Card, GameState, GameVariant, PendingShifumi, Player } from '../types';

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
const jClub    = card('J', 'clubs');
const jHeart   = card('J', 'hearts');
const jSpade   = card('J', 'spades');
const jDiamond = card('J', 'diamonds');
const c9       = card('9');              // Mirror card (in mirrorVariant)
const c9b      = card('9', 'spades', 1);
const cK       = card('K');
const cQ       = card('Q');

// ─── isShifumiCard ────────────────────────────────────────────────────────────

describe('isShifumiCard', () => {
  it('returns true for J♣', () => {
    expect(isShifumiCard(jClub)).toBe(true);
  });

  it('returns false for J♥', () => {
    expect(isShifumiCard(jHeart)).toBe(false);
  });

  it('returns false for J♦', () => {
    expect(isShifumiCard(jDiamond)).toBe(false);
  });

  it('returns false for J♠', () => {
    expect(isShifumiCard(jSpade)).toBe(false);
  });

  it('returns false for a non-Jack clubs card', () => {
    expect(isShifumiCard(card('Q', 'clubs'))).toBe(false);
  });
});

// ─── isShifumiTriggered ───────────────────────────────────────────────────────

describe('isShifumiTriggered', () => {
  it('returns true for a single J♣', () => {
    expect(isShifumiTriggered([jClub], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false when J♣ is accompanied by a Mirror (→ Super Shifumi instead)', () => {
    expect(isShifumiTriggered([jClub, c9], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isShifumiTriggered([jClub], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isShifumiTriggered([jClub], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns false when no J♣ present', () => {
    expect(isShifumiTriggered([cK, cQ], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns true when J♣ accompanies a non-Mirror card', () => {
    expect(isShifumiTriggered([jClub, cK], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns true when no mirror is assigned in variant and J♣ + 9 played', () => {
    // With no mirror rank configured, 9 is an ordinary card → regular Shifumi
    expect(isShifumiTriggered([jClub, c9], noMirrorVariant, 'playing')).toBe(true);
  });
});

// ─── isSuperShifumiTriggered ─────────────────────────────────────────────────

describe('isSuperShifumiTriggered', () => {
  it('returns true for J♣ + Mirror', () => {
    expect(isSuperShifumiTriggered([jClub, c9], mirrorVariant, 'playing')).toBe(true);
  });

  it('returns false for J♣ alone', () => {
    expect(isSuperShifumiTriggered([jClub], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns false during revolution phase', () => {
    expect(isSuperShifumiTriggered([jClub, c9], mirrorVariant, 'revolution')).toBe(false);
  });

  it('returns false during superRevolution phase', () => {
    expect(isSuperShifumiTriggered([jClub, c9], mirrorVariant, 'superRevolution')).toBe(false);
  });

  it('returns false when only Mirror is present without J♣', () => {
    expect(isSuperShifumiTriggered([c9, cK], mirrorVariant, 'playing')).toBe(false);
  });

  it('returns true when J♣ is accompanied by multiple Mirror cards', () => {
    expect(isSuperShifumiTriggered([jClub, c9, c9b], mirrorVariant, 'playing')).toBe(true);
  });
});

// ─── applyShifumiTarget ───────────────────────────────────────────────────────

describe('applyShifumiTarget', () => {
  function stateWithPending(type: 'shifumi' | 'superShifumi' = 'shifumi'): GameState {
    return makeState({ pendingAction: { type, initiatorId: 'p0' } });
  }

  describe('guards', () => {
    it('throws when pendingAction is null', () => {
      const state = makeState({ pendingAction: null });
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p2')).toThrow('No pending shifumi action');
    });

    it('throws when pendingAction is a different type', () => {
      const state = makeState({ pendingAction: { type: 'target', launcherId: 'p0' } });
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p2')).toThrow('No pending shifumi action');
    });

    it('throws when a non-initiator tries to select targets', () => {
      const state = stateWithPending();
      expect(() => applyShifumiTarget(state, 'p1', 'p1', 'p2')).toThrow('Only the Shifumi initiator');
    });

    it('throws when player1Id equals player2Id', () => {
      const state = stateWithPending();
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p1')).toThrow('two different players');
    });

    it('throws when player1 does not exist', () => {
      const state = stateWithPending();
      expect(() => applyShifumiTarget(state, 'p0', 'pX', 'p2')).toThrow("Player 'pX' not found");
    });

    it('throws when player2 does not exist', () => {
      const state = stateWithPending();
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'pX')).toThrow("Player 'pX' not found");
    });

    it('throws when player1 is already finished', () => {
      const state = makeState({
        pendingAction: { type: 'shifumi', initiatorId: 'p0' },
        players: [
          makePlayer('p0'),
          makePlayer('p1', { isFinished: true }),
          makePlayer('p2'),
          makePlayer('p3'),
        ],
      });
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p2')).toThrow("Player 'p1' is already finished");
    });

    it('throws when player2 is already finished', () => {
      const state = makeState({
        pendingAction: { type: 'shifumi', initiatorId: 'p0' },
        players: [
          makePlayer('p0'),
          makePlayer('p1'),
          makePlayer('p2', { isFinished: true }),
          makePlayer('p3'),
        ],
      });
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p2')).toThrow("Player 'p2' is already finished");
    });

    it('throws when targets have already been selected', () => {
      const state = makeState({
        pendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' },
      });
      expect(() => applyShifumiTarget(state, 'p0', 'p1', 'p3')).toThrow('targets have already been selected');
    });
  });

  describe('nominal', () => {
    it('sets player1Id and player2Id in pendingAction', () => {
      const state = stateWithPending();
      const next = applyShifumiTarget(state, 'p0', 'p1', 'p2');
      expect(next.pendingAction).toMatchObject({ type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' });
    });

    it('works for superShifumi pending type', () => {
      const state = stateWithPending('superShifumi');
      const next = applyShifumiTarget(state, 'p0', 'p2', 'p3');
      expect(next.pendingAction).toMatchObject({ type: 'superShifumi', player1Id: 'p2', player2Id: 'p3' });
    });

    it('logs a shifumiTarget entry with both player IDs', () => {
      const state = stateWithPending();
      const next = applyShifumiTarget(state, 'p0', 'p1', 'p2');
      const logEntry = next.log.find((l) => l.type === 'shifumiTarget');
      expect(logEntry).toBeDefined();
      expect(logEntry?.data).toMatchObject({ player1Id: 'p1', player2Id: 'p2' });
    });

    it('initiator can include themselves as one of the combatants', () => {
      const state = stateWithPending();
      const next = applyShifumiTarget(state, 'p0', 'p0', 'p1');
      expect(next.pendingAction).toMatchObject({ player1Id: 'p0', player2Id: 'p1' });
    });

    it('does not advance the turn', () => {
      const state = stateWithPending();
      const next = applyShifumiTarget(state, 'p0', 'p1', 'p2');
      expect(next.currentPlayerIndex).toBe(0);
    });
  });
});

// ─── applyShifumiChoice ───────────────────────────────────────────────────────

describe('applyShifumiChoice', () => {
  /** Returns a state where both participants are set and awaiting choices. */
  function stateReadyForChoices(type: 'shifumi' | 'superShifumi' = 'shifumi'): GameState {
    return makeState({
      pile: [{ cards: [cK], playerId: 'p2', playerName: 'p2', timestamp: 0 }],
      pendingAction: { type, initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2' },
    });
  }

  describe('guards', () => {
    it('throws when no pending shifumi action', () => {
      const state = makeState();
      expect(() => applyShifumiChoice(state, 'p1', 'rock')).toThrow('No pending shifumi action');
    });

    it('throws when targets have not been selected yet', () => {
      const state = makeState({ pendingAction: { type: 'shifumi', initiatorId: 'p0' } });
      expect(() => applyShifumiChoice(state, 'p1', 'rock')).toThrow('targets have not been selected yet');
    });

    it('throws when player is not a combatant', () => {
      const state = stateReadyForChoices();
      expect(() => applyShifumiChoice(state, 'p3', 'rock')).toThrow('Only the Shifumi participants');
    });

    it('throws when player1 submits their choice twice', () => {
      const state = makeState({
        pendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2', player1Choice: 'rock' },
      });
      expect(() => applyShifumiChoice(state, 'p1', 'scissors')).toThrow('already submitted');
    });

    it('throws when player2 submits their choice twice', () => {
      const state = makeState({
        pendingAction: { type: 'shifumi', initiatorId: 'p0', player1Id: 'p1', player2Id: 'p2', player2Choice: 'paper' },
      });
      expect(() => applyShifumiChoice(state, 'p2', 'rock')).toThrow('already submitted');
    });
  });

  describe('recording choices (before both are in)', () => {
    it('records player1 choice and awaits player2', () => {
      const state = stateReadyForChoices();
      const next = applyShifumiChoice(state, 'p1', 'rock');
      const pending = next.pendingAction as PendingShifumi;
      expect(pending.player1Choice).toBe('rock');
      expect(pending.player2Choice).toBeUndefined();
      expect(next.pile).toHaveLength(1); // pile untouched
    });

    it('records player2 choice and awaits player1', () => {
      const state = stateReadyForChoices();
      const next = applyShifumiChoice(state, 'p2', 'scissors');
      const pending = next.pendingAction as PendingShifumi;
      expect(pending.player2Choice).toBe('scissors');
      expect(pending.player1Choice).toBeUndefined();
    });

    it('logs a shifumiChoice entry', () => {
      const state = stateReadyForChoices();
      const next = applyShifumiChoice(state, 'p1', 'paper');
      const entry = next.log.find((l) => l.type === 'shifumiChoice');
      expect(entry?.data).toMatchObject({ choice: 'paper' });
    });
  });

  describe('tie resolution', () => {
    it('resets choices and keeps same combatants when both pick the same option', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock');
      const pending = s2.pendingAction as PendingShifumi;
      // Participants still set, choices cleared
      expect(pending.player1Id).toBe('p1');
      expect(pending.player2Id).toBe('p2');
      expect(pending.player1Choice).toBeUndefined();
      expect(pending.player2Choice).toBeUndefined();
    });

    it('logs a shifumiTie entry', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'scissors');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      expect(s2.log.some((l) => l.type === 'shifumiTie')).toBe(true);
    });

    it('participants can submit new choices after a tie and resolve correctly', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock'); // tie
      // New round: p1=paper, p2=scissors → scissors beats paper → p2 wins → p1 loses
      const s3 = applyShifumiChoice(s2, 'p1', 'paper');
      const s4 = applyShifumiChoice(s3, 'p2', 'scissors');
      const p1 = s4.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toContain(cK); // p1 picked up pile
      expect(s4.pile).toHaveLength(0);
    });
  });

  describe('regular Shifumi resolution', () => {
    it('loser picks up the pile when player1 wins (rock beats scissors)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      // p1 wins → p2 loses → p2 picks up pile
      const p2 = s2.players.find((p) => p.id === 'p2')!;
      expect(p2.hand).toContain(cK);
      expect(s2.pile).toHaveLength(0);
    });

    it('loser picks up the pile when player2 wins (paper beats rock)', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'paper');
      // p2 wins → p1 loses → p1 picks up pile
      const p1 = s2.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toContain(cK);
    });

    it('clears pendingAction after resolution', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'scissors');
      const s2 = applyShifumiChoice(s1, 'p2', 'rock');
      expect(s2.pendingAction).toBeNull();
    });

    it('logs a shifumiResolved entry', () => {
      const s1 = applyShifumiChoice(stateReadyForChoices(), 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      expect(s2.log.some((l) => l.type === 'shifumiResolved')).toBe(true);
    });

    it('advances the turn from the initiator position after resolution', () => {
      // p0 is initiator (currentPlayerIndex=0), turnOrder=[1,2,3]
      // Give players cards so auto-skip doesn't interfere with turn-order check
      const base = stateReadyForChoices();
      const c5 = card('5', 'spades', 9);
      const withHands: GameState = {
        ...base,
        players: base.players.map((p) => ({ ...p, hand: [c5] })),
      };
      const s1 = applyShifumiChoice(withHands, 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      // advanceTurn from index 0 → next player is index 1
      expect(s2.currentPlayerIndex).toBe(1);
    });
  });

  describe('Super Shifumi resolution', () => {
    it('declares the loser as Shit Head and ends the game immediately', () => {
      const state = stateReadyForChoices('superShifumi');
      const s1 = applyShifumiChoice(state, 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      // p1 wins → p2 is shit head
      expect(s2.phase).toBe('finished');
      const p2 = s2.players.find((p) => p.id === 'p2')!;
      expect(p2.isShitHead).toBe(true);
      expect(p2.isFinished).toBe(true);
    });

    it('shit head is last in finishOrder', () => {
      const state = stateReadyForChoices('superShifumi');
      const s1 = applyShifumiChoice(state, 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      const last = s2.finishOrder[s2.finishOrder.length - 1];
      expect(last).toBe('p2');
    });

    it('logs superShifumiResolved and gameOver entries', () => {
      const state = stateReadyForChoices('superShifumi');
      const s1 = applyShifumiChoice(state, 'p1', 'rock');
      const s2 = applyShifumiChoice(s1, 'p2', 'scissors');
      expect(s2.log.some((l) => l.type === 'superShifumiResolved')).toBe(true);
      expect(s2.log.some((l) => l.type === 'gameOver')).toBe(true);
    });
  });
});

// ─── Full flow via applyPlay ──────────────────────────────────────────────────

describe('Shifumi — full flow via applyPlay', () => {
  it('J♣ alone sets pendingAction to shifumi', () => {
    // p0 has extra card so they don't finish when playing J♣
    const state = makeState({
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [makePlayer('p0', { hand: [jClub, cQ] }), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')],
    });
    const next = applyPlay(state, 'p0', [jClub.id]);
    expect(next.pendingAction).toMatchObject({ type: 'shifumi', initiatorId: 'p0' });
  });

  it('J♣ + Mirror sets pendingAction to superShifumi', () => {
    // p0 has extra card so they don't finish when playing J♣ + Mirror
    const state = makeState({
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [makePlayer('p0', { hand: [jClub, c9, cQ] }), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')],
    });
    const next = applyPlay(state, 'p0', [jClub.id, c9.id]);
    expect(next.pendingAction).toMatchObject({ type: 'superShifumi', initiatorId: 'p0' });
  });

  it('J♣ is moved to graveyard after play (not kept in pile)', () => {
    const state = makeState({
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [makePlayer('p0', { hand: [jClub] }), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')],
    });
    const next = applyPlay(state, 'p0', [jClub.id]);
    expect(next.graveyard.some((c) => c.id === jClub.id)).toBe(true);
    const pileCardIds = next.pile.flatMap((e) => e.cards.map((c) => c.id));
    expect(pileCardIds).not.toContain(jClub.id);
  });

  it('J♣ during revolution does not trigger Shifumi and turn advances', () => {
    const state = makeState({
      phase: 'revolution',
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: 'A' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [makePlayer('p0', { hand: [jClub] }), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')],
    });
    const next = applyPlay(state, 'p0', [jClub.id]);
    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerIndex).toBe(1); // turn advanced normally
  });

  it('J♣ does not set pendingAction when the player finishes by playing it', () => {
    // p0 has only J♣ (hand) and no faceUp / faceDown → finishes when played
    const state = makeState({
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [makePlayer('p0', { hand: [jClub] }), makePlayer('p1'), makePlayer('p2'), makePlayer('p3')],
    });
    const next = applyPlay(state, 'p0', [jClub.id]);
    const p0 = next.players.find((p) => p.id === 'p0')!;
    expect(p0.isFinished).toBe(true);
    expect(next.pendingAction).toBeNull();
  });

  it('full regular Shifumi flow: play → target → two choices → pile pickup', () => {
    const pileCard = card('5', 'hearts', 99);
    const state = makeState({
      pile: [{ cards: [pileCard], playerId: 'p3', playerName: 'p3', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClub, cQ] }), // extra card so p0 doesn't finish
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    // Play J♣
    const s1 = applyPlay(state, 'p0', [jClub.id]);
    expect(s1.pendingAction?.type).toBe('shifumi');

    // Initiator picks targets
    const s2 = applyShifumiTarget(s1, 'p0', 'p1', 'p2');
    expect((s2.pendingAction as PendingShifumi).player1Id).toBe('p1');

    // p1 submits choice
    const s3 = applyShifumiChoice(s2, 'p1', 'rock');
    expect(s3.pendingAction).not.toBeNull();

    // p2 submits choice → rock beats scissors → p2 loses → picks up pile
    const s4 = applyShifumiChoice(s3, 'p2', 'scissors');
    expect(s4.pendingAction).toBeNull();
    const p2 = s4.players.find((p) => p.id === 'p2')!;
    expect(p2.hand).toContain(pileCard);
    expect(s4.pile).toHaveLength(0);
  });

  it('full Super Shifumi flow: play → target → choices → game over', () => {
    const state = makeState({
      pile: [{ cards: [{ id: 'pile-5-0', suit: 'hearts', rank: '5' }], playerId: 'x', playerName: 'X', timestamp: 0 }],
      players: [
        makePlayer('p0', { hand: [jClub, c9, cQ] }), // extra card so p0 doesn't finish
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
    });

    const s1 = applyPlay(state, 'p0', [jClub.id, c9.id]);
    expect(s1.pendingAction?.type).toBe('superShifumi');

    const s2 = applyShifumiTarget(s1, 'p0', 'p1', 'p2');
    const s3 = applyShifumiChoice(s2, 'p1', 'paper');
    const s4 = applyShifumiChoice(s3, 'p2', 'rock');
    // paper beats rock → p1 wins → p2 is shit head
    expect(s4.phase).toBe('finished');
    const p2 = s4.players.find((p) => p.id === 'p2')!;
    expect(p2.isShitHead).toBe(true);
  });
});
