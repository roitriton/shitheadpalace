import { describe, it, expect } from 'vitest';
import type { Card, GameState, Player, PileEntry } from '../../types';
import { applyPlay } from './play';
import { applyRevolutionConfirm } from './applyRevolutionConfirm';
import { applyMultiJackOrder, continueMultiJackSequence } from './applyMultiJackOrder';
import type { MultiJackSequenceEntry } from '../../types';

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

function makeState(
  p0: Partial<Player>,
  pileEntries: PileEntry[] = pile('3'),
  deck: Card[] = [],
  extraPlayers: Partial<Player>[] = [{}],
): GameState {
  const players = [
    makePlayer('p0', p0),
    ...extraPlayers.map((ep, i) => makePlayer(`p${i + 1}`, ep)),
  ];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck,
    pile: pileEntries,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: extraPlayers.map((_, i) => i + 1),
    finishOrder: [],
    variant: {
      name: 'S',
      powerAssignments: { revolution: 'J', mirror: '9' },
      playerCount: 1 + extraPlayers.length,
      deckCount: 1,
    },
    pendingAction: null,
    log: [],
    lastPowerTriggered: null,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('applyRevolutionConfirm', () => {
  it('single J♦ → PendingRevolutionConfirm, then confirm applies revolution', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd, card('K'), card('Q')] },
      pile('3'),
    );

    let result = applyPlay(state, 'p0', [jd.id]);
    // Revolution is deferred: PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect(result.pendingAction).toMatchObject({ playerId: 'p0', isSuper: false });
    expect(result.revolution).toBeFalsy();
    // lastPowerTriggered is set early (for overlay before popup)
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    expect(result.pendingActionDelayed).toBe(true);

    // Confirm applies the revolution
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.phase).toBe('revolution');
    // lastPowerTriggered persists from initial play (not overwritten by confirm)
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    expect(result.lastPowerTriggered?.playerId).toBe('p0');
    expect(result.pendingAction).toBeNull();
    // Turn advanced
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('single J♦ + mirror(9) → PendingRevolutionConfirm with isSuper true', () => {
    const jd = card('J', 'diamonds');
    const m9 = card('9', 'spades');
    const state = makeState(
      { hand: [jd, m9, card('K')] },
      pile('3'),
    );

    let result = applyPlay(state, 'p0', [jd.id, m9.id]);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect(result.pendingAction).toMatchObject({ isSuper: true });

    result = applyRevolutionConfirm(result, 'p0');
    expect(result.superRevolution).toBe(true);
    expect(result.phase).toBe('superRevolution');
    expect(result.lastPowerTriggered?.type).toBe('superRevolution');
  });

  it('super revolution is permanent after confirm', () => {
    const jd = card('J', 'diamonds');
    const m9 = card('9', 'spades');
    const state = makeState(
      { hand: [jd, m9, card('K')] },
      pile('3'),
    );

    let result = applyPlay(state, 'p0', [jd.id, m9.id]);
    result = applyRevolutionConfirm(result, 'p0');

    // Super revolution flag is permanent
    expect(result.superRevolution).toBe(true);
    expect(result.phase).toBe('superRevolution');
  });

  it('wrong player cannot confirm', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd, card('K'), card('Q')] },
      pile('3'),
    );

    const result = applyPlay(state, 'p0', [jd.id]);
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');

    expect(() => applyRevolutionConfirm(result, 'p1')).toThrow(/Only the revolution launcher/);
  });

  it('throws when no pending revolution confirmation', () => {
    const state = makeState({ hand: [card('5'), card('K')] }, pile('3'));
    expect(() => applyRevolutionConfirm(state, 'p0')).toThrow(/No pending revolution confirmation/);
  });

  it('confirm with multiJackSequence → revolution applied, sequence continues', () => {
    const jd = card('J', 'diamonds');
    const jh = card('J', 'hearts');
    const state = makeState(
      { hand: [jd, jh, card('K')] },
      pile('3'),
      [],
      [{ faceUp: [card('Q')], faceDown: [card('3', 'clubs')] }, {}, {}],
    );
    // Need 4 players for multi-jack variant
    state.variant.playerCount = 4;

    let result = applyPlay(state, 'p0', [jd.id, jh.id]);
    expect(result.pendingAction?.type).toBe('PendingMultiJackOrder');

    // Revolution first, then flop reverse
    const seq: MultiJackSequenceEntry[] = [
      { jackCard: jd },
      { jackCard: jh },
    ];
    result = applyMultiJackOrder(result, 'p0', seq);

    // PendingRevolutionConfirm set
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');
    expect(result.multiJackSequence).toBeDefined();

    // Confirm: revolution applied, sequence still in progress
    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.lastPowerTriggered?.type).toBe('revolution');
    expect(result.multiJackSequence).toBeDefined();
    expect(result.pendingAction).toBeNull();

    // Continue: move J♦ to graveyard, flop reverse pending
    result = continueMultiJackSequence(result, 1);
    expect(result.pendingAction?.type).toBe('flopReverse');
  });

  it('player finishes by playing last cards with revolution → revolution still applies', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd] }, // Last card — p0 finishes
      pile('3'),
      [],
      // Need 2+ remaining players so game doesn't end when p0 finishes
      [{ hand: [card('5'), card('6')] }, { hand: [card('7'), card('8', 'clubs')] }],
    );

    let result = applyPlay(state, 'p0', [jd.id]);
    // PendingRevolutionConfirm is set even though player finished
    expect(result.pendingAction?.type).toBe('PendingRevolutionConfirm');

    result = applyRevolutionConfirm(result, 'p0');
    expect(result.revolution).toBe(true);
    expect(result.phase).toBe('revolution');
    // Player is finished
    const p0 = result.players.find((p) => p.id === 'p0')!;
    expect(p0.isFinished).toBe(true);
  });

  it('cardsPlayed in lastPowerTriggered reflects the jack card from pile', () => {
    const jd = card('J', 'diamonds');
    const state = makeState(
      { hand: [jd, card('K'), card('Q')] },
      pile('3'),
    );

    let result = applyPlay(state, 'p0', [jd.id]);
    result = applyRevolutionConfirm(result, 'p0');

    expect(result.lastPowerTriggered?.cardsPlayed).toEqual([
      { rank: 'J', suit: 'diamonds' },
    ]);
  });
});
